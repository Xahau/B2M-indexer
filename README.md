# Burn2Mint Indexer

Index through the XRPL & Xahau for B2M traffic via rippled & xahaud websocket API.

### Installation 

Install nodejs dependencies:
```
npm install
```

### Set up .env file

`.env` structure:
```
XRPL_CLIENT=XRPL node wss address
XAHAU_CLIENT=Xahau node wss address
XRPL_LEDGER_INDEX=The ledger containing the first Burn tx
XAHAU_LEDGER_INDEX=The ledger in which XahauGenesis went live
```

**NOTE**: For testing purposes, you can put any arbitrary ledger index to start from.

To copy the default (sample) `.env` file:
```
cp -r .env.sample .env
```

## Run B2M-indexer

```
cd src
```

To run `B2M-indexer`:
```
node main.js
```

To check B2M stats based on your indexer's DB, run:
```
node stats.js
```