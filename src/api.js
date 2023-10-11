console.log('API server starting .....');
const express = require('express');
const app = express();
const dbManager = require("../db/manager");
const dotenv = require("dotenv").config({path:"./.env"});

// GET route for stats
app.get('/', async (req, res) => {
    try {
        // get the last indexed ledger, and monthly history record
        var syncedXrplLedgerIndex = await dbManager.GetMiscRecord("lastSyncedXrplLedgerIndex"); 
        var syncedXahauLedgerIndex = await dbManager.GetMiscRecord("lastSyncedXahauLedgerIndex");
        var data_MonthlyHistoryRecord = await dbManager.GetAllAccountRecord("monthly");
        // setup vars for loop
        var burnt_amount = 0;
        var minted_amount = 0;
        var total_funded_accounts = 0;
        data_MonthlyHistoryRecord.forEach(record => {
            burnt_amount += record.burnt_amount;
            minted_amount += record.minted_amount;
            total_funded_accounts += record.newly_funded_account;
        });
        // create response json
        const response = {
            lastSyncedXrplLedgerIndex: syncedXrplLedgerIndex.value,
            lastSyncedXahauLedgerIndex: syncedXahauLedgerIndex.value,
            fundedAccounts: total_funded_accounts,
            burntXRP: burnt_amount / 1000000, // Converted from drops
            mintedXAH: minted_amount / 1000000, // Converted from drops
            unmintedXAH: (burnt_amount - minted_amount) / 1000000, // Converted from drops
        };
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
    const data_AllAccountRecord = await dbManager.GetAllAccountRecord();
    res.json(data_AllAccountRecord);
});

// GET route for retrieving a specific account record by address
app.get('/account/:address', async (req, res) => {
    const accountAddress = req.params.address;
    // Code to handle GET request for a specific account record
    const data_AccountRecord = await dbManager.GetAccountRecord(accountAddress);
    res.json(data_AccountRecord);
});

// GET route for retrieving all history records (daily or monthly)
app.get('/history/:tableName', async (req, res) => {
    const tableName = req.params.tableName;
    // Code to handle GET request for all history records (daily or monthly)
    const data_AllHistoryRecord = await dbManager.GetAllHistoryRecord(tableName);
    res.json(data_AllHistoryRecord);
});

// Set the desired port
const port = process.env.PORT || 3000;

// Start the Express server
app.listen(port, () => {
    console.log(`API server is now running on port ${port}`);
});
