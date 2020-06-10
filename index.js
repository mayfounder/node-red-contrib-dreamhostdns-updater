module.exports = function(RED) {
  /**
   * Node that exposes dreamhost functionalities
   * @param {object} config - Node Red Config
   */
  function DreamHostNode(config) {
    /*
     * TODO:
     * 1 Improve msg.send responses
     * 2 Change project name
     * 3 Add Unit Test
     */
    const isIp = require('is-ip');
    const DreamHost = require('dreamhost');
    RED.nodes.createNode(this, config);
    this.domain = config.domain;
    this.subdomain = config.subdomain;
    this.record = this.subdomain + '.' + this.domain;
    this.apiKey = this.credentials.apiKey;
    const node = this;
    const addRecord = function(record, msg) {
      node.log('Adding Record: ' + JSON.stringify(record));
      return node.dh.dns.addRecord(record);
    };
    const updateRecord = function(record, newRecord) {
      node.log('Updating Record: ' + JSON.stringify(record) +
        ' => ' + JSON.stringify(newRecord));
      return new Promise((resolve, reject) => {
        node.dh.dns.removeRecord(record)
            .then((resultRemove) => {
              node.dh.dns.addRecord(newRecord)
                  .then((resultAdd) => {
                    resolve([resultRemove, resultAdd]);
                  })
                  .catch((err) => reject(err));
            })
            .catch((err) => reject(err));
      });
    };
    const updateDNS = function(records, msg) {
      node.status({fill: 'yellow', shape: 'ring', text: 'Updating...'});
      node.debug('Updating records: ' + JSON.stringify(records));
      let v4Prom = null;
      let v6Prom = null;
      if (records.ipv4) {
        if (records.v4missing == false) {
          v4Prom = updateRecord(records.ipv4_old, records.ipv4);
        } else {
          v4Prom = addRecord(records.ipv4, msg);
        }
      }
      if (records.ipv6) {
        if (records.v6missing == false) {
          v6Prom = updateRecord(records.ipv6_old, records.ipv6);
        } else {
          v6Prom = addRecord(records.ipv6, msg);
        }
      }

      Promise.all([v4Prom, v6Prom])
          .then(([v4Result, v6Result]) => {
            node.status({fill: 'green', shape: 'dot', text: 'OK'});
            node.debug('Everything updated: v4 ' + v4Result +
              ' v6 ' + v6Result);
            msg.payload = {
              'error': false,
              'errorMsg': '',
              'updatedIPv4': v4Result != null,
              'updatedIPv6': v6Result != null,
            };
            node.send(msg);
          })
          .catch((err) => {
            node.status({
              fill: 'red',
              shape: 'ring',
              text: 'Error',
            });
            msg.payload = {
              'error': true,
              'errorMsg': JSON.stringify(err),
              'updatedIPv4': false,
              'updatedIPv6': false,
            };
            node.send(msg);
          });
    };
    const connectionError = function(err, state, msg) {
      let errorMsg = 'Error Connecting to Dreamhost: ' + JSON.stringify(err);
      if (state) {
        errorMsg = 'Error Connecting to Dreamhost in ' + state + ' : ' +
                    JSON.stringify(err);
      }
      node.error(errorMsg);
      node.status({
        fill: 'red',
        shape: 'ring',
        text: 'Error Connecting to Dreamhost',
      });
      msg.payload = {
        'error': true,
        'errorMsg': errorMsg,
      };
      node.send(msg);
    };
    /**
     * Generates an IPv6 Record based on the information
     * @param {object} r - Current record if exists
     * @return {object}
     */
    const genIPv6Record = function(r) {
      if (r) {
        return {
          'record': r.record,
          'type': r.type,
          'value': node.publicIPv6,
          'comment': r.comment,
        };
      } else {
        return {
          'record': node.record,
          'type': 'AAAA',
          'value': node.publicIPv6,
          'commment': node.record + ' IPv6',
        };
      }
    };
    /**
     * Generates an IPv4 Record based on the information
     * @param {object} r - Current record if exists
     * @return {object}
     */
    const genIPv4Record = function(r) {
      if (r) {
        return {
          'record': r.record,
          'type': r.type,
          'value': node.publicIPv4,
          'comment': r.comment,
        };
      } else {
        return {
          'record': node.record,
          'type': 'A',
          'value': node.publicIPv4,
          'commment': node.record + ' IPv4',
        };
      }
    };
    const findRecords = function(records) {
      const newRecords = {};
      let foundIPv4 = false;
      let foundIPv6 = false;
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        if (r.editable == '1' &&
            r.zone == node.domain &&
            r.record == node.record) {
          node.debug('Record [' + i + ']: ' + JSON.stringify(r));
          if (r.type == 'A') {
            foundIPv4 = true;
            if (r.value != node.publicIPv4 && node.publicIPv4 != null) {
              node.debug('IPv4 Mistmatched');
              newRecords.v4missing = false;
              newRecords.ipv4_old = r;
              newRecords.ipv4 = genIPv4Record(r);
            }
          }
          if (r.type == 'AAAA') {
            foundIPv6 = true;
            if (r.value != node.publicIPv6 && node.publicIPv6 != null) {
              node.debug('IPv6 Mistmatched');
              newRecords.v6missing = false;
              newRecords.ipv6_old = r;
              newRecords.ipv6 = genIPv6Record(r);
            }
          }
        }
      }
      if (!foundIPv4 && node.publicIPv4 != null) {
        node.debug('IPv4 Record Not Found');
        newRecords.ipv4 = genIPv4Record(null);
        newRecords.v4missing = true;
      }
      if (!foundIPv6 && node.publicIPv6 != null) {
        node.debug('IPv6 Record Not Found');
        newRecords.ipv6 = genIPv6Record(null);
        newRecords.v6missing = true;
      }
      return newRecords;
    };
    const checkRecords = function(records, msg) {
      const newRecords = findRecords(records);
      if (newRecords.ipv6 || newRecords.ipv4) {
        updateDNS(newRecords, msg);
      } else {
        msg.payload = {
          'error': false,
          'errorMsg': '',
          'updatedIPv4': false,
          'updatedIPv6': false,
        };
        node.send(msg);
      }
    };
    node.on('input', function(msg) {
      node.publicIPv4 = null;
      node.publicIPv6 = null;
      const dh = new DreamHost({
        key: node.apiKey,
      });
      node.dh = dh;
      if (msg.payload.publicIPv4) {
        if (isIp(msg.payload.publicIPv4)) {
          node.publicIPv4 = msg.payload.publicIPv4;
        }
      }
      if (msg.payload.publicIPv6) {
        if (isIp(msg.payload.publicIPv6)) {
          node.publicIPv6 = msg.payload.publicIPv6.toUpperCase();
        }
      }
      if (node.publicIPv4 != null || node.publicIPv6 != null) {
        node.debug('Input Payload: ' + JSON.stringify(msg.payload));
        node.trace('Domain: ' + node.domain +
          ' Subdomain: ' + node.subdomain +
          ' API Key:' + node.apiKey);
        node.status({fill: 'yellow', shape: 'ring', text: 'Fetching...'});
        return dh.dns.listRecords()
            .then((records) => {
              node.status({fill: 'green', shape: 'dot', text: 'OK'});
              checkRecords(records, msg);
            })
            .catch((err) => connectionError(err, 'list_records', msg));
      } else {
        const errorMsg = 'No IP Addresses found in payload: ' +
          JSON.stringify(msg.payload);
        node.warn(errorMsg);
        msg.payload = {
          'error': true,
          'errorMsg': errorMsg,
        };
        node.send(msg);
      }
    });
  }
  RED.nodes.registerType('Dreamhost DNS Updater', DreamHostNode, {
    credentials: {
      apiKey: {type: 'text'},
    },
  });
};
