const { Log } = require("../log/logger.js");
const sqlite3 = require('sqlite3').verbose();

// We don't use db/manager.js/ here.

var dbAccount = null;
var dbRecord = null;

/** Open Record DB */
function OpenAccountDB() {
  dbAccount = new sqlite3.Database('../db/:account:'); // General Account Burn-To-Mint records
}

/** Open Record DB */
function OpenRecordDB() {
  dbRecord = new sqlite3.Database('../db/:record:'); // Analytical records
}

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
* Key-in Burn txs according to their accounts
*/
async function RecordBurnTx(account, amount, tx_count, date) {
  const full_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 10);
  const display_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 19);
  const month_date = full_date.slice(0, 8).concat("00");
  
  Log("INF", `${amount / 1000000} $XRP burnt by ${account} at ${display_date}`);
  
  OpenAccountDB();
  // ACCOUNT RECORD
  const record = await GetAccountRecord(account);
  
  if (record !== undefined) {
    UpdateAccountRecord(account, "burnt_amount", record.burnt_amount + amount, "burn_tx_count", record.burn_tx_count + tx_count);
  } else {
    GenerateAccountRecord(account, amount, 0, tx_count, 0); 
  }
  dbAccount.close();
  
  OpenRecordDB();
  // HISTORY RECORD
  const daily_record = await GetHistoryRecord("daily", full_date);
  const monthly_record = await GetHistoryRecord("monthly", month_date)
  
  if (daily_record !== undefined) {
    UpdateHistoryRecord("daily", full_date, "burnt_amount", daily_record.burnt_amount + amount, "burn_tx_count", daily_record.burn_tx_count + tx_count);
  } else {
    GenerateHistoryRecord("daily", full_date, amount, 0, tx_count, 0, 0);
  }
  if (monthly_record !== undefined) {
    UpdateHistoryRecord("monthly", month_date, "burnt_amount", monthly_record.burnt_amount + amount, "burn_tx_count", monthly_record.burn_tx_count + tx_count);
  } else {
    GenerateHistoryRecord("monthly", month_date, amount, 0, tx_count, 0, 0);
  }
  dbRecord.close();
}

/**
* Key-in Mint txs according to their accounts
*/
async function RecordMintTx(account, amount, tx_count, date, newly_funded_account) {
  const full_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 10);
  const display_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 19);
  const month_date = full_date.slice(0, 8).concat("00");
  
  Log("INF", `${amount / 1000000} $XAH minted by ${account} at ${display_date}`);
  
  OpenAccountDB();
  // ACCOUNT RECORD
  const record = await GetAccountRecord(account);
  
  if (record !== undefined) {
    UpdateAccountRecord(account, "minted_amount", record.minted_amount + amount, "mint_tx_count", record.mint_tx_count + tx_count);
  } else {
    // TODO: add this defensive functionality to mitigate any chances that we haven't indexed an account's burn txs
    // await ResyncBurnTx(account);
    GenerateAccountRecord(account, 0, amount, 0, tx_count); 
  }
  dbAccount.close();
  
  OpenRecordDB();
  // HISTORY RECORD
  const daily_record = await GetHistoryRecord("daily", full_date);
  const monthly_record = await GetHistoryRecord("monthly", month_date)
  
  if (daily_record !== undefined) {
    UpdateHistoryRecord("daily", full_date, "minted_amount", daily_record.minted_amount + amount, "mint_tx_count", daily_record.mint_tx_count + tx_count, "newly_funded_account", daily_record.newly_funded_account + newly_funded_account);
  } else {
    GenerateHistoryRecord("daily", full_date, 0, amount, 0, 1, 0, newly_funded_account ?? 0);
  }
  if (monthly_record !== undefined) {
    UpdateHistoryRecord("monthly", month_date, "minted_amount", monthly_record.minted_amount + amount, "mint_tx_count", monthly_record.mint_tx_count + tx_count, "newly_funded_account", monthly_record.newly_funded_account + newly_funded_account);
  } else {
    GenerateHistoryRecord("monthly", month_date, 0, amount, 0, tx_count, newly_funded_account);
  }
  dbRecord.close();
}

module.exports = { RecordBurnTx, RecordMintTx };