const sqlite3 = require('sqlite3').verbose();

const dbAccount = new sqlite3.Database('../db/:account:'); // General Account Burn-To-Mint records
const dbRecord = new sqlite3.Database('../db/:record:'); // Analytical records

/**
* Get an account's B2M record.
* @param {string} address - Account address
*/
async function GetAccountRecord(address) {
    return new Promise((resolve, reject) => {
        dbAccount.get("SELECT * FROM account WHERE address = ?", [address], function(err, record) {
            if(err) reject(err);
            resolve(record);
        });
    })
}

/**
* Retrieve *all* accounts that has performed B2M.
*/
async function GetAllAccountRecord() {
    return new Promise((resolve, reject) => {
        dbAccount.all('SELECT * FROM account', [], (err, rows) => {
            if(err) reject(err);
            resolve(rows);
        });
    })
}

/**
* Get a specific date's B2M performance.
* @param {string} record_name - The table's name: "daily" or "monthly" 
* @param {string} date - The date - YYYY-MM-DD
* @returns 
*/
async function GetHistoryRecord(record_name, date) {
    return new Promise((resolve, reject) => {
        dbRecord.get(`SELECT * FROM ${record_name} WHERE date = ?`, [date], function(err, record) {
            if(err) reject(err);
            resolve(record);
        });
    })
}

/**
* Get all the date's B2M performance.
* @param {*} record_name - The table's name: "daily" or "monthly" 
*/
async function GetAllHistoryRecord(record_name) {
    return new Promise((resolve, reject) => {
        dbRecord.all(`SELECT * FROM ${record_name}`, [], function(err, record) {
            if(err) reject(err);
            resolve(record);
        });
    })
}

/**
* Internal DB book keeping - nothing much...
* @param {string} key - The variable's key
*/
async function GetMiscRecord(key) {
    return new Promise((resolve, reject) => {
        dbRecord.get(`SELECT * FROM misc WHERE key = ?`, [key], function(err, record) {
            if(err) reject(err);
            resolve(record);
        });
    })
}

/**
* Generate a DB record for an account.
* @param {string} address 
* @param {number} burnt_amount 
* @param {number} minted_amount 
* @param {number} burn_tx_count 
* @param {number} mint_tx_count 
*/
function GenerateAccountRecord(address, burnt_amount, minted_amount, burn_tx_count, mint_tx_count) {
    dbAccount.serialize(function() {
        var insertAccountRecord = dbAccount.prepare("INSERT INTO account VALUES (?,?,?,?,?)");
        
        insertAccountRecord.run(address, burnt_amount, minted_amount, burn_tx_count, mint_tx_count);
        insertAccountRecord.finalize();
    });    
}

/**
* Generate a DB record for a specific & unique date.
* @param {string} record_name - The table's name: "daily" or "monthly"
* @param {*} date - The date: YYYY-MM-DD
* @param {number} burnt_amount
* @param {number} minted_amount 
* @param {number} burn_tx_count 
* @param {number} mint_tx_count 
* @param {number} newly_funded_account 
*/
function GenerateHistoryRecord(record_name, date, burnt_amount, minted_amount, burn_tx_count, mint_tx_count, newly_funded_account) {
    dbRecord.serialize(function() {
        var insertHistoryRecord = dbRecord.prepare(`INSERT INTO ${record_name} VALUES (?,?,?,?,?,?)`);
        
        insertHistoryRecord.run(date, burnt_amount, minted_amount, burn_tx_count, mint_tx_count, newly_funded_account)
        insertHistoryRecord.finalize();
    });    
}

function GenerateMiscRecord(key, value) {
    dbRecord.serialize(function() {
        var insertHistoryRecord = dbRecord.prepare(`INSERT INTO misc VALUES (?, ?)`);
        
        insertHistoryRecord.run(key, value);
        insertHistoryRecord.finalize();
    });
}

/**
* Update an account's record.
* @param {text} address - Account address 
* @param {text} key1 - burn/mint_amount
* @param {number} value1 - XRP amount
* @param {text} key2  - burn/mint_count
* @param {number} value2 - tx count
*/
function UpdateAccountRecord(address, key1, value1, key2, value2) {
    dbAccount.serialize(function() {
        dbAccount.run(`UPDATE account SET ${key1} = ?, ${key2} = ? WHERE address = ?`, [value1, value2, address])
    });
}

/**
* Update date record.
* @param {text} record_name - Table name
* @param {date} date - Date (YYYY-MM-DD)
* @param {text} key1 - burn/mint_amount 
* @param {number} value1 - XRP amount
* @param {text} key2 - burn/mint_count
* @param {number} value2 - tx count
* @param {text} key3 - newly_funded_account (optional)
* @param {number} value3 - Number of accounts (optional)
*/
function UpdateHistoryRecord(record_name, date, key1, value1, key2, value2, key3, value3) {
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
}

/**
* Update misc record (internal DB)
* @param {text} key
* @param {number} value
*/
function UpdateMiscRecord(key, value) {
    dbRecord.serialize(function() {
        dbRecord.run(`UPDATE misc SET value = ? WHERE key = ?`, [value, key])
    });
}

module.exports = {
    GetAccountRecord,
    GetAllAccountRecord,
    GetHistoryRecord,
    GetAllHistoryRecord,
    GetMiscRecord,
    GenerateAccountRecord,
    GenerateHistoryRecord,
    GenerateMiscRecord,
    UpdateAccountRecord,
    UpdateHistoryRecord,
    UpdateMiscRecord
};