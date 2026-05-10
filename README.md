# DreamHost DNS Updater for Node Red
A Node to call Dreamhost DNS APIs based on [DreamHost API Client for Node.js](https://www.npmjs.com/package/dreamhost) to update DNS entries of subdomain based on current ip address.

## Usage
On each input message, the node resolves your current public IPv4 and IPv6 addresses using [public-ip](https://github.com/sindresorhus/public-ip), then updates the DreamHost DNS records if they differ.

Optional `msg.payload` fields:

  - **payload.publicIPv4** — If set to a valid IPv4 string, it is used instead of auto-detection for the A record.
  - **payload.publicIPv6** — If set to a valid IPv6 string, it is used instead of auto-detection for the AAAA record.
  - **payload.ipLookupTimeout** — Milliseconds for public IP lookup (default `10000`). Ignored for addresses supplied manually above.

Requires **Node.js 24.15.0** or newer (LTS; see `package.json` `engines`). For local development with [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in this repo; **`.nvmrc`** pins **24.15.0**.

Output provides the following information in `msg.payload` 
  - **payload.error** : Boolean value to inform if there was an error
  - **payload.errorMsg** : If there was an error, the error Message, else empty string
  - **payload.updatedIPv4** : If IPv4 was updated
  - **payload.updatedIPv6** : If IPv6 was updated

### Example Flow
![A Sample Flow](examples/DreamhostDNSUpdater.png?raw=true)

The example flow triggers the Dreamhost node on a timer; public IPs are resolved inside the node (no separate IP discovery node required).
