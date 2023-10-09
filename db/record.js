const { Log } = require("../log/logger");
const dbManager = require("./manager");

/**
* Key-in Burn txs according to their accounts
*/
async function RecordBurnTx(account, amount, tx_count, date) {
  const full_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 10);
  const display_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 19);
  const month_date = full_date.slice(0, 8).concat("00");
  
  Log("INF", `${amount / 1000000} $XRP burnt by ${account} at ${display_date}`);
  
  // ACCOUNT RECORD
  const record = await dbManager.GetAccountRecord(account);
  
  if (record !== undefined) {
    dbManager.UpdateAccountRecord(account, "burnt_amount", record.burnt_amount + amount, "burn_tx_count", record.burn_tx_count + tx_count);
  } else {
    dbManager.GenerateAccountRecord(account, amount, 0, tx_count, 0); 
  }
  
  // HISTORY RECORD
  const daily_record = await dbManager.GetHistoryRecord("daily", full_date);
  const monthly_record = await dbManager.GetHistoryRecord("monthly", month_date)
  
  if (daily_record !== undefined) {
    dbManager.UpdateHistoryRecord("daily", full_date, "burnt_amount", daily_record.burnt_amount + amount, "burn_tx_count", daily_record.burn_tx_count + tx_count);
  } else {
    dbManager.GenerateHistoryRecord("daily", full_date, amount, 0, tx_count, 0, 0);
  }
  if (monthly_record !== undefined) {
    dbManager.UpdateHistoryRecord("monthly", month_date, "burnt_amount", monthly_record.burnt_amount + amount, "burn_tx_count", monthly_record.burn_tx_count + tx_count);
  } else {
    dbManager.GenerateHistoryRecord("monthly", month_date, amount, 0, tx_count, 0, 0);
  }
}

/**
* Key-in Mint txs according to their accounts
*/
async function RecordMintTx(account, amount, tx_count, date, newly_funded_account) {
  const full_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 10);
  const display_date = new Date((date + 946684800) * 1000).toISOString().slice(0, 19);
  const month_date = full_date.slice(0, 8).concat("00");
  
  Log("INF", `${amount / 1000000} $XAH minted by ${account} at ${display_date}`);
  
  // ACCOUNT RECORD
  const record = await dbManager.GetAccountRecord(account);
  
  if (record !== undefined) {
    dbManager.UpdateAccountRecord(account, "minted_amount", record.minted_amount + amount, "mint_tx_count", record.mint_tx_count + tx_count);
  } else {
    // TODO: add this defensive functionality to mitigate any chances that we haven't indexed an account's burn txs
    // await ResyncBurnTx(account);
    dbManager.GenerateAccountRecord(account, 0, amount, 0, tx_count); 
  }
  
  // HISTORY RECORD
  const daily_record = await dbManager.GetHistoryRecord("daily", full_date);
  const monthly_record = await dbManager.GetHistoryRecord("monthly", month_date)
  
  if (daily_record !== undefined) {
    dbManager.UpdateHistoryRecord("daily", full_date, "minted_amount", daily_record.minted_amount + amount, "mint_tx_count", daily_record.mint_tx_count + tx_count, "newly_funded_account", daily_record.newly_funded_account + newly_funded_account);
  } else {
    dbManager.GenerateHistoryRecord("daily", full_date, 0, amount, 0, 1, 0, newly_funded_account ?? 0);
  }
  if (monthly_record !== undefined) {
    dbManager.UpdateHistoryRecord("monthly", month_date, "minted_amount", monthly_record.minted_amount + amount, "mint_tx_count", monthly_record.mint_tx_count + tx_count, "newly_funded_account", monthly_record.newly_funded_account + newly_funded_account);
  } else {
    dbManager.GenerateHistoryRecord("monthly", month_date, 0, amount, 0, tx_count, newly_funded_account);
  }
}

module.exports = { RecordBurnTx, RecordMintTx };