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
XRPL_CLIENT="XRPL node wss address" || string
XAHAU_CLIENT="Xahau node wss address" || string
XRPL_LEDGER_INDEX="The ledger containing the first Burn tx" || integer
XAHAU_LEDGER_INDEX="The ledger in which XahauGenesis went live" || integer
```

**NOTE**: For testing purposes, you can put any arbitrary ledger index to start from.

To copy the default (sample) `.env` file:
```
cp -r .env.sample .env
```

## Run B2M-indexer

To run `B2M-indexer`:
```
node main.js
```

To check B2M stats based on your indexer's DB, run:
```
node stats.js
```