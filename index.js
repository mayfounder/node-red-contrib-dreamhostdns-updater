module.exports = function(RED) {
  /**
   * Node that exposes dreamhost functionalities
   * @param {object} config - Node Red Config
   */
  function DreamHostNode(config) {
    const isIp = require('is-ip');
    const DreamHost = require('dreamhost');
    RED.nodes.createNode(this, config);
    this.domain = config.domain;
    this.subdomain = config.subdomain;
    this.record = this.subdomain + '.' + this.domain;
    this.apiKey = this.credentials.apiKey;
    const node = this;
    const addRecord = function(record, cb) {
      node.dh.dns.addRecord(record)
          .then(function(result) {
            node.log('Added Record:' + JSON.stringify(result));
            if (cb) {
              cb(record);
            }
          })
          .catch(connectionError);
    };
    const removeRecord = function(record, cb) {
      node.dh.dns.removeRecord(record)
          .then(function(result) {
            node.log('Removed Record:' + JSON.stringify(result));
            if (cb) {
              cb(record);
            }
          })
          .catch(connectionError);
    };
    const updateRecords = function(records) {
      node.status({fill: 'yellow', shape: 'ring', text: 'Updating...'});
      node.log('Updating records: ' + JSON.stringify(records));
      if (records.ipv4) {
        node.log('Updating IPv4 Record');
        if (records.v4missing == false) {
          node.log('Removing old IPv4 Record');
          removeRecord(records.ipv4, addRecord);
        } else {
          addRecord(records.ipv4);
        }
      }
      if (records.ipv6) {
        node.log('Updating IPv6 Record');
        if (records.v6missing == false) {
          node.log('Removing old IPv6 Record');
          removeRecord(records.ipv6, addRecord);
        } else {
          addRecord(records.ipv6);
        }
      }
      node.status({fill: 'green', shape: 'dot', text: 'OK'});
      return Promise.resolve();
    };
    const connectionError = function(err, state) {
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
        'error': false,
        'errorMsg': errorMsg,
      };
      node.send(msg);
    };
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
    const checkRecords = function(records) {
      node.status({fill: 'green', shape: 'dot', text: 'OK'});
      const newRecords = {};
      let foundIPv4 = false;
      let foundIPv6 = false;
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        if (r.editable == '1' &&
            r.zone == node.domain &&
            r.record == node.record) {
          node.log('Record: ' + JSON.stringify(r));
          if (r.type == 'A') {
            foundIPv4 = true;
            if (r.value != node.publicIPv4 && node.publicIPv4 != null) {
              node.log('IPv4 Mistmatched');
              newRecords.ipv4 = genIPv4Record(r);
            }
          }
          if (r.type == 'AAAA') {
            foundIPv6 = true;
            if (r.value != node.publicIPv6 && node.publicIPv6 != null) {
              node.log('IPv6 Mistmatched');
              newRecords.ipv6 = genIPv6Record(r);
            }
          }
        }
      }
      if (!foundIPv4 && node.publicIPv4 != null) {
        node.log('IPv4 Record Not Found');
        newRecords.ipv4 = genIPv4Record(null);
        newRecords.v4missing = true;
      }
      if (!foundIPv6 && node.publicIPv6 != null) {
        node.log('IPv6 Record Not Found');
        newRecords.ipv6 = genIPv6Record(null);
        newRecords.v6missing = true;
      }
      if (newRecords.ipv6 || newRecords.ipv4) {
        updateRecords(newRecords);
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
        node.debug('Payload: ' + JSON.stringify(msg.payload));
        node.debug('Domain: ' + node.domain +
          ' Subdomain: ' + node.subdomain +
          ' API Key:' + node.apiKey);
        dh.dns.listRecords()
            .then(checkRecords)
            .catch((err) => connectionError(err, 'list_records'));
        msg.payload = {
          'error': false,
          'errorMsg': '',
        };
        node.send(msg);
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
    this.on('close', function(removed, done) {
      if (removed) {
      // This node has been deleted
      } else {
      // This node is being restarted
      }
      done();
    });
  }
  RED.nodes.registerType('node-red-dreamhost', DreamHostNode, {
    credentials: {
      apiKey: {type: 'text'},
    },
  });
};
