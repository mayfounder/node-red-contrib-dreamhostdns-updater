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
    /**
     * Normalizes msg.payload to a plain object when suitable for option keys.
     * @param {*} payload - Node-RED message payload
     * @return {object}
     */
    const payloadAsObject = function(payload) {
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        return payload;
      }
      return {};
    };
    node.on('input', async function(msg) {
      node.publicIPv4 = null;
      node.publicIPv6 = null;
      const payload = payloadAsObject(msg.payload);
      if (payload.publicIPv4 && isIp(payload.publicIPv4)) {
        node.publicIPv4 = payload.publicIPv4;
      }
      if (payload.publicIPv6 && isIp(payload.publicIPv6)) {
        node.publicIPv6 = payload.publicIPv6.toUpperCase();
      }
      const needV4 = node.publicIPv4 == null;
      const needV6 = node.publicIPv6 == null;
      if (needV4 || needV6) {
        node.status({
          fill: 'yellow',
          shape: 'ring',
          text: 'Resolving public IP...',
        });
        try {
          const {publicIpv4, publicIpv6} = await import('public-ip');
          const timeout = typeof payload.ipLookupTimeout === 'number' ?
            payload.ipLookupTimeout : 10000;
          const settled = await Promise.allSettled([
            needV4 ? publicIpv4({timeout}) : Promise.resolve(undefined),
            needV6 ? publicIpv6({timeout}) : Promise.resolve(undefined),
          ]);
          if (needV4 && settled[0].status === 'fulfilled') {
            node.publicIPv4 = settled[0].value;
          }
          if (needV6 && settled[1].status === 'fulfilled') {
            node.publicIPv6 = settled[1].value.toUpperCase();
          }
        } catch (err) {
          connectionError(err, 'public_ip', msg);
          return;
        }
      }
      if (node.publicIPv4 != null || node.publicIPv6 != null) {
        node.debug('Resolved / payload IPs — IPv4: ' + node.publicIPv4 +
          ' IPv6: ' + node.publicIPv6);
        node.trace('Domain: ' + node.domain +
          ' Subdomain: ' + node.subdomain +
          ' API Key:' + node.apiKey);
        const dh = new DreamHost({
          key: node.apiKey,
        });
        node.dh = dh;
        node.status({fill: 'yellow', shape: 'ring', text: 'Fetching...'});
        return dh.dns.listRecords()
            .then((records) => {
              node.status({fill: 'green', shape: 'dot', text: 'OK'});
              checkRecords(records, msg);
            })
            .catch((err) => connectionError(err, 'list_records', msg));
      } else {
        const errorMsg =
          'Could not determine any public IP address (IPv4/IPv6). ' +
          'Check connectivity or set payload.publicIPv4 / ' +
          'payload.publicIPv6.';
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
