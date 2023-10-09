const sqlite3 = require('sqlite3').verbose();

// Record: B2M Analytics (XRPL & Xahau)
const dbRecord = new sqlite3.Database('../db/:record:'); // Analytical records
dbRecord.serialize(function() {
    dbRecord.run("CREATE TABLE IF NOT EXISTS misc (key VARCHAR(255) PRIMARY KEY, value VARCHAR(255) NOT NULL)")
    dbRecord.run("CREATE TABLE IF NOT EXISTS daily (date DATE PRIMARY KEY, burnt_amount INT NOT NULL, minted_amount INT NOT NULL, burn_tx_count INT NOT NULL, mint_tx_count INT NOT NULL, newly_funded_account INT NOT NULL)");
    dbRecord.run("CREATE TABLE IF NOT EXISTS monthly (date DATE PRIMARY KEY, burnt_amount INT NOT NULL, minted_amount INT NOT NULL, burn_tx_count INT NOT NULL, mint_tx_count INT NOT NULL, newly_funded_account INT NOT NULL)");
});
dbRecord.close();

// Record: XRPLCP Accounts (XRPL & Xahau)
const dbAccount = new sqlite3.Database('../db/:account:'); // General Account Burn-To-Mint records
dbAccount.serialize(function() {
    dbAccount.run("CREATE TABLE IF NOT EXISTS account (address VARCHAR(35) PRIMARY KEY, burnt_amount INT NOT NULL, minted_amount INT NOT NULL, burn_tx_count INT NOT NULL, mint_tx_count INT NOT NULL)");
});
dbAccount.close();