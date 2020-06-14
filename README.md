# DreamHost DNS Updater for Node Red
A Node to call Dreamhost DNS APIs based on [DreamHost API Client for Node.js](https://www.npmjs.com/package/dreamhost) to update DNS entries of subdomain based on current ip address.

## Usage
The input node receives ip address and updates the DNS Domain with the ip address
`msg.payload` contains the ip address details
  - **payload.publicIPv4** : Public IPv4 Address to use for the domain
  - **payload.publicIPv6** : Public IPv6 Address to use for the domain

Output provides the following information in `msg.payload` 
  - **payload.error** : Boolean value to inform if there was an error
  - **payload.errorMsg** : If there was an error, the error Message, else empty string
  - **payload.updatedIPv4** : If IPv4 was updated
  - **payload.updatedIPv6** : If IPv6 was updated

### Sample Flow
![A Sample Flow](https://raw.githubusercontent.com/mayfounder/node-red-contrib-dreamhostdns-updater/master/examples/DreamhostDNSUpdater.png?raw=true)

This flow uses [node-red-contrib-ip](https://flows.nodered.org/node/node-red-contrib-ip)
