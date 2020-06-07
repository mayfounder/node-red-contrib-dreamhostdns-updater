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
			/*
			node.status({fill:"yellow",shape:"ring",text:"Updating..."});
			for(i = 0; i < records.length; i++) {
				var r = records[i];
				if(r.type == "A" && r.value != node.publicIPv4) {
					node.log("Updating IPv4 Record");
				}
				if(r.type == "AAAA" && r.value != node.publicIPv6) {
					node.log("Updating IPv6 Record");
				}
			}
			node.status({fill:"green",shape:"dot",text:"OK"});
			return Promise.resolve();
			*/
		};
		var connectionError = function(err) {
			node.error("Error Connecting to Dreamhost: " + JSON.stringify(err)));
			this.status({fill:"red",shape:"ring",text:"Error Connecting to Dreamhost"});
		};
		var checkRecords = function(records) {
			this.status({fill:"green",shape:"dot",text:"OK"});
			var recordsToUpdate = [];
			for(var i = 0; i < records.length; i++) {
				/*
				var r = records[i];
				var foundIPv4 = false;
				var foundIPv6 = false;
				if(r.editable != "0") {
					if(r.zone == node.domain && r.record == node.record) {
						node.log(JSON.stringify(r));
						if(r.type == "A") {
							foundIPv4 = true;
							if(r.value != node.publicIPv4) {
								recordsToUpdate.push(r);
							}
						}
						if(r.type == "AAAA") {
							foundIPv6 = true;
							if(r.value != node.publicIPv6) {
								recordsToUpdate.push(r);
							}
						}
					}
				}
				if(!foundIPv4 || !foundIPv6 || recordsToUpdate.length != 0) {
					// updateRecords(recordsToUpdate);
				}
			*/
			}
		};
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
			if(node.publicIPv4 || node.publicIPv6) {
				node.debug("Payload: " + JSON.stringify(msg.payload));
				node.debug("Domain: " + node.domain + " Subdomain: " + node.subdomain + " API Key:" + node.apiKey);
				/*
				dh.dns.listRecords()
					.then(checkRecords)
					.catch(connectionError);
				*/
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
