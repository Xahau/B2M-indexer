# Burn2Mint Indexer

Will Index through the XRPL & Xahau ledgers for B2M traffic, URITokens Hooks via configured websocket API.
after indexing through ledgers, it will listen for ongoing transactions.
This indexer is serverless and is meant to be hosted 24/7.

> This indexer supports indexing/logging of XRP burns, XAH Import Mints, URITokens, and basic HookSet/Invoke log.
> Its mainly been tested with MariaDB due to the speed of that DB, sqlite works ok if theres not much action due to "SQL_BUSY" errors


### Installation 

Install nodejs dependencies:
```
npm install
```
this installs and sets up all the packages thats are listed in packages.json

### Set up .env file

To copy the default (sample) `.env` file:
```
cp -r .env.sample .env
```

**NOTE**: For testing purposes, you can put any arbitrary ledger index to start from, the basic setting should get you going.

`.env` file is use to set up the envirment varibles
so it can enable the API, set the API_PORT, choose the Database type etc
the sample .env has been split into section to make it a little clearer

```
#API section
API_ENABLED=true    - to enable or discable the API server
API_PORT=3000       - the API port the server will listen on

#node server section
XRPL_CLIENT=XRPL    - node wss address
XAHAU_CLIENT=Xahau  - node wss address
XRPL_LEDGER_INDEX=  - The ledger containing the first Burn tx
XAHAU_LEDGER_INDEX= - The ledger in which XahauGenesis went live

##database section 
DB_TYPE=sqlite3      - the database type it will use, currently either sqlite, or mariadb

#testnet
DB_HOST=127.1.1.1   - ip/host of the maria db
DB_PORT=25500       - port the db is using
DB_USER=esername    - username of the db
DB_PASS=password    - password of the db
DB_NAME=b2m_testnet - and the database name
``` 

## Run B2M-indexer

all the main programs are in file Location: `/src`

but the coding is setup so that the "working directory" is the root location for eg

To run `B2M-indexer`:
```
node src/main.js
```

To run and check local B2M stats, run:
```
node src/stats.js
```

## API Server
the API server has the same info than the stat.jjs has.
the root, for exmple, if this was your PC's IP, and you kept the default PORT;
>http://192.168.0.1:3000

would give the stats

`/all` gives a list of all accounts and details.

`/account/<address>` allows you to search a single account.

`/history/daily` gives you info split by day, or specify the date `/history/daily/<YYYY-MM-DD>`

`/history/monthly` gives you info split by month, or specify the month `/history/monthly/<YYYY-MM>`

`/uri/<uriTokenID>` allows you to search for a URIToken via its URITokenID
