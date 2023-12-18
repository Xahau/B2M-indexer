// B2M-indexer - Listen & index Burn2Mint transactions on the XRPL & Xahau.

// Please provide a `.env` file. Original copy comes with `.env.sample` for testnet use (for now, until xahau launches).
// XRPL  Network ID; 0
// Xahau Network ID; TBD
// --- For testing purposes ---
// Testnet: You can just put in a random, but close enough ledger index to not spend too much time indexing through the ledger.
// NOTE: In production, if you don't start from the first ledger(s) that contain the first Burn & Mint tx, the account records will be wrong.


const { Log } = require("../log/logger");
const dotenv = require("dotenv").config({path:"./.env"});

const dbSetup = require("../db/setup");
const dbManager = require("../db/manager");
const { XrplClient } = require("xrpl-client");

// ### Spawn a child process to run the API code in a separate thread (if enabled in .env file)
const API_ENABLED = [ process.env.API_ENABLED ]
if (API_ENABLED == "true") {
    const { spawn } = require('child_process');
    const { stringify } = require("querystring");
    const apiProcessa = spawn('node', ['src/api.js'], {
    stdio: ['inherit', 'inherit', 'inherit'],
    });
} else {Log("WRN",` ** API server disabled (enable via .env)`)}



// Nodes to connect to (Xahau & XRPL)
const xrplClients = [process.env.XRPL_CLIENT];
const xahauClients = [process.env.XAHAU_CLIENT];
const clientConfig = {
    assumeOfflineAfterSeconds: 30,
    maxConnectionAttempts: 10,
    connectAttemptTimeoutSeconds: 5,
};
const xrplClient = new XrplClient(xrplClients, clientConfig);
const xahauClient = new XrplClient(xahauClients, clientConfig);


/** The ledger containing the first **Burn** tx */
var ledgerBurn = process.env.XRPL_LEDGER_INDEX;
/** The ledger where XahauGenesis went live */
var ledgerMint = process.env.XAHAU_LEDGER_INDEX;

// other var setups for loops etc 
var xrplListener = false;
var xahauListener = false;

var temporaryBurnAccountRecord = {}; 
var temporaryLastSyncedXrplLedger = 0;
var temporaryMintAccountRecord = {}; 
var temporaryURITokenRecord = {};
var temporaryHooksRecord = {};
var temporaryLastSyncedXahauLedger = 0;

// MAIN proccesing function for Xahau 
async function processXahauTransactions(xahauLedger, ledger, ledgerID) {
    
    try {
        for (const tx of xahauLedger.ledger.transactions) {
            // establish a common tx.meta location
            if(tx.metaData) {
                tx.meta = tx.metaData;
                delete tx.metaData;
            }

            // Import detection
            if (tx.TransactionType === "Import" && (tx.meta.TransactionResult === "tesSUCCESS" || tx.engine_result === "tesSUCCESS")) {
                var newlyFundedAccount = 0;
                var import_amount = null;
                
                tx.meta.AffectedNodes.forEach(meta => {
                    if (meta.hasOwnProperty("CreatedNode") && meta.CreatedNode.LedgerEntryType === "AccountRoot") {
                        newlyFundedAccount = 1;
                        import_amount = parseInt(meta.CreatedNode.NewFields.Balance);
                    }
                    if (meta.hasOwnProperty("ModifiedNode") && meta.ModifiedNode.LedgerEntryType === "AccountRoot") {
                        import_amount = (parseInt(meta.ModifiedNode.FinalFields.Balance) + parseInt(tx.Fee)) - parseInt(meta.ModifiedNode.PreviousFields.Balance ?? meta.ModifiedNode.FinalFields.Balance);
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
                    temporaryMintAccountRecord[tx.transaction.Account].newly_funded_account = newlyFundedAccount;
                }
            }

            // URITokenMint detection
            if (tx.TransactionType === "URITokenMint" && (tx.meta.TransactionResult === "tesSUCCESS" || tx.engine_result === "tesSUCCESS")) {
                //cyle through tx to get the URITokenID, so we can capture the new owner of int (just in case of mint on behalf of another account?)
                if (tx.meta && tx.meta.AffectedNodes) {
                    for (let node of tx.meta.AffectedNodes) {
                        if (node.CreatedNode && node.CreatedNode.LedgerEntryType === 'URIToken') {
                            var mintAccount = node.CreatedNode.NewFields.Owner;
                            var URITokenID = node.CreatedNode.LedgerIndex;                                         
                        }                                        
                    }
                }
                //Log("INF",`txURIToken setup: ${txURIToken}`);
                var uriTokenRecord = temporaryURITokenRecord[mintAccount];
                if (uriTokenRecord === undefined) {
                    temporaryURITokenRecord[mintAccount] = {
                        uritokenmint: [ { count: 1, details: { URITokenID: [ URITokenID ], URI: [ tx.URI ] } }, ], totalmintcount: 1,
                        uritokenburn: { count: 0, URITokenID: [] },
                        uritokenbuy: [ { count: 0, details: { URITokenID: [], URI: [], sellAccount: [] } }, ], totalbuycount: 0,
                        uritokensell: [ { count: 0, details: { URITokenID: [], URI: [], buyAccount: [] } }, ], totalsellcount: 0,
                        hash: tx.hash,
                        date: xahauLedger.ledger.close_time
                    };
                } else {
                    temporaryURITokenRecord[tx.Account].totalmintcount = uriTokenRecord.totalmintcount + 1;
                    temporaryURITokenRecord[tx.Account].uritokenmint.push({ count: temporaryURITokenRecord[tx.Account].totalmintcount, details: { URITokenID: [ URITokenID ], URI: [ tx.URI ] } });
                }
            }

            // URITokenBurn detection
            if (tx.TransactionType === "URITokenBurn" && (tx.meta.TransactionResult === "tesSUCCESS" || tx.engine_result === "tesSUCCESS")) {
                var uriTokenRecord = temporaryURITokenRecord[tx.Account];
                if (uriTokenRecord === undefined) {
                    temporaryURITokenRecord[tx.Account] = {
                        uritokenmint:  [ { count: 0, details: { URITokenID: [], URI: [] } }, ], totalmintcount: 0,
                        uritokenburn: { count: 1, URITokenID: [ tx.URITokenID ] },
                        uritokenbuy: [ { count: 0, details: { URITokenID: [], URI: [], sellAccount: [] } }, ], totalbuycount: 0,
                        uritokensell: [ { count: 0, details: { URITokenID: [], URI: [], buyAccount: [] } }, ], totalsellcount: 0,
                        hash: tx.hash,
                        date: xahauLedger.ledger.close_time
                    };
                } else {
                    temporaryURITokenRecord[tx.Account].uritokenburn.count = uriTokenRecord.uritokenburn.count + 1;
                    temporaryURITokenRecord[tx.Account].uritokenburn.URITokenID.push(tx.URITokenID);
                }
            }

            // URITokenBuy detection
            if (tx.TransactionType === "URITokenBuy" && (tx.meta.TransactionResult === "tesSUCCESS" || tx.engine_result === "tesSUCCESS")) {
                //get the bbuyers AND the sellers account
                //tx.meta.AffectedNodes.ModifiedNode.FinalFields.Owner = buyer
                //tx.meta.AffectedNodes.ModifiedNode.PreviousFields.Owner = seller
                if (tx.meta && tx.meta.AffectedNodes) {
                    for (let node of tx.meta.AffectedNodes) {
                        if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === 'URIToken') {
                            var buyAccount = node.ModifiedNode.FinalFields.Owner;
                            var sellAccount = node.ModifiedNode.PreviousFields.Owner;
                            var URI = node.ModifiedNode.FinalFields.URI; 
                        }                                        
                    }
                }
                //Log("INF",`URITokenBuy -> URITokenID:${tx.URITokenID} URI:${URI} Buyer:${buyAccount} Seller:${sellAccount}`);

                // buy section
                var uriTokenRecord = temporaryURITokenRecord[buyAccount];
                if (uriTokenRecord === undefined) {
                    temporaryURITokenRecord[buyAccount] = {
                        uritokenmint:  [ { count: 0, details: { URITokenID: [], URI: [] } }, ], totalmintcount: 0,
                        uritokenburn: { count: 0, URITokenID: [] },
                        uritokenbuy:  [ { count: 1, details: { URITokenID: [ tx.URITokenID ], URI: [ URI ], sellAccount: sellAccount } }, ], totalbuycount: 1,
                        uritokensell: [ { count: 0, details: { URITokenID: [], URI: [], buyAccount: [] } }, ], totalsellcount: 0,
                        hash: tx.hash,
                        date: xahauLedger.ledger.close_time
                    };
                } else {
                    temporaryURITokenRecord[buyAccount].totalbuycount = uriTokenRecord.totalbuycount + 1;
                    temporaryURITokenRecord[buyAccount].uritokenbuy.push({ count: temporaryURITokenRecord[buyAccount].totalbuycount, details: { URITokenID: [ tx.URITokenID ], URI: [ URI ], sellAccount: sellAccount } });
                }
                
                //sell section
                var uriTokenRecord = temporaryURITokenRecord[sellAccount];
                if (uriTokenRecord === undefined) {
                    temporaryURITokenRecord[sellAccount] = {
                        uritokenmint: [ { count: 0, details: { URITokenID: [], URI: [] } }, ], totalmintcount: 0,
                        uritokenburn: { count: 0, URITokenID: [] },
                        uritokenbuy: [ { count: 0, details: { URITokenID: [], URI: [], sellAccount: [] } }, ], totalbuycount: 0,
                        uritokensell: [ { count: 1, details: { URITokenID: [ tx.URITokenID ] , URI: [ URI ], buyAccount: buyAccount } }, ], totalsellcount: 1,
                        hash: tx.hash,
                        date: xahauLedger.ledger.close_time
                    };
                } else {
                    temporaryURITokenRecord[sellAccount].totalsellcount = uriTokenRecord.totalsellcount + 1;
                    temporaryURITokenRecord[sellAccount].uritokensell.push({ count: temporaryURITokenRecord[sellAccount].totalsellcount, details: { URITokenID: [ tx.URITokenID ] , URI: [ URI ], buyAccount: buyAccount } });
                }
            }
            
            // SetHook detection
            if (tx.TransactionType === "SetHook" && (tx.meta.TransactionResult === "tesSUCCESS" || tx.engine_result === "tesSUCCESS")) {
                // cyle through tx to get the HookDefinition, so we can capture all the main hook info
                // this needs refining to pick when they are "minted", when they are updated, when deleted etc and then updated accordingingly using the hookNameSpace as the identifier,
                // also include other data to be parsed/updated, including adding many hooks in one TX,
                // icluding parsing of tx.Hooks.Hook (and cycle through) fully too
                if (tx.meta && tx.meta.AffectedNodes) {
                    for (let node of tx.meta.AffectedNodes) {
                        if (node.CreatedNode && node.CreatedNode.LedgerEntryType === 'HookDefinition') {
                            var HookNamespace = node.CreatedNode.NewFields.HookNamespace;
                            var HookHash = node.CreatedNode.NewFields.HookHash;
                            var HookSetTxnID = node.CreatedNode.NewFields.HookSetTxnID;
                            var HookOn = node.CreatedNode.NewFields.HookOn;
                            if (HookOn == undefined) { HookOn = "0000000000000000000000000000000000000000000000000000000000000000" }

                            var HooksRecord = temporaryHooksRecord[tx.Account];
                            if (uriTokenRecord === undefined) {
                                temporaryHooksRecord[tx.Account] = {
                                    HookNamespace: [ HookNamespace ],
                                    HookHash: HookHash,
                                    HookSetTxnID: HookSetTxnID,
                                    HookOn: HookOn,
                                    hookcount: 1,
                                    hookinvokecount: 0,
                                    hash: tx.hash,
                                    date: xahauLedger.ledger.close_time
                                };
                            } else {
                                temporaryHooksRecord[tx.Account].hookcount = HooksRecord.hookcount + 1;
                                temporaryHooksRecord[tx.Account].HookNameSpace.push( [ tx.HookNamespace ] );
                            }
                        }                                        
                    }
                }
                
            }
            
            // (Hooks)Invoke detection
            if (tx.TransactionType === "Invoke" && (tx.meta.TransactionResult === "tesSUCCESS" || tx.engine_result === "tesSUCCESS")) {           
                //this also need to be added with info from the correct place, looping through like Hookset etc     
                var HooksRecord = temporaryHooksRecord[tx.Account];
                if (uriTokenRecord === undefined) {
                    temporaryHooksRecord[tx.Account] = {
                        HookNamespace: [],
                        HookSetTxnID: [ tx.hash ],
                        hookcount: 0,
                        hookinvokecount: 1,
                        hash: tx.hash,
                        date: xahauLedger.ledger.close_time
                    };
                } else {
                    temporaryHooksRecord[tx.Account].hookinvokecount = HooksRecord.hookinvokecount + 1;
                }
            }

        }
        
        if (Object.keys(temporaryMintAccountRecord).length !== 0) {
            for (const [key, value] of Object.entries(temporaryMintAccountRecord)) {
                delete temporaryMintAccountRecord[key];
                await dbManager.RecordMintTx(key, value.amount, value.tx_count, value.date, value.newly_funded_account);
            }
        }

        if (Object.keys(temporaryURITokenRecord).length !== 0) {
            for (const [key, value] of Object.entries(temporaryURITokenRecord)) {   
                // Log("INF", `processing temporaryURITokenRecord -> temp:${JSON.stringify(temporaryURITokenRecord)} mint:${value.uritokenmint}`);                             
                delete temporaryURITokenRecord[key];
                await dbManager.RecordURIToken(key, value.totalmintcount, value.uritokenburn.count, value.totalbuycount, value.totalsellcount, value.date);

                // process Mint
                if (value.totalmintcount > 0) {
                    //Log("INF", `processing uritokenmint before addURIToken -> no[]:${value.uritokenmint.uri} [0]:${value.uritokenmint.uri[0]} and [1]:${value.uritokenmint.uri[1]}`);
                    for (const item of value.uritokenmint) {
                        //Log("INF",`uritokenmint loop Count:${item.count} --> key:${key} URITokenID:${item.details.URITokenID} URI: ${item.details.URI}`);
                        await dbManager.db.URITokensAdd(key, item.details.URITokenID, item.details.URI, value.hash);                        
                    }                        
                    Log("INF", `processed ${value.totalmintcount} uritokenmint(s) successfully (URITokens Minted ${ value.uritokenmint.map(item => item.details.URITokenID) })`);
                }

                // process Burn
                if (value.uritokenburn.count > 0) {
                    // Log("INF",`processing ${value.uritokenburn.count}:uritokenburn -> URITokens:${value.uritokenburn.URITokenID} removed from ${key} successfully`);
                    await dbManager.db.URITokensRemove(key, value.uritokenburn.URITokenID);
                    Log("INF", `processed ${value.totalmintcount} uritokenburn(s) successfully (URITokens Burnt ${ value.uritokenburn.URITokenID })`);                  
                }

                // process Buy
                if (value.totalbuycount > 0) {
                    //Log("INF", `processing ${value.totalbuycount}:uritokenbuys ${JSON.stringify(value.uritokenbuy)}`);
                    for (const item of value.uritokenbuy) {
                        //Log("INF",`uritokenbuy loop Count:${item.count} --> key:${key} URITokenID:${JSON.stringify(item)} value:${JSON.stringify(value.uritokenbuy)}`);
                        await dbManager.db.URITokensAdd(key, item.details.URITokenID, item.details.URI, value.hash);                        
                    }
                    Log("INF", `processed ${value.totalbuycount}:uritokenbuys, successfully (sold by ${value.uritokenbuy.map(item => item.details.sellAccount)})`);
                }

                // process Sell
                if (value.totalsellcount > 0) {
                    //Log("INF", `processing ${value.uritokensell.totalCount}:uritokenbuys uritokensell:${JSON.stringify(value.uritokensell)}`);
                    for (const item of value.uritokensell) {
                        //Log("INF",`uritokensell loop Count:${item.count} --> key:${key} URITokenID:${item.details.URITokenID} URI:${item.details.URI}`);
                        await dbManager.db.URITokensRemove(key, item.details.URITokenID, item.details.URI, value.hash);
                    }
                    Log("INF", `processed ${value.totalsellcount}:uritokensells, successfully (brought by ${value.uritokensell.map(item => item.details.buyAccount)})`);
                }
            }
        }

        if (Object.keys(temporaryHooksRecord).length !== 0) {
            for (const [key, value] of Object.entries(temporaryHooksRecord)) {
                await dbManager.RecordHooks(key, value.hookcount, value.hookinvokecount, value.date);
                // Log("INF", `processing temporaryHooksRecord -> temp:${JSON.stringify(temporaryHooksRecord)} hooksrecord:${HooksRecord}`);
                delete temporaryHooksRecord[key];
                await dbManager.db.RecordHookSet(key, value.HookNamespace, value.HookSetTxnID, value.HookOn, value.hash, value.date);
                Log("INF", `processed ${value.hookcount}:hooksets ${value.hookinvokecount}:hookinvoke successfully (HookHash ${value.Hash})`);
            }
            
        }

        dbManager.db.UpdateMiscRecord("lastSyncedXahauLedgerIndex", ledger + ledgerID);
        // xahauReqID++;  //to be removed or ledgerID++ ?
    } catch (err) {
        Log("ERR", `Re-syncing Error (Xahau): ${err}`);
        throw err;
    }  
}

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
        if (Object.keys(temporaryBurnAccountRecord).length > 0 && tx.ledger_index > temporaryLastSyncedXrplLedger) {
            dbManager.db.UpdateMiscRecord("lastSyncedXrplLedgerIndex", temporaryLastSyncedXrplLedger);
            for (const [key, value] of Object.entries(temporaryBurnAccountRecord)) {
                delete temporaryBurnAccountRecord[key];
                await dbManager.RecordBurnTx(key, value.amount, value.tx_count, value.date);
            }
        }
        
        if (tx.transaction.hasOwnProperty("OperationLimit") && !tx.transaction.hasOwnProperty("TicketSequence") && tx.transaction.OperationLimit === 21337) {
            if (tx.engine_result === "tesSUCCESS" || tx.engine_result.substr(0, 3) === "tec") {
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
        }
    });
}

async function StartXahauListener() {
    if (xahauListener) {
        Log("ERR", "xahauListener is enabled; Do not enable twice"); return false; 
    }
    xahauListener = true;
    
    const subXahauLedger = await xahauClient.send({
        "command": "subscribe",
        "streams": ["transactions"]
    });
    
    Log("INF", "Listening to Xahau for B2M (Mint) traffic");
    
    // XAHAU
    xahauClient.on("transaction", async (tx) => {

        if (Object.keys(temporaryMintAccountRecord).length > 0 && tx.ledger_index > temporaryLastSyncedXahauLedger) {
            dbManager.db.UpdateMiscRecord("lastSyncedXahauLedgerIndex", temporaryLastSyncedXahauLedger);
            for (const [key, value] of Object.entries(temporaryMintAccountRecord)) {
                delete temporaryMintAccountRecord[key];
                await dbManager.RecordMintTx(key, value.amount, value.tx_count, value.date, value.newly_funded_account);
            }
        }

        if(tx.transaction) {
            tx = tx.transaction;
            delete tx.transaction;
        }
        Log("INF",`before listening`)
        processXahauTransactions(subXahauLedger)
        Log("INF",`after afterlistening`)

        if (tx.engine_result === "tesSUCCESS" && ( tx.TransactionType === "Import" || tx.TransactionType === "URITokenMint" || tx.TransactionType === "URITokenBurn" || tx.TransactionType === "URITokenBuy" || tx.TransactionType === "SetHook" || tx.TransactionType === "Invoke" )) {
            temporaryLastSyncedXahauLedger = tx.ledger_index;
        } 
    });
}

// Main loop function
async function main() {
    // Get the current ledger(s) on Xahau & XRPL
    const currentXrplLedgerIndex = await xrplClient.send({
        "command": "ledger_current"
    });
    const currentXahauLedgerIndex = await xahauClient.send({
        "command": "ledger_current"
    });

    // Check the last indexed ledger
    let syncedXrplLedgerIndex = await dbManager.db.GetMiscRecord("lastSyncedXrplLedgerIndex"); 
    let syncedXahauLedgerIndex = await dbManager.db.GetMiscRecord("lastSyncedXahauLedgerIndex");
    //console.log(`${currentXrplLedgerIndex}:currentXRPL ${syncedXrplLedgerIndex}:lastXRPL || ${currentXahauLedgerIndex}:currentXAHL ${syncedXahauLedgerIndex}:lastXAHL ${ledgerBurn}:ledgerBurn`);
    if (syncedXahauLedgerIndex === undefined || syncedXrplLedgerIndex === undefined) {
        // Populate these 2 variables with ledger indexes from the .env file
        console.log("generating MiscRecord...");
        dbManager.db.GenerateMiscRecord("lastSyncedXrplLedgerIndex", ledgerBurn);
        dbManager.db.GenerateMiscRecord("lastSyncedXahauLedgerIndex", ledgerMint);
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
        
        var burnSyncProgress = 0;
        var mintSyncProgress = 0;
        
        var xrplReqID = 1;
        var xahauReqID = 1;
        
        // Because we're re-syncing with the ledger, we will re-sync until the Last Closed Ledger (essentially meaning that we're fully synced)
        while (ledgerBurn < currentXrplLedgerIndex.ledger_current_index || ledgerMint < currentXahauLedgerIndex.ledger_current_index) {

            // Sync XRPL (Burn)
            if (!xrplListener) {
                
                const progress = parseInt(xrplReqID / xrplDelta * 100);
                if (progress !== burnSyncProgress && progress <= 100) console.log(`${progress}% synced with XRPL...\r`); burnSyncProgress = progress;

                var xrplLedger = await xrplClient.send({
                    "id": xrplReqID,
                    "command": "ledger",
                    "ledger_index": ledgerBurn + xrplReqID,
                    "transactions": true,
                    "expand": true
                });

                if (xrplLedger.validated === true) {
                    try {
                        xrplLedger.ledger.transactions.forEach(async tx => {
                            if (tx.hasOwnProperty("OperationLimit") && !tx.hasOwnProperty("TicketSequence") && tx.OperationLimit === 21337) {
                                if (tx.metaData.TransactionResult === "tesSUCCESS" || tx.metaData.TransactionResult.substr(0, 3) === "tec") {
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
                            }
                        });
                        
                        for (const [key, value] of Object.entries(temporaryBurnAccountRecord)) {
                            delete temporaryBurnAccountRecord[key];
                            await dbManager.RecordBurnTx(key, value.amount, value.tx_count, value.date);
                        }

                        dbManager.db.UpdateMiscRecord("lastSyncedXrplLedgerIndex", ledgerBurn + xrplReqID);
                        xrplReqID++;               
                    } catch (err) {
                        Log("ERR", `Re-syncing Error (XRPL): ${err}`);
                        break;        
                    }
                } else if (xrplLedger.error === "lgrNotFound" || xrplLedger.validated === false) {
                    await StartXrplListener();
                    
                    Log("INF", `Re-synced ${xrplReqID-1} ledgers on the XRPL`);
                    
                    // junky way to stop syncing w/ the network, but it works.
                    ledgerBurn = Infinity;
                }
            }
            
            // Sync Xahau (Mint)
            if (!xahauListener) {
                const progress = parseInt(xahauReqID / xahauDelta * 100);
                if (progress !== mintSyncProgress && progress <= 100) console.log(`${progress}% synced with Xahau...\r`); mintSyncProgress = progress;
                
                var xahauLedger = await xahauClient.send({
                    "id": xahauReqID,
                    "command": "ledger",
                    "ledger_index": ledgerMint + xahauReqID,
                    "transactions": true,
                    "expand": true
                });
                
                if(xahauLedger.validated === true) {
                    processXahauTransactions(xahauLedger, ledgerMint, xahauReqID)
                    xahauReqID++;
                }

                if (xahauLedger.error === "lgrNotFound" || xahauLedger.validated === false) {
                    await StartXahauListener();
                    
                    Log("INF", `Re-synced ${xahauReqID-1} ledgers on Xahau`);
                    
                    ledgerMint = Infinity;
                }
            }
        }
    }
}

main();

// e3c2064ece7e8bbbebb2a06be96607bb560a2ab8314e3ae64a43aaf3d2954830c760ad7ed923ca2ce3303a1bbc9a2e4d26bf177bae5416af0cc157a60dcc82e4