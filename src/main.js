const { Log } = require("../log/logger");
const { XrplClient } = require("xrpl-client");
const dbSetup = require("../db/setup");
const dbManager = require("../db/manager");
const record = require("../db/record");
const dotenv = require("dotenv").config({path:"../.env"});


// ### Spawn a child process to run the API code in a separate thread ###
const { spawn } = require('child_process');
const apiProcessa = spawn('node', ['api.js'], {
  stdio: ['inherit', 'inherit', 'inherit'],
});


// B2M-indexer - Listen & index Burn2Mint transactions on the XRPL & Xahau.

// Please provide a `.env` file. Original copy comes with `.env.sample` for testnet use (for now, until xahau launches).
// XRPL  Network ID; 0
// Xahau Network ID; TBD

// Nodes to connect to (Xahau & XRPL)
var xrplClients = process.env.XRPL_CLIENT;
var xahauClients = process.env.XAHAU_CLIENT;

const clientConfig = {
    assumeOfflineAfterSeconds: 30,
    maxConnectionAttempts: 10,
    connectAttemptTimeoutSeconds: 3,
};

const xrplClient = new XrplClient(xrplClients, clientConfig);
const xahauClient = new XrplClient(xahauClients, clientConfig);

// --- For testing purposes ---
// Testnet: You can just put in a random, but close enough ledger index to not spend too much time indexing through the ledger.
// NOTE: In production, if you don't start from the first ledger(s) that contain the first Burn & Mint tx, the account records will be wrong.

/** The ledger containing the first **Burn** tx */
var ledgerBurn = process.env.XRPL_LEDGER_INDEX;
/** The ledger where XahauGenesis went live */
var ledgerMint = process.env.XAHAU_LEDGER_INDEX;

// Tx stream state
var xrplListener = false;
var xahauListener = false;

var temporaryBurnAccountRecord = {}; 
var temporaryLastSyncedXrplLedger = 0;
var temporaryMintAccountRecord = {}; 
var temporaryLastSyncedXahauLedger = 0;

async function StartXrplListener() {
    if (xrplListener) {
        Log("ERR", "xrplListener is enabled; Do not enable twice"); return false;
    }
    xrplListener = true;
    
    const _subXrplTx = await xrplClient.send({
        "command": "subscribe",
        "streams": ["transactions"]
    });
    
    Log("INF", "Listening to the XRPL for B2M (Burn) traffic");
    
    // XRPL
    xrplClient.on("transaction", async (tx) => {
        if (tx.ledger_index > temporaryLastSyncedXrplLedger && Object.keys(temporaryBurnAccountRecord).length > 0) {
            dbManager.UpdateMiscRecord("lastSyncedXrplLedgerIndex", temporaryLastSyncedXrplLedger);
            for (const [key, value] of Object.entries(temporaryBurnAccountRecord)) {
                delete temporaryBurnAccountRecord[key];
                await record.RecordBurnTx(key, value.amount, value.tx_count, value.date);
            }
        }
        
        if (tx.engine_result === "tesSUCCESS" && tx.transaction.hasOwnProperty("OperationLimit") && !tx.transaction.hasOwnProperty("TicketSequence") && tx.transaction.OperationLimit === 21338) {
            temporaryLastSyncedXrplLedger = tx.ledger_index;
            
            var accountBurnRecord = temporaryBurnAccountRecord[tx.transaction.Account];
            if (accountBurnRecord === undefined) {
                temporaryBurnAccountRecord[tx.transaction.Account] = {
                    amount: parseInt(tx.transaction.Fee),
                    tx_count: 1,
                    date: tx.transaction.date,
                };
            } else {
                temporaryBurnAccountRecord[tx.transaction.Account].amount = accountBurnRecord.amount + parseInt(tx.transaction.Fee);
                temporaryBurnAccountRecord[tx.transaction.Account].tx_count = accountBurnRecord.tx_count + 1;
            }
        }
    });
}

async function StartXahauListener() {
    if (xahauListener) {
        Log("ERR", "xahauListener is enabled; Do not enable twice"); return false; 
    }
    xahauListener = true;
    
    const _subXahauTx = await xahauClient.send({
        "command": "subscribe",
        "streams": ["transactions"]
    });
    
    Log("INF", "Listening to Xahau for B2M (Mint) traffic");
    
    // XAHAU
    xahauClient.on("transaction", async (tx) => {
        if (tx.ledger_index > temporaryLastSyncedXahauLedger && Object.keys(temporaryMintAccountRecord).length > 0) {
            dbManager.UpdateMiscRecord("lastSyncedXahauLedgerIndex", temporaryLastSyncedXahauLedger);
            for (const [key, value] of Object.entries(temporaryMintAccountRecord)) {
                delete temporaryMintAccountRecord[key];
                await record.RecordMintTx(key, value.amount, value.tx_count, value.date, value.newly_funded_account);
            }
        }
        
        if (tx.engine_result === "tesSUCCESS" && tx.transaction.TransactionType === "Import") {
            var newlyFundedAccount = null; 
            var import_amount = null;
            temporaryLastSyncedXahauLedger = tx.ledger_index;
            
            tx.meta.AffectedNodes.forEach(metadata => {
                if (metadata.hasOwnProperty("CreatedNode") && metadata.CreatedNode.LedgerEntryType === "AccountRoot") {
                    newlyFundedAccount = 1;
                    import_amount = parseInt(metadata.CreatedNode.NewFields.Balance);
                }
                if (metadata.hasOwnProperty("ModifiedNode") && metadata.ModifiedNode.LedgerEntryType === "AccountRoot") {
                    newlyFundedAccount = 0;
                    import_amount = parseInt(metadata.ModifiedNode.FinalFields.Balance) - parseInt(metadata.ModifiedNode.PreviousFields.Balance);    
                }
            })
            
            var accountMintRecord = temporaryMintAccountRecord[tx.transaction.Account];
            if (accountMintRecord === undefined) {
                temporaryMintAccountRecord[tx.transaction.Account] = {
                    amount: import_amount,
                    tx_count: 1,
                    date: tx.transaction.date,
                    newly_funded_account: newlyFundedAccount
                };
            } else {
                temporaryMintAccountRecord[tx.transaction.Account].amount = accountMintRecord.amount + import_amount;
                temporaryMintAccountRecord[tx.transaction.Account].tx_count = accountMintRecord.tx_count + 1;
                temporaryMintAccountRecord[tx.transaction.Account].newly_funded_account = newlyFundedAccount;
            }
        }
    });
}

async function main() {
    // Get the current ledger(s) on Xahau & XRPL
    const currentXrplLedgerIndex = await xrplClient.send({
        "command": "ledger_current"
    });
    const currentXahauLedgerIndex = await xahauClient.send({
        "command": "ledger_current"
    });
    
    // Check the last indexed ledger
    let syncedXrplLedgerIndex = await dbManager.GetMiscRecord("lastSyncedXrplLedgerIndex"); 
    let syncedXahauLedgerIndex = await dbManager.GetMiscRecord("lastSyncedXahauLedgerIndex");
    
    if (syncedXahauLedgerIndex === undefined || syncedXrplLedgerIndex === undefined) {
        // Populate these 2 variables with ledger indexes which contains the first burn & mint txs
        dbManager.GenerateMiscRecord("lastSyncedXrplLedgerIndex", ledgerBurn);
        dbManager.GenerateMiscRecord("lastSyncedXahauLedgerIndex", ledgerMint);
    } else {
        // If synced[]LedgerIndex is defined, then it means that we've indexed the ledger in the past and should continue from there.
        syncedXrplLedgerIndex = syncedXrplLedgerIndex.value;
        syncedXahauLedgerIndex = syncedXahauLedgerIndex.value;
    }
    
    ledgerBurn = parseInt(syncedXrplLedgerIndex ?? ledgerBurn);
    ledgerMint = parseInt(syncedXahauLedgerIndex ?? ledgerMint);
    
    // Resync Burn & Import (Mint) transactions
    if (currentXrplLedgerIndex.ledger_current_index > ledgerBurn || currentXahauLedgerIndex.ledger_current_index > ledgerMint) {
        if (currentXrplLedgerIndex.ledger_current_index > ledgerBurn) {
            var xrplDelta = currentXrplLedgerIndex.ledger_current_index - ledgerBurn;
            Log("INF", `Syncing ${xrplDelta} ledgers on the XRPL. This may take some time, DO NOT EXIT.`);
        }
        if (currentXahauLedgerIndex.ledger_current_index > ledgerMint) {
            var xahauDelta = currentXahauLedgerIndex.ledger_current_index - ledgerMint;
            Log("INF", `Syncing ${xahauDelta} ledgers on Xahau. This may take some time, DO NOT EXIT.`);
        }
        
        var burnSyncprogress = 0;
        var mintSyncProgress = 0;
        
        var xrplReqID = 1;
        var xahauReqID = 1;
        
        // Because we're re-syncing with the ledger, we will re-sync until the Last Closed Ledger (essentially meaning that we're fully synced)
        while (ledgerBurn < currentXrplLedgerIndex.ledger_current_index || ledgerMint < currentXahauLedgerIndex.ledger_current_index) {
            // Sync XRPL (Burn)
            if (!xrplListener) {
                const progress = parseInt(xrplReqID / xrplDelta * 100);
                if (progress !== burnSyncprogress && progress <= 100) process.stdout.write(`${progress}% synced with XRPL...\r`); burnSyncprogress = progress;
                
                var xrplLedger = await xrplClient.send({
                    "id": xrplReqID,
                    "command": "ledger",
                    "ledger_index": ledgerBurn + xrplReqID,
                    "transactions": true,
                    "expand": true
                });
                
                try {
                    xrplLedger.ledger.transactions.forEach(async tx => {
                        if (tx.hasOwnProperty("OperationLimit") && !tx.hasOwnProperty("TicketSequence") && tx.OperationLimit === 21338) {
                            var accountBurnRecord = temporaryBurnAccountRecord[tx.Account];
                            if (accountBurnRecord === undefined) {
                                temporaryBurnAccountRecord[tx.Account] = {
                                    amount: parseInt(tx.Fee),
                                    tx_count: 1,
                                    date: xrplLedger.ledger.close_time,
                                };
                            } else {
                                temporaryBurnAccountRecord[tx.Account].amount = accountBurnRecord.amount + parseInt(tx.Fee);
                                temporaryBurnAccountRecord[tx.Account].tx_count = accountBurnRecord.tx_count + 1;
                            }
                        }
                    });
                    
                    if (xrplLedger.validated === true) {
                        for (const [key, value] of Object.entries(temporaryBurnAccountRecord)) {
                            delete temporaryBurnAccountRecord[key];
                            await record.RecordBurnTx(key, value.amount, value.tx_count, value.date);
                        }
                        
                        dbManager.UpdateMiscRecord("lastSyncedXrplLedgerIndex", ledgerBurn + xrplReqID);
                        xrplReqID++;
                    } else if (xrplLedger.error === "lgrNotFound" || xrplLedger.ledger.closed === false) {
                        await StartXrplListener();
                        
                        Log("INF", `Re-synced ${xrplReqID-1} ledgers on the XRPL`);
                        
                        // junky way to stop syncing w/ the network, but it works.
                        ledgerBurn = Infinity;
                    }
                } catch (err) {
                    if (xrplLedger.error === "lgrNotFound" || xrplLedger.ledger.closed === false) {
                        await StartXrplListener();
                        
                        Log("INF", `Re-synced ${xrplReqID-1} ledgers on the XRPL`);
                        
                        // junky way to stop syncing w/ the network, but it works.
                        ledgerBurn = Infinity;
                    } else {
                        Log("ERR", `Re-syncing Error (XRPL): ${err}`);
                        break;
                    }
                }
            }
            
            // Sync Xahau (Mint)
            if (!xahauListener) {
                const progress = parseInt(xahauReqID / xahauDelta * 100);
                if (progress !== mintSyncProgress && progress <= 100) process.stdout.write(`${progress}% synced with Xahau...\r`); mintSyncProgress = progress;
                
                var xahauLedger = await xahauClient.send({
                    "id": xahauReqID,
                    "command": "ledger",
                    "ledger_index": ledgerMint + xahauReqID,
                    "transactions": true,
                    "expand": true
                });
                
                try {
                    xahauLedger.ledger.transactions.forEach(async tx => {
                        if (tx.TransactionType === "Import") {
                            var newlyFundedAccount = null; 
                            var import_amount = null;
                            
                            tx.metaData.AffectedNodes.forEach(metadata => {
                                if (metadata.hasOwnProperty("CreatedNode") && metadata.CreatedNode.LedgerEntryType === "AccountRoot") {
                                    newlyFundedAccount = 1;
                                    import_amount = parseInt(metadata.CreatedNode.NewFields.Balance);
                                }
                                if (metadata.hasOwnProperty("ModifiedNode") && metadata.ModifiedNode.LedgerEntryType === "AccountRoot") {
                                    newlyFundedAccount = 0;
                                    import_amount = parseInt(metadata.ModifiedNode.FinalFields.Balance) - parseInt(metadata.ModifiedNode.PreviousFields.Balance);    
                                }
                            })
                            
                            var accountMintRecord = temporaryMintAccountRecord[tx.Account];
                            if (accountMintRecord === undefined) {
                                temporaryMintAccountRecord[tx.Account] = {
                                    amount: import_amount,
                                    tx_count: 1,
                                    date: xahauLedger.ledger.close_time,
                                    newly_funded_account: newlyFundedAccount
                                };
                            } else {
                                temporaryMintAccountRecord[tx.Account].amount = accountMintRecord.amount + import_amount;
                                temporaryMintAccountRecord[tx.Account].tx_count = accountMintRecord.tx_count + 1;
                            }
                        }
                    });
                    
                    if(xahauLedger.validated === true) {
                        for (const [key, value] of Object.entries(temporaryMintAccountRecord)) {
                            delete temporaryMintAccountRecord[key];
                            await record.RecordMintTx(key, value.amount, value.tx_count, value.date, value.newly_funded_account);
                        }
                        
                        dbManager.UpdateMiscRecord("lastSyncedXahauLedgerIndex", ledgerMint + xahauReqID);
                        xahauReqID++;
                    } else if (xahauLedger.error === "lgrNotFound" || xahauLedger.ledger.closed === false) {
                        await StartXahauListener();
                        
                        Log("INF", `Re-synced ${xahauReqID-1} ledgers on Xahau`);
                        
                        ledgerMint = Infinity;
                    }
                } catch (err) {
                    if (xahauLedger.error === "lgrNotFound" || xahauLedger.ledger.closed === false) {
                        await StartXahauListener();
                        
                        Log("INF", `Re-synced ${xahauReqID-1} ledgers on Xahau`);
                        
                        ledgerMint = Infinity;
                    } else {
                        Log("ERR", `Re-syncing Error (Xahau): ${err}`);
                        break;
                    }
                }
            }
        }
    }
}

main();

// e3c2064ece7e8bbbebb2a06be96607bb560a2ab8314e3ae64a43aaf3d2954830c760ad7ed923ca2ce3303a1bbc9a2e4d26bf177bae5416af0cc157a60dcc82e4
