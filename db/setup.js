const dotenv = require("dotenv").config({path:"./.env"});
const dbType = process.env.DB_TYPE;

if (dbType === 'sqlite3') {
    setupSQLite();
} else if (dbType === 'mariadb') {
    setupMariaDB();
} else {
    console.error(`Unsupported database type, needs to be either sqlite3, or mariadb and not: ${dbType}`);
    process.exit(1);
}

/// #### Setup sqlite3
function setupSQLite() {
    const sqlite3 = require('sqlite3').verbose();

    // Record: B2M Analytics (XRPL & Xahau)
    const dbRecord = new sqlite3.Database('./db/_record.sqlite3'); // Analytical records
    dbRecord.serialize(function() {
        dbRecord.run("CREATE TABLE IF NOT EXISTS misc (key VARCHAR(255) PRIMARY KEY, value VARCHAR(255) NOT NULL)");
        dbRecord.run("CREATE TABLE IF NOT EXISTS daily (date DATE PRIMARY KEY, burnt_amount BIGINT NOT NULL, minted_amount BIGINT NOT NULL, burn_tx_count BIGINT NOT NULL, mint_tx_count BIGINT NOT NULL, newly_funded_account BIGINT NOT NULL, uritoken_mint_count INT NOT NULL, uritoken_burn_count INT NOT NULL, uritoken_buy_count INT NOT NULL, uritoken_sell_count INT NOT NULL, hook_count INT NOT NULL, hookinvoke_count INT NOT NULL)");
        dbRecord.run("CREATE TABLE IF NOT EXISTS monthly (date DATE PRIMARY KEY, burnt_amount BIGINT NOT NULL, minted_amount BIGINT NOT NULL, burn_tx_count BIGINT NOT NULL, mint_tx_count BIGINT NOT NULL, newly_funded_account BIGINT NOT NULL, uritoken_mint_count INT NOT NULL, uritoken_burn_count INT NOT NULL, uritoken_buy_count INT NOT NULL, uritoken_sell_count INT NOT NULL, hook_count INT NOT NULL, hookinvoke_count INT NOT NULL)");
    });
    dbRecord.close();

    // Record: XRPLCP Accounts (XRPL & Xahau)
    const dbAccount = new sqlite3.Database('./db/_account.sqlite3'); // General Account Burn-To-Mint records
    dbAccount.serialize(function() {
        dbAccount.run("CREATE TABLE IF NOT EXISTS account (address VARCHAR(35) PRIMARY KEY, burnt_amount BIGINT NOT NULL, minted_amount BIGINT NOT NULL, burn_tx_count BIGINT NOT NULL, mint_tx_count BIGINT NOT NULL, uritoken_mint_count INT NOT NULL, uritoken_burn_count INT NOT NULL, uritoken_buy_count INT NOT NULL, uritoken_sell_count INT NOT NULL, hook_count INT NOT NULL, hookinvoke_count INT NOT NULL)");
        dbAccount.run("CREATE TABLE IF NOT EXISTS uritokens (id INT AUTO_INCREMENT PRIMARY KEY, address VARCHAR(35), uri VARCHAR(512) NOT NULL, URITokenID VARCHAR(512) NOT NULL, txHash VARCHAR(256) NOT NULL, hook_count INT NOT NULL, hookinvoke_count INT NOT NULL, FOREIGN KEY (address) REFERENCES account(address))");
        dbAccount.run("CREATE TABLE IF NOT EXISTS hooks (id INT AUTO_INCREMENT PRIMARY KEY, address VARCHAR(35), HookNamespace VARCHAR(512) NOT NULL, HookSetTxnID VARCHAR(256) NOT NULL, txHash VARCHAR(256) NOT NULL, hook_count INT NOT NULL, hookinvoke_count INT NOT NULL, FOREIGN KEY (address) REFERENCES account(address))");

    });
    dbAccount.close();
}

/// ### connection pool for MariaDB
function connectMariaDB() {
    const mariadb = require('mariadb');
    const pool = mariadb.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        connectionLimit: 5
    });
    return pool;
}

/// ### Setup MariaDB
async function setupMariaDB() {
    const pool = connectMariaDB();
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query("CREATE TABLE IF NOT EXISTS misc (`key` VARCHAR(255) PRIMARY KEY, value VARCHAR(255) NOT NULL)");
        await conn.query("CREATE TABLE IF NOT EXISTS account (address VARCHAR(35) PRIMARY KEY, burnt_amount BIGINT NOT NULL, minted_amount BIGINT NOT NULL, burn_tx_count INT NOT NULL, mint_tx_count INT NOT NULL, uritoken_mint_count INT NOT NULL, uritoken_burn_count INT NOT NULL, uritoken_buy_count INT NOT NULL, uritoken_sell_count INT NOT NULL, hook_count INT NOT NULL, hookinvoke_count INT NOT NULL)");
        await conn.query("CREATE TABLE IF NOT EXISTS daily (date DATE PRIMARY KEY, burnt_amount BIGINT NOT NULL, minted_amount BIGINT NOT NULL, burn_tx_count INT NOT NULL, mint_tx_count INT NOT NULL, newly_funded_account INT NOT NULL, uritoken_mint_count INT NOT NULL, uritoken_burn_count INT NOT NULL, uritoken_buy_count INT NOT NULL, uritoken_sell_count INT NOT NULL, hook_count INT NOT NULL, hookinvoke_count INT NOT NULL)");
        await conn.query("CREATE TABLE IF NOT EXISTS monthly (date DATE PRIMARY KEY, burnt_amount BIGINT NOT NULL, minted_amount BIGINT NOT NULL, burn_tx_count INT NOT NULL, mint_tx_count INT NOT NULL, newly_funded_account INT NOT NULL, uritoken_mint_count INT NOT NULL, uritoken_burn_count INT NOT NULL, uritoken_buy_count INT NOT NULL, uritoken_sell_count INT NOT NULL, hook_count INT NOT NULL, hookinvoke_count INT NOT NULL)");
        await conn.query("CREATE TABLE IF NOT EXISTS uritokens (id INT AUTO_INCREMENT PRIMARY KEY, address VARCHAR(35),  URITokenID VARCHAR(512) NOT NULL, uri VARCHAR(512) NOT NULL, txHash VARCHAR(256) NOT NULL, FOREIGN KEY (address) REFERENCES account(address))");
        await conn.query("CREATE TABLE IF NOT EXISTS hooks (id INT AUTO_INCREMENT PRIMARY KEY, address VARCHAR(35), HookNamespace VARCHAR(64) NOT NULL, HookSetTxnID VARCHAR(256) NOT NULL, HookOn VARCHAR(68) NOT NULL, txHash VARCHAR(256) NOT NULL, FOREIGN KEY (address) REFERENCES account(address))");

    } catch (err) {
        throw err;
    } finally {
        if (conn) return conn.end();
    }
}

console.log(`Database type:${dbType} has been checked and is ready..`);

module.exports = {
    connectMariaDB
}