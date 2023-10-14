# Burn2Mint Indexer

Index through the XRPL & Xahau for B2M traffic via rippled & xahaud websocket API. This indexer is serverless and is meant to be hosted 24/7.

> This indexer is  only supports XRP-to-XAH B2M's.

### Installation 

Install nodejs dependencies:
```
npm install
```

### Set up .env file

To copy the default (sample) `.env` file:
```
cp -r .env.sample .env
```

**NOTE**: For testing purposes, you can put any arbitrary ledger index to start from.

`.env` structure:
```
XRPL_CLIENT=XRPL node wss address
XAHAU_CLIENT=Xahau node wss address
XRPL_LEDGER_INDEX=The ledger containing the first Burn tx
XAHAU_LEDGER_INDEX=The ledger in which XahauGenesis went live
```

## Run B2M-indexer

Location: `/src`

To run `B2M-indexer`:
```
node main.js
```

To check B2M stats, run:
```
node stats.js
```