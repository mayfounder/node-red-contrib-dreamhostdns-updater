module.exports = function(RED) {
	function DreamHostNode(config) {
	  const isIp = require('is-ip');
		const DreamHost = require('dreamhost');
		RED.nodes.createNode(this,config);
		this.domain = config.domain;
		this.subdomain = config.subdomain;
		this.record = this.subdomain + "." + this.domain;
		this.apiKey = this.credentials.apiKey;
		var node = this;
		var updateRecords = function(records) {
			node.status({fill:"yellow",shape:"ring",text:"Updating..."});
			node.log("Updating records: " + JSON.stringify(records));
			if(records.ipv4) {
				node.log("Updating IPv4 Record");
			}
			if(records.ipv6) {
				node.log("Updating IPv6 Record");
			}
			node.status({fill:"green",shape:"dot",text:"OK"});
			return Promise.resolve();
		}
		var connectionError = function(err) {
			node.error("Error Connecting to Dreamhost: " + JSON.stringify(err));
			node.status({fill:"red",shape:"ring",text:"Error Connecting to Dreamhost"});
		}
		var genIPv6Record = function(r) {
			if(r) {
				return {
					"record": r.record,
					"type": r.type,
					"value": node.publicIPv6,
					"comment": r.comment,
				}
			} else {
				return {
					"record": node.record, 
					"type": "AAAA", 
					"value": node.publicIPv6,
					"commment": node.record + " IPv6",
				}
			}
		};
		var genIPv4Record = function(r) {
			if(r) {
				return {
					"record": r.record,
					"type": r.type,
					"value": node.publicIPv4,
					"comment": r.comment,
				}
			} else {
				return {
					"record": node.record, 
					"type": "A", 
					"value": node.publicIPv4,
					"commment": node.record + " IPv4",
				}
			}
		};
		var checkRecords = function(records) {
			node.status({fill:"green",shape:"dot",text:"OK"});
			var newRecords = {};
			var foundIPv4 = false;
			var foundIPv6 = false;
			for(var i = 0; i < records.length; i++) {
				var r = records[i];
				if(r.editable == "1" && 
						r.zone == node.domain && 
						r.record == node.record) {
					if(r.type == "A") {
						foundIPv4 = true;
						if(r.value != node.publicIPv4 && node.publicIPv4 != null) {
							node.log("IPv4 Mistmatched");
							newRecords.ipv4 = genIPv4Record(r);
						}
					}
					if(r.type == "AAAA") {
						foundIPv6 = true;
						if(r.value != node.publicIPv6 && node.publicIPv6 != null) {
							node.log("IPv6 Mistmatched");
							newRecords.ipv6 = genIPv6Record(r);
						}
					}
				}
			}
			if(!foundIPv4 && node.publicIPv4 != null) { 
				node.log("IPv4 Record Not Found");
				newRecords.ipv4 = genIPv4Record(null);
			}
			if(!foundIPv6 && node.publicIPv6 != null) {
				node.log("IPv6 Record Not Found");
				newRecords.ipv6 = genIPv6Record(null);
			}
			if(newRecords.ipv6 || newRecords.ipv4) {
				updateRecords(newRecords);
			}
		}
		node.on('input', function(msg) {
			node.publicIPv4 = null;
			node.publicIPv6 = null;
			var dh = new DreamHost({
				key: node.apiKey
			});
			if(msg.payload.publicIPv4) {
				if(isIp(msg.payload.publicIPv4)) {
					node.publicIPv4 = msg.payload.publicIPv4;
				}
			}
			if(msg.payload.publicIPv6) {
				if(isIp(msg.payload.publicIPv6)) {
					node.publicIPv6 = msg.payload.publicIPv6.toUpperCase();
				}
			}
			if(node.publicIPv4 != null || node.publicIPv6 != null) {
				node.debug("Payload: " + JSON.stringify(msg.payload));
				node.debug("Domain: " + node.domain + " Subdomain: " + node.subdomain + " API Key:" + node.apiKey);
				dh.dns.listRecords()
					.then(checkRecords)
					.catch(connectionError);
			} else {
				node.warn("No IP Addresses found in payload: " + JSON.stringify(msg.payload));
			}
			node.send(msg);
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
	RED.nodes.registerType("node-red-dreamhost",DreamHostNode, {
		credentials: {
			apiKey: {type:"text"},
		}
	});
}
