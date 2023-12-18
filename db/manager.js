const { Log } = require("../log/logger.js");
const dotenv = require("dotenv").config({path:"./.env"});
const dbType = process.env.DB_TYPE; 
BigInt.prototype.toJSON = function() { return this.toString(); }
var recordFlag = {}
var drecordFlag = {}
var mrecordFlag = {}

// Database base interface
class Database {

    /**Get an account's B2M record.
    *  @param {string} address - Account address
    */
    getAccountRecord() {
        throw new Error('getAccountRecord needs database type from .env file');
    }

    /**Retrieve *all* accounts that has performed B2M.
    */
    GetAllAccountRecord() {
        throw new Error('GetAllAccountRecord needs database type from .env file');
    }

    /**Get all the date's B2M performance.
    *  @param {*} record_name - The table's name: "daily" or "monthly" 
    */
    GetAllHistoryRecord() {
        throw new Error('GetAllHistoryRecord needs database type from .env file');
    }

    /**Get a specific date's B2M performance.
    *  @param {string} record_name - The table's name: "daily" or "monthly" 
    *  @param {string} date - The date - YYYY-MM-DD
    *  @returns 
    */
    GetHistoryRecord() {
        throw new Error('GetHistoryRecord needs database type from .env file');
    }

    /**Internal DB book keeping - nothing much...
    * @param {string} key - The variable's key
    */   
    GetMiscRecord() {
        throw new Error('GetMiscRecord needs database type from .env file');
    }

    /**Generate a DB record for an account.
    *  @param {string} address 
    *  @param {number} burnt_amount 
    *  @param {number} minted_amount 
    *  @param {number} burn_tx_count 
    *  @param {number} mint_tx_count 
    */
    GenerateAccountRecord() {
        throw new Error('GenerateAccountRecord needs database type from .env file');
    }

    /**Generate a DB record for a specific & unique date.
    *  @param {string} record_name - The table's name: "daily" or "monthly"
    *  @param {*} date - The date: YYYY-MM-DD
    *  @param {number} burnt_amount
    *  @param {number} minted_amount 
    *  @param {number} burn_tx_count 
    *  @param {number} mint_tx_count 
    *  @param {number} newly_funded_account 
    */
    GenerateHistoryRecord() {
        throw new Error('GenerateHistoryRecord needs database type from .env file');
    }

    /**Generate a misc record (internal DB)
    *  @param {text} key
    *  @param {number} value
    */
    GenerateMiscRecord() {
        throw new Error('GenerateMiscRecord needs database type from .env file');
    }

    /**Update an account's record.
    *  @param {text} address - Account address 
    *  @param {text} key1 - burn/mint_amount
    *  @param {number} value1 - XRP amount
    *  @param {text} key2  - burn/mint_count
    *  @param {number} value2 - tx count
    */
    UpdateAccountRecord() {
        throw new Error('UpdateAccountRecord needs database type from .env file');
    }

    /**Update date record.
    *  @param {text} record_name - Table name
    *  @param {date} date - Date (YYYY-MM-DD)
    *  @param {text} key1 - burn/mint_amount 
    *  @param {number} value1 - XRP amount
    *  @param {text} key2 - burn/mint_count
    *  @param {number} value2 - tx count
    *  @param {text} key3 - newly_funded_account (optional)
    *  @param {number} value3 - Number of accounts (optional)
    */
    UpdateHistoryRecord() {
        throw new Error('UpdateHistoryRecord needs database type from .env file');
    }

    /**Update misc record (internal DB)
    *  @param {text} key
    *  @param {number} value
    */
    UpdateMiscRecord() {
        throw new Error('UpdateMiscRecord needs database type from .env file');
    }

    /**Update Used to Add URItokens to the uritokens dbb
    *  @param {text} address - account address
    *  @param { [text,text] } uritokensToAdd - array of token[s] to Add
    *  @param {text} hash - tx hash
    */
    async URITokensAdd(address, uritokensToAdd) {
        throw new Error('URITokensAdd needs database type from .env file');
    }

    /**Update Used to Remove URItokens to the uritokens dbb
    *  @param {text} address - account address
    *  @param { [text,text] } uritokensToAdd - array of token[s] to Remmove
    *  @param {text} hash - tx hash
    */
    async URITokensRemove(address, uritokensToAdd) {
        throw new Error('URITokensRemove needs database type from .env file');
    }
}

//####################################################################################################################
    
// SQLite implementation
class SQLiteDatabase extends Database {

    async GetAccountRecord(address) {
        const dbAccount = new sqlite3.Database('./db/_account.sqlite3'); // General Account Burn-To-Mint records
        return new Promise((resolve, reject) => {
            dbAccount.get("SELECT * FROM account WHERE address = ?", [address], function(err, record) {
                if (!record || record.length === 0) { //checking against null
                    resolve({});
                    dbAccount.close();
                    return;
                }
                if (err) {
                    dbAccount.close();
                    reject(err);
                } else {
                    resolve(record);
                    dbAccount.close();
                }
            });
        })
    }
    
    async GetAllAccountRecord() {
        const dbAccount = new sqlite3.Database('./db/_account.sqlite3'); // General Account Burn-To-Mint records
        return new Promise((resolve, reject) => {
            dbAccount.all('SELECT * FROM account', [], (err, rows) => {
                if (err) {
                    dbAccount.close();
                    reject(err);
                } else {
                    dbAccount.close();
                    resolve(rows);
                }
            });
        })
    }
    
    async GetAllHistoryRecord(record_name) {
        const dbRecord = new sqlite3.Database('./db/_record.sqlite3'); // Analytical records
        return new Promise((resolve, reject) => {
            dbRecord.all(`SELECT * FROM ${record_name}`, [], function(err, record) {
                if (err) {
                    dbRecord.close();
                    reject(err);
                } else {
                    dbRecord.close();
                    resolve(record);
                }
            });
        })
    }
    
    async GetHistoryRecord(record_name, date) {
        const dbRecord = new sqlite3.Database('./db/_record.sqlite3'); // Analytical records
        return new Promise((resolve, reject) => {
            dbRecord.get(`SELECT * FROM ${record_name} WHERE date = ?`, [date], function(err, record) {
                if (err) {
                    dbRecord.close();
                    reject(err);
                } else {
                    dbRecord.close();
                    resolve(record);
                }
            });
        })
    }
    
    async GetMiscRecord(key) {
        const dbRecord = new sqlite3.Database('./db/_record.sqlite3'); // Analytical records
        return new Promise((resolve, reject) => {
            dbRecord.get(`SELECT * FROM misc WHERE key = ?`, [key], function(err, record) {
                if (err) {
                    dbRecord.close();
                    reject(err);
                } else {
                    dbRecord.close();
                    resolve(record);
                } 
            });
        })
    }

// END OF ASYNC FUNCTIONS
    
    async GenerateAccountRecord(address, burnt_amount, minted_amount, burn_tx_count, mint_tx_count, uritoken_mint_count, uritoken_burn_count, uritoken_buy_count, uritoken_sell_count, hook_count, hookinvoke_count) {
        const dbAccount = new sqlite3.Database('./db/_account.sqlite3');
        dbAccount.serialize(function() {
            var insertAccountRecord = dbAccount.prepare("INSERT INTO account VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            insertAccountRecord.run(address, burnt_amount, minted_amount, burn_tx_count, mint_tx_count, uritoken_mint_count, uritoken_burn_count, uritoken_buy_count, uritoken_sell_count, hook_count, hookinvoke_count);
            insertAccountRecord.finalize();
        });    
        dbAccount.close();
    }
    
    async GenerateHistoryRecord(record_name, date, burnt_amount, minted_amount, burn_tx_count, mint_tx_count, newly_funded_account, uritoken_mint_count, uritoken_burn_count, uritoken_buy_count, uritoken_sell_count, hook_count, hookinvoke_count) {
        const dbRecord = new sqlite3.Database('./db/_record.sqlite3'); 
        dbRecord.serialize(function() {
            var insertHistoryRecord = dbRecord.prepare(`INSERT INTO ${record_name} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);        
            insertHistoryRecord.run(date, burnt_amount, minted_amount, burn_tx_count, mint_tx_count, newly_funded_account, uritoken_mint_count, uritoken_burn_count, uritoken_buy_count, uritoken_sell_count, hook_count, hookinvoke_count);
            insertHistoryRecord.finalize();
        });
        dbRecord.close();
    }

    async GenerateMiscRecord(key, value) {
        const dbRecord = new sqlite3.Database('./db/_record.sqlite3'); 
        dbRecord.serialize(function() {
            var insertHistoryRecord = dbRecord.prepare(`INSERT INTO misc VALUES (?, ?)`);        
            insertHistoryRecord.run(key, value);
            insertHistoryRecord.finalize();
        });
        dbRecord.close();
    }


    async UpdateAccountRecord(address, key1, value1, key2, value2) {
        const dbAccount = new sqlite3.Database('./db/_account.sqlite3'); 
        dbAccount.serialize(function() {
            dbAccount.run(`UPDATE account SET ${key1} = ?, ${key2} = ? WHERE address = ?`, [value1, value2, address])
        });
        dbAccount.close();
    }

    async UpdateHistoryRecord(record_name, date, key1, value1, key2, value2, key3, value3) {
        const dbRecord = new sqlite3.Database('./db/_record.sqlite3');
        if (key3 === undefined || value3 === undefined) {
            var command = `UPDATE ${record_name} SET ${key1} = ?, ${key2} = ? WHERE date = ?`;
            var values = [value1, value2, date];
        } else {
            var command = `UPDATE ${record_name} SET ${key1} = ?, ${key2} = ?, ${key3} = ? WHERE date = ?`;
            var values = [value1, value2, value3, date];    
        }
        dbRecord.serialize(function() {
            dbRecord.run(command, values)
        });
        dbRecord.close();
    }

    async UpdateMiscRecord(key, value) {
        const dbRecord = new sqlite3.Database('./db/_record.sqlite3');
        dbRecord.serialize(function() {
            dbRecord.run(`UPDATE misc SET value = ? WHERE key = ?`, [value, key])
        });
        dbRecord.close();
    }    
}



//####################################################################################################################

// MariaDB implementation
class MariaDBDatabase extends Database {    
    
    async GetAccountRecord(address) {
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {
                    conn.query("SELECT * FROM account WHERE address = ?", [address])
                        .then((accountRows) => {
                            if (!accountRows || accountRows.length === 0) { //checking against null
                                resolve({});
                                conn.end();
                                return;
                            }
                            conn.query("SELECT * FROM uritokens WHERE address = ?", [address])
                                .then((uriTokenRows) => {
                                    if (!uriTokenRows) {
                                        uriTokenRows = [];
                                    }
                                    var combinedData = Object.assign(accountRows[0], uriTokenRows[0]);
                                    resolve(combinedData);
                                    conn.end();
                                })
                                .catch(err => {
                                    conn.end();
                                    reject(err);
                                });
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }    
    
    async GetAllAccountRecord() {
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {
                    conn.query("SELECT * FROM account")
                        .then((rows) => {
                            resolve(rows);
                            conn.end();
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }

    async GetAllHistoryRecord(record_name) {
        return new Promise((resolve, reject) => {
            pool.getConnection()
            .then(conn => {
                conn.query(`SELECT * FROM ${record_name}`)
                .then((rows) => {
                    resolve(rows);
                    conn.end();
                    })
                    .catch(err => {
                        conn.end();
                        reject(err);
                    });
                }).catch(err => {
                    reject(err);
                });
        });
    }
    
    async GetHistoryRecord(record_name, date) {
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {
                    conn.query(`SELECT * FROM ${record_name} WHERE date = ?`, [date])
                        .then((rows) => {
                            resolve(rows[0]);
                            conn.end();
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }
    
    async GetMiscRecord(key) {
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {
                    conn.query(`SELECT * FROM misc WHERE \`key\` = ?`, [key])
                        .then((rows) => {
                            resolve(rows[0] || undefined);  // Return the first record or null if no records
                            conn.end();
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }
    
    async GetURIRecord(uri) {
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {
                    conn.query("SELECT * FROM uritokens WHERE uri = ?", [uri])
                        .then((rows) => {
                            resolve(rows[0]);
                            conn.end();
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }
    
    async GenerateAccountRecord(address, burnt_amount, minted_amount, burn_tx_count, mint_tx_count, uritoken_mint_count, uritoken_burn_count, uritoken_buy_count, uritoken_sell_count, hook_count, hookinvoke_count) {
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {
                    conn.query("INSERT INTO account VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [address, burnt_amount, minted_amount, burn_tx_count, mint_tx_count, uritoken_mint_count, uritoken_burn_count, uritoken_buy_count, uritoken_sell_count, hook_count, hookinvoke_count])
                        .then(() => {
                            resolve();
                            conn.end();
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }
    
    async GenerateHistoryRecord(record_name, date, burnt_amount, minted_amount, burn_tx_count, mint_tx_count, newly_funded_account, uritoken_mint_count, uritoken_burn_count, uritoken_buy_count, uritoken_sell_count, hook_count, hookinvoke_count) {
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {
                    conn.query(`INSERT INTO ${record_name} VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [date, burnt_amount, minted_amount, burn_tx_count, mint_tx_count, newly_funded_account, uritoken_mint_count, uritoken_burn_count, uritoken_buy_count, uritoken_sell_count, hook_count, hookinvoke_count])
                        .then(() => {
                            resolve();
                            conn.end();
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }
    
    async GenerateMiscRecord(key, value) {
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {
                    conn.query(`INSERT INTO misc VALUES (?, ?)`, [key, value])
                        .then(() => {
                            resolve();
                            conn.end();
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }
    
    async UpdateAccountRecord(address, key1, value1, key2, value2, key3 , value3, key4, value4) {
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {
                    let query = `UPDATE account SET ${key1} = ?, ${key2} = ? WHERE address = ?`;
                    let values = [value1, value2, address];                    
                    if(key3 !== undefined && value3 !== undefined) {
                        query = `UPDATE account SET ${key1} = ?, ${key2} = ?, ${key3} = ? WHERE address = ?`;
                        values = [value1, value2, value3, address];
                    }
                    if(key4 !== undefined && value4 !== undefined) {
                        query = `UPDATE account SET ${key1} = ?, ${key2} = ?, ${key3} = ?, ${key4} = ? WHERE address = ?`;
                        values = [value1, value2, value3, value4, address];
                    }
                    conn.query(query, values)
                        .then(() => {
                            resolve();
                            conn.end();
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }
    
    async UpdateHistoryRecord(record_name, date, key1, value1, key2, value2, key3, value3, key4, value4) {
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {                    
                    let query = `UPDATE ${record_name} SET ${key1} = ?, ${key2} = ? WHERE date = ?`;
                    let values = [value1, value2, date];                    
                    if(key3 !== undefined && value3 !== undefined) {
                        query = `UPDATE ${record_name} SET ${key1} = ?, ${key2} = ?, ${key3} = ? WHERE date = ?`;
                        values = [value1, value2, value3, date];
                    }
                    if(key4 !== undefined && value4 !== undefined) {
                        query = `UPDATE ${record_name} SET ${key1} = ?, ${key2} = ?, ${key3} = ?,  ${key4} = ? WHERE date = ?`;
                        values = [value1, value2, value3, value4, date];
                    }
                    conn.query(query, values)
                        .then(() => {
                            resolve();
                            conn.end();
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }
 
    async UpdateMiscRecord(key, value) {
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {
                    conn.query(`UPDATE misc SET value = ? WHERE \`key\` = ?`, [value, key])
                        .then(() => {
                            resolve();
                            conn.end();
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }

    async URITokensAdd(address, uritokenidToAdd, uri, txHash) {
        //Log("INF", `within addURIToken -> [0] ${address} and [1] ${uritokenidToAdd}`);
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {
                            // Array to Insert new URIs into the objects table
                            let promises = uritokenidToAdd.map(uritokenid => {
                                let query = `INSERT INTO uritokens (address, uritokenid, uri, txHash) VALUES (?, ?, ?, ?)`;
                                return conn.query(query, [address, uritokenid, uri, txHash]);
                            });
                            return Promise.all(promises)
                        .then(() => {                        
                            resolve();
                            conn.end();
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }

    async URITokensRemove(address, uritokenidToRemove) {
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {
                            // Array to Remove specified URIs from the objects table
                            let promises = uritokenidToRemove.map(uritokenid => {
                                let query = `DELETE FROM uritokens WHERE address = ? AND uritokenid = ?`;
                                return conn.query(query, [address, uritokenid]);
                            });
                            return Promise.all(promises)
                        .then(() => {
                            resolve();
                            conn.end();
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }

    async RecordHookSet(address, HookNamespaceAdd, HookSetTxnID, HookOn, txHash) {
        //Log("INF", `within addURIToken -> [0] ${address} and [1] ${uritokenidToAdd}`);
        return new Promise((resolve, reject) => {
            pool.getConnection()
                .then(conn => {
                            // Array to Insert new URIs into the objects table
                            let promises = HookNamespaceAdd.map(HookNamespace => {
                                let query = `INSERT INTO hooks (address, HookNamespace, HookSetTxnID, HookOn, txHash) VALUES (?, ?, ?, ?, ?)`;
                                return conn.query(query, [address, HookNamespace, HookSetTxnID, HookOn, txHash]);
                            });
                            return Promise.all(promises)
                        .then(() => {                        
                            resolve();
                            conn.end();
                        })
                        .catch(err => {
                            conn.end();
                            reject(err);
                        });
                }).catch(err => {
                    reject(err);
                });
        });
    }

}

//####################################################################################################################

// Database factory
function createDatabase(type) {
    switch (type) {
        case 'sqlite3':             
            return new SQLiteDatabase();
        case 'mariadb':
            return new MariaDBDatabase();
    }
}

//####################################################################################################################


/**Key-in XRP Burn txs according to their accounts
*/
async function RecordBurnTx(account, amount, tx_count, date) {
  const full_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 10);
  const display_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 19);
  const month_date = full_date.slice(0, 8).concat("00");
  
  Log("INF", `${amount / 1000000} $XRP burnt by ${account} at ${display_date}`);
  
  // ACCOUNT RECORD
  const record = await db.GetAccountRecord(account);
  // Log("INF",`retrieving account record -> ${JSON.stringify(record)}`);
  
  if (record.address == account) {
    db.UpdateAccountRecord(account, "burnt_amount", Number(record.burnt_amount) + amount, "burn_tx_count", record.burn_tx_count + tx_count);
  } else {
    db.GenerateAccountRecord(account, amount, 0, tx_count, 0, 0, 0, 0, 0, 0, 0); 
  }
  
  // HISTORY RECORD
  const daily_record = await db.GetHistoryRecord("daily", full_date);  
  if (daily_record !== undefined) {
    db.UpdateHistoryRecord("daily", full_date, "burnt_amount", Number(daily_record.burnt_amount) + amount, "burn_tx_count", daily_record.burn_tx_count + tx_count);
  } else {
    db.GenerateHistoryRecord("daily", full_date, amount, 0, tx_count, 0, 0, 0, 0, 0, 0, 0, 0);
  }

  const monthly_record = await db.GetHistoryRecord("monthly", month_date)
  if (monthly_record !== undefined) {
    db.UpdateHistoryRecord("monthly", month_date, "burnt_amount", Number(monthly_record.burnt_amount) + amount, "burn_tx_count", monthly_record.burn_tx_count + tx_count);
  } else {
    db.GenerateHistoryRecord("monthly", month_date, amount, 0, tx_count, 0, 0, 0, 0, 0, 0, 0, 0);
  }
}

/**Key-in XAH Mint txs according to their accounts
*/
async function RecordMintTx(account, amount, tx_count, date, newly_funded_account) {
  const full_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 10);
  const display_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 19);
  const month_date = full_date.slice(0, 8).concat("00");
  
  Log("INF", `${amount / 1000000} $XAH minted by ${account} at ${display_date}`);
  
  // ACCOUNT RECORD
  const record = await db.GetAccountRecord(account);
  // Log("INF",`retrieving account record -> ${JSON.stringify(record)}`);
  
  if (record.address == account) {
    db.UpdateAccountRecord(account, "minted_amount", Number(record.minted_amount) + amount, "mint_tx_count", record.mint_tx_count + tx_count);
  } else {
    // TODO: add this defensive functionality to mitigate any chances that we haven't indexed an account's burn txs
    // await ResyncBurnTx(account);
    db.GenerateAccountRecord(account, 0, amount, 0, tx_count, 0, 0, 0, 0, 0, 0); 
  }

  // HISTORY RECORD
  const daily_record = await db.GetHistoryRecord("daily", full_date);  
  if (daily_record !== undefined) {
    db.UpdateHistoryRecord("daily", full_date, "minted_amount", Number(daily_record.minted_amount) + amount, "mint_tx_count", daily_record.mint_tx_count + tx_count, "newly_funded_account", daily_record.newly_funded_account + newly_funded_account);
  } else {
    db.GenerateHistoryRecord("daily", full_date, 0, amount, 0, 1, 0, newly_funded_account ?? 0, 0, 0, 0, 0, 0);
  }

  const monthly_record = await db.GetHistoryRecord("monthly", month_date)
  if (monthly_record !== undefined) {
    db.UpdateHistoryRecord("monthly", month_date, "minted_amount", Number(monthly_record.minted_amount) + amount, "mint_tx_count", monthly_record.mint_tx_count + tx_count, "newly_funded_account", monthly_record.newly_funded_account + newly_funded_account);
  } else {
    db.GenerateHistoryRecord("monthly", month_date, 0, amount, 0, tx_count, newly_funded_account, 0, 0, 0, 0, 0, 0);
  }
}

/**Key-in URIToken txs according to their accounts
*/
async function RecordURIToken(account, uritokenmint_amount, uritokenburn_amount, uritokenbuy_amount, uritokensell_amount, date) {
    const full_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 10);
    const display_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 19);
    const month_date = full_date.slice(0, 8).concat("00");
    
    Log("INF", `URIToken Event --> ${uritokenmint_amount}:minted ${uritokenburn_amount}:burned ${uritokenbuy_amount}:brought ${uritokensell_amount}:sold | TX by ${account} at ${display_date}`);
    
    // ACCOUNT RECORD
    const record = await db.GetAccountRecord(account);
    if (recordFlag[account] === undefined && record.address !== account) { recordFlag[account] = true; } else { recordFlag[account] = false; } // system to prevent double calling of generate, due to timing issues

    //Log("INF", ` --> account:${account} recordFlag:${recordFlag[account]} allrecordFlag:${recordFlag} RecordURIToken:${JSON.stringify(record)} <---`);
    if (recordFlag[account] && record.address !== account) {        
        await db.GenerateAccountRecord(account, 0, 0, 0, 0, uritokenmint_amount, uritokenburn_amount, uritokenbuy_amount, uritokensell_amount, 0, 0);
        delete recordFlag[account];
    }
    if (record.address == account) {
        await db.UpdateAccountRecord(account, "uritoken_mint_count", record.uritoken_mint_count + uritokenmint_amount, "uritoken_burn_count", record.uritoken_burn_count + uritokenburn_amount, "uritoken_buy_count", record.uritoken_buy_count + uritokenbuy_amount, "uritoken_sell_count", record.uritoken_sell_count + uritokensell_amount);
        delete recordFlag[account];
    }

    // HISTORY RECORD
    const daily_record = await db.GetHistoryRecord("daily", full_date);
    if (drecordFlag[full_date] === undefined && daily_record == undefined) { drecordFlag[full_date] = true; } else { drecordFlag[full_date] = false; } // system to prevent double calling of generate, due to timing issues

    //Log("INF", ` --->full_date:${full_date} drecordFlag:${drecordFlag[full_date]} URIToken daily_record:${JSON.stringify(daily_record)} <---`)
    if (drecordFlag[full_date] && daily_record == undefined )  {
        await db.GenerateHistoryRecord("daily", full_date, 0, 0, 0, 0, 0, uritokenmint_amount, uritokenburn_amount, uritokenbuy_amount, uritokensell_amount, 0, 0);
        delete drecordFlag[full_date];
    }
    if (daily_record !== undefined) {
        await db.UpdateHistoryRecord("daily", full_date, "uritoken_mint_count", daily_record.uritoken_mint_count + uritokenmint_amount, "uritoken_burn_count", daily_record.uritoken_burn_count + uritokenburn_amount, "uritoken_buy_count", daily_record.uritoken_buy_count + uritokenbuy_amount, "uritoken_sell_count", daily_record.uritoken_sell_count + uritokensell_amount);
        delete drecordFlag[full_date];
    }
    

    const monthly_record = await db.GetHistoryRecord("monthly", month_date)
    if (mrecordFlag[month_date] === undefined && monthly_record == undefined) { mrecordFlag[month_date] = true; } else { mrecordFlag[month_date] = false; } // system to prevent double calling of generate, due to timing issues

    //Log("INF", ` ---->month_date:${month_date} monthly_record:${JSON.stringify(monthly_record)} <---`)
    if (mrecordFlag[month_date] && monthly_record == undefined ) {
        await db.GenerateHistoryRecord("monthly", month_date, 0, 0, 0, 0, 0, uritokenmint_amount, uritokenburn_amount, uritokenbuy_amount, uritokensell_amount, 0, 0);
        delete mrecordFlag[month_date];
      }
    if (monthly_record !== undefined) {
      await db.UpdateHistoryRecord("monthly", month_date, "uritoken_mint_count", monthly_record.uritoken_mint_count + uritokenmint_amount, "uritoken_burn_count", monthly_record.uritoken_burn_count + uritokenburn_amount, "uritoken_buy_count", monthly_record.uritoken_buy_count + uritokenbuy_amount), "uritoken_sell_count", monthly_record.uritoken_sell_count + uritokensell_amount;
      delete mrecordFlag[month_date];
    }
}

/**Key-in RecordHooks txs according to their accounts
*/
async function RecordHooks(account, hookcount, hookinvokecount, date) {
    const full_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 10);
    const display_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 19);
    const month_date = full_date.slice(0, 8).concat("00");
    
    Log("INF", `HookEvent Event --> ${hookcount}:hookcount ${hookinvokecount}:hookinvokecount | TX by ${account} at ${display_date}`);
    
    // ACCOUNT RECORD
    const record = await db.GetAccountRecord(account);
    // Log("INF", ` ---> RecordHook:${JSON.stringify(record)} <---`)
    
    if (record.address == account) {
      db.UpdateAccountRecord(account, "hook_count", record.hook_count + hookcount, "hookinvoke_count", record.hookinvoke_count + hookinvokecount );
    } else {
      db.GenerateAccountRecord(account, 0, 0, 0, 0, 0, 0, 0, 0, hookcount, hookinvokecount); 
    }
  
    // HISTORY RECORD
    const daily_record = await db.GetHistoryRecord("daily", full_date);    
    // Log("INF", ` ---> RecordHook_daily_record:${JSON.stringify(daily_record)} <---`)
    if (daily_record !== undefined) {
      db.UpdateHistoryRecord("daily", full_date, "hook_count", daily_record.hook_count + hookcount, "hookinvoke_count", daily_record.hookinvoke_count + hookinvokecount );
    } else {
      db.GenerateHistoryRecord("daily", full_date, 0, 0, 0, 0, 0, 0, 0, 0, 0, hookcount, hookinvokecount);
    }

    const monthly_record = await db.GetHistoryRecord("monthly", month_date)
    if (monthly_record !== undefined) {
      db.UpdateHistoryRecord("monthly", month_date, "hook_count", monthly_record.hook_count + hookcount, "hookinvoke_count", monthly_record.hookinvoke_count + hookinvokecount );
    } else {
      db.GenerateHistoryRecord("monthly", month_date, 0, 0, 0, 0, 0, 0, 0, 0, 0, hookcount, hookinvokecount);
    }
}

//####################################################################################################################

const sqlite3 = require('sqlite3').verbose();

const { connectMariaDB } = require('../db/setup.js');
const pool = connectMariaDB();

const db = createDatabase(dbType);

//####################################################################################################################

/*
*retry function to catch SQLITE_BUSY errors:
*use
*const GetAccountRecordWithRetry = withRetry(GetAccountRecord);
*then use GetAccountRecordWithRetry(address) to perform the same operation but with automatic retries on SQLITE_BUSY errors.

function withRetry(fn, retries = 5, delay = 100) {
    return async function(...args) {
        while (true) {
            try {                               
                const result = await fn(...args);
                return result;
            } catch (error) {
                console.log(`Database catch error, Retrying... Attempt:${currentRetry} error:${error}`);
                currentRetry++;
                if (error.code === 'SQLITE_BUSY' && currentRetry < retries) {                    
                    await new Promise(resolve => setTimeout(resolve, delay));                    
                } else {
                    console.log(`Database else error, Retrying... Attempt:${currentRetry}`);
                    throw error;
                }
                currentRetry++;
            }
        }
    };
}

const GetAccountRecordWithRetry = withRetry(db.GetAccountRecord);
const GetAllAccountRecordWithRetry = withRetry(db.GetAllAccountRecord);
const GetHistoryRecordWithRetry = withRetry(db.GetHistoryRecord);
const GetAllHistoryRecordWithRetry = withRetry(db.GetAllHistoryRecord);
const GetMiscRecordWithRetry = withRetry(db.GetMiscRecord);
const GenerateAccountRecordWithRetry = withRetry(db.GenerateAccountRecord);
const GenerateHistoryRecordWithRetry = withRetry(db.GenerateHistoryRecord);
const GenerateMiscRecordWithRetry = withRetry(db.GenerateMiscRecord);
const UpdateAccountRecordWithRetry = withRetry(db.UpdateAccountRecord);
const UpdateHistoryRecordWithRetry = withRetry(db.UpdateHistoryRecord);
const UpdateMiscRecordWithRetry = withRetry(db.UpdateMiscRecord);
*/

module.exports = {
    RecordBurnTx,
    RecordMintTx,
    RecordURIToken,
    RecordHooks,
    db,
    /**
    GetAccountRecordWithRetry,
    GetAllAccountRecordWithRetry,
    GetAllHistoryRecordWithRetry,
    GetHistoryRecordWithRetry,
    GetMiscRecordWithRetry,
    GenerateAccountRecordWithRetry,
    GenerateHistoryRecordWithRetry,
    GenerateMiscRecordWithRetry,
    UpdateAccountRecordWithRetry,
    UpdateHistoryRecordWithRetry,  
    UpdateMiscRecordWithRetry
    */
};