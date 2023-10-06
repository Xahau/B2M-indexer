const dbSetup = require("./db/setup");
const { XrplClient } = require("xrpl-client");

const dbManager = require("./db/manager");
const record = require("./db/record.js");
const { Log } = require("./log/logger.js");

const dotenv = require("dotenv");
dotenv.config();

// B2M-indexer - Listen & index Burn2Mint transactions on the XRPL & Xahau.

// Please provide a `.env` file. Original copy comes with `.env.sample` for testnet use (for now, until xahau launches).
// XRPL  Network ID; 0
// Xahau Network ID; TBD

// Nodes to connect to (Xahau & XRPL)
const xrplClients = [process.env.XRPL_CLIENT];
const xahauClients = [process.env.XAHAU_CLIENT];

const clientConfig = {
    assumeOfflineAfterSeconds: 10,
    maxConnectionAttempts: 3,
    connectAttemptTimeoutSeconds: 3,
};

const xrplClient = new XrplClient(xrplClients, clientConfig);
const xahauClient = new XrplClient(xahauClients, clientConfig);

// --- For testing purposes ---
// Testnet: You can just put in a random, but close enough ledger index to not spend too much time indexing through the ledger.
// NOTE: In production, if you don't start from the first ledger(s) that contain the first Burn & Mint tx, the account records will be wrong.
/** The ledger containing the first **Burn** tx */
var ledgerBurn = 41790000;
/** The ledger containing the first **Mint** tx */
var ledgerMint = 7159000;

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
            for (const [key, value] of Object.entries(temporaryBurnAccountRecord)) {
                delete temporaryBurnAccountRecord[key];
                await record.RecordBurnTx(key, value.amount, value.tx_count, value.date);
            }
        }
        
        if (tx.engine_result === "tesSUCCESS" && tx.transaction.hasOwnProperty("OperationLimit") && !tx.transaction.hasOwnProperty("TicketSequence") && tx.transaction.OperationLimit === 21338) {
            dbManager.UpdateMiscRecord("lastSyncedXrplLedgerIndex", tx.ledger_index);
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
            for (const [key, value] of Object.entries(temporaryMintAccountRecord)) {
                delete temporaryMintAccountRecord[key];
                await record.RecordMintTx(key, value.amount, value.tx_count, value.date, value.newly_funded_account);
            }
        }
        
        if (tx.engine_result === "tesSUCCESS" && tx.transaction.TransactionType === "Import") {
            if (tx.meta.AffectedNodes[0].hasOwnProperty("CreatedNode")) {
                var newlyFundedAccount = 1;
                var import_amount = parseInt(tx.meta.AffectedNodes[0].CreatedNode.NewFields.Balance);
            } else {
                var newlyFundedAccount = 0;
                var import_amount = parseInt(tx.meta.AffectedNodes[0].ModifiedNode.FinalFields.Balance);
            }
            
            dbManager.UpdateMiscRecord("lastSyncedXahauLedgerIndex", tx.ledger_index);
            temporaryLastSyncedXahauLedger = tx.ledger_index;
            
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
        
        var xrplReqID = 0;
        var xahauReqID = 0;
        
        // we blindly add `[]delta` to the equation because it'll take us some time to index the entire thing (from currentXrplLedgerIndex.ledger_current_index)
        // until we receive a malformed result, we just yolo it. LGTM but please feel free to suggest improvements.
        while (ledgerBurn + xrplReqID <= currentXrplLedgerIndex.ledger_current_index + xrplDelta || ledgerMint + xahauReqID <= currentXahauLedgerIndex.ledger_current_index + xahauDelta) {
            // Sync XRPL (Burn)
            if (ledgerBurn + xrplReqID <= currentXrplLedgerIndex.ledger_current_index + xrplDelta) {
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
                    
                    for (const [key, value] of Object.entries(temporaryBurnAccountRecord)) {
                        await record.RecordBurnTx(key, value.amount, value.tx_count, value.date);
                        delete temporaryBurnAccountRecord[key];
                    }
                    
                    dbManager.UpdateMiscRecord("lastSyncedXrplLedgerIndex", ledgerBurn + xrplReqID);
                    xrplReqID++;
                } catch (err) {
                    if (xrplLedger.error === "lgrNotFound" && !xrplListener) {
                        Log("INF", `Re-synced ${xrplReqID} ledgers on the XRPL`);
                        
                        await StartXrplListener();
                        
                        // junky way to stop syncing w/ the network, but it works.
                        ledgerBurn = Infinity;
                    } else {
                        Log("ERR", `Re-syncing Error (XRPL): ${err}`);
                    }
                }
            }
            
            // Sync Xahau (Mint)
            if (ledgerMint + xahauReqID  <= currentXrplLedgerIndex.ledger_current_index + xahauDelta) {
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
                            if (tx.metaData.AffectedNodes[0].hasOwnProperty("CreatedNode")) {
                                var newlyFundedAccount = 1;
                                var import_amount = parseInt(tx.metaData.AffectedNodes[0].CreatedNode.NewFields.Balance);
                            } else {
                                var newlyFundedAccount = 0;
                                var import_amount = parseInt(tx.metaData.AffectedNodes[0].ModifiedNode.FinalFields.Balance);
                            }
                            
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
                    
                    for (const [key, value] of Object.entries(temporaryMintAccountRecord)) {
                        await record.RecordMintTx(key, value.amount, value.tx_count, value.date, value.newly_funded_account);
                        delete temporaryMintAccountRecord[key];
                    }
                    
                    dbManager.UpdateMiscRecord("lastSyncedXahauLedgerIndex", ledgerMint + xahauReqID);
                    xahauReqID++;
                } catch (err) {
                    if (xahauLedger.error === "lgrNotFound" && !xahauListener) {
                        Log("INF", `Re-synced ${xahauReqID} ledgers on Xahau`);
                        
                        await StartXahauListener();
                        
                        // junky way to stop
                        ledgerMint = Infinity;
                    } else {
                        Log("ERR", `Re-syncing Error (Xahau): ${err}`);
                    }
                }
            }
        }
    }
    
    // After we've re-synced with both ledgers, we'll start listening to the transaction stream.
    if (!xrplListener) await StartXrplListener();
    if (!xahauListener) await StartXahauListener();
}

main();

// e3c2064ece7e8bbbebb2a06be96607bb560a2ab8314e3ae64a43aaf3d2954830c760ad7ed923ca2ce3303a1bbc9a2e4d26bf177bae5416af0cc157a60dcc82e4