console.log('API server starting .....');
const express = require('express');
const app = express();
const dbManager = require("../db/manager");
const dotenv = require("dotenv").config({path:"./.env"});

// GET route for stats
app.get('/', async (req, res) => {
    try {
        // get the last indexed ledger, and monthly history record
        var syncedXrplLedgerIndex = await dbManager.db.GetMiscRecord("lastSyncedXrplLedgerIndex"); 
        var syncedXahauLedgerIndex = await dbManager.db.GetMiscRecord("lastSyncedXahauLedgerIndex");
        var data_MonthlyHistoryRecord = await dbManager.db.GetAllHistoryRecord("monthly");
        // setup vars for loop
        var burnt_amount = 0;
        var minted_amount = 0;
        var total_funded_accounts = 0;
        var uritoken_mint_count = 0;
        var uritoken_burn_count = 0;
        var uritoken_buy_count = 0;
        var uritoken_sell_count = 0;
        var hook_count = 0;
        var hookinvoke_count = 0;
        const endpoints = ["/all /account/<r-account> /history/daily /history/monthy /uri/<hash> "];

        //console.log(`setting up -> ${uritoken_mint_count} before.  raw data -> ${JSON.stringify(data_MonthlyHistoryRecord)} `);
        data_MonthlyHistoryRecord.forEach(record => {
            burnt_amount += Number(record.burnt_amount);
            minted_amount += Number(record.minted_amount);
            total_funded_accounts += record.newly_funded_account;
            uritoken_mint_count += record.uritoken_mint_count;
            uritoken_burn_count += record.uritoken_burn_count;
            uritoken_buy_count += record.uritoken_buy_count;
            uritoken_sell_count += record.uritoken_sell_count;
            hook_count += record.hook_count;
            hookinvoke_count += record.hookinvoke_count;
        });

        // create response json
        const response = {
            endpoints_include: endpoints,
            lastSyncedXrplLedgerIndex: syncedXrplLedgerIndex.value,
            lastSyncedXahauLedgerIndex: syncedXahauLedgerIndex.value,
            fundedAccounts: total_funded_accounts,
            burntXRP: burnt_amount / 1000000, // Converted from drops
            mintedXAH: minted_amount / 1000000, // Converted from drops
            unmintedXAH: (burnt_amount - minted_amount) / 1000000, // Converted from drops
            uritoken_mint_count: uritoken_mint_count,
            uritoken_burn_count: uritoken_burn_count,
            uritoken_buy_count: uritoken_buy_count,
            uritoken_sell_count: uritoken_sell_count,
            hook_count: hook_count,
            hookinvoke_count: hookinvoke_count
        };
        console.log(`sent API -> /`);
        // send
        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred while fetching B2M statistics.' });
    }
});

// GET route for retrieving all account records
app.get('/all', async (req, res) => {
    // Code to handle GET request for all account records
    const data_AllAccountRecord = await dbManager.db.GetAllAccountRecord();
    res.json(data_AllAccountRecord);
});

// GET route for retrieving a specific account record by address
app.get('/account/:address', async (req, res) => {
    const accountAddress = req.params.address;
    // Code to handle GET request for a specific account record
    if (accountAddress == "all") { data_AccountRecord = await dbManager.db.GetAllAccountRecord();}
    else { data_AccountRecord = await dbManager.db.GetAccountRecord(accountAddress); }
    res.json(data_AccountRecord);
});

// GET route for retrieving all history records (daily or monthly)
app.get('/history/:tableName', async (req, res) => {
    const tableName = req.params.tableName;
    // Code to handle GET request for all history records (daily or monthly)
    if (tableName !== "daily" && tableName !== "monthly") { dataAllHistoryRecord = "{error: please state daily, or monthly}"; };
    if (tableName == "daily" || tableName == "monthly") { dataAllHistoryRecord = await dbManager.db.GetAllHistoryRecord(tableName); };
    console.log(`sent API -> /history/ res:{JSON.stringify(res)} req:${JSON.stringify(req.params.tableName)} tableName:${tableName} data:${dataAllHistoryRecord}`); 
    res.json(dataAllHistoryRecord);
});

// GET route for retrieving all history records (daily or monthly)
app.get('/uri/:uri', async (req, res) => {
    const uri = req.params.uri;
    // Code to handle GET request for all history records (daily or monthly)
    const data_GetURIRecord = await dbManager.db.GetURIRecord(uri);
    res.json(data_GetURIRecord);
});

// Set the desired port
const port = process.env.API_PORT || 3000;

// Start the Express server
app.listen(port, () => {
    console.log(`API server is now running on port ${port}`);
});
