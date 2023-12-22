const dbManager = require("../db/manager");
const prompt = require("prompt-sync")({ sigint: true });

async function main() {
    console.log(`\n${__filename}: \nGet Burn2Mint stats from your own local indexer!`);

    //console.log(`Data points:\n1. All Account Records.\n2. Unique Account Record.\n3. Overall B2M Statistics.\n4. All History Records.\n5. Daily B2M Amount.\n6. Monthly B2M Amount.\n7. EXIT.`);
    console.log(`Data points:\n1. Overall B2M Statistics.\n2. Unique Account Record.\n3. All Account Records.\n4. All History Records.\n5. Daily B2M Amount.\n6. Monthly B2M Amount.\n7. EXIT.`);

    const requestNumber = parseInt(prompt("> Request Number: "));

    // We bluntly display the *raw* data to push you guys to play around with the data in your own unique ways :)
    // you can :->: construct a graph // provide an API service of some sort // use the data internally, go stupid go crazy.

    switch (requestNumber) {
        case 1:
            // Overall B2M statistics
            // get the last indexed ledger, and monthly history record
            var syncedXrplLedgerIndex = await dbManager.db.GetMiscRecord("lastSyncedXrplLedgerIndex"); 
            var syncedXahauLedgerIndex = await dbManager.db.GetMiscRecord("lastSyncedXahauLedgerIndex");
            var data_MonthlyHistoryRecord = await dbManager.db.GetAllHistoryRecord("monthly");
            // setup vars and then loop to get totals
            var burnt_amount = 0;
            var minted_amount = 0;
            var total_funded_accounts = 0;
            var uritoken_mint_count = 0;
            var uritoken_burn_count = 0;
            var uritoken_buy_count = 0;
            var uritoken_sell_count = 0;
            var hook_count = 0;
            var hookinvoke_count = 0;
            data_MonthlyHistoryRecord.forEach(record => {
                burnt_amount += Number(record.burnt_amount);
                minted_amount += Number(record.minted_amount);
                total_funded_accounts += record.newly_funded_account;
                uritoken_mint_count += record.uritoken_mint_count;
                uritoken_burn_count += record.uritoken_burn_count;
                uritoken_buy_count += record.uritoken_buy_count;
                uritoken_sell_count += record.uritoken_sell_count;
                hook_count += record.hook_count;
                hookinvoke_count += record.hookinvoke_count;
            });

            // create response
 
            console.log(` --  lastSyncedXrplLedger : ${syncedXrplLedgerIndex.value}`);
            console.log(` -- lastSyncedXahauLedger : ${syncedXahauLedgerIndex.value}`);
            console.log(` --    B2M-Funded Account : ${total_funded_accounts}  Xahau Accounts`);
            console.log(` --    --       Burnt XRP : ${burnt_amount / 1000000} $XRP`); // Converted from drops
            console.log(` --    --      Minted XAH : ${minted_amount / 1000000} $XAH`);
            console.log(` --    --   Un-minted XAH : ${(burnt_amount - minted_amount) / 1000000} $XAH`);
            console.log(` --   URIToken mint count : ${uritoken_mint_count}`);
            console.log(` --   URIToken burn count : ${uritoken_burn_count}`);
            console.log(` --    URIToken buy count : ${uritoken_buy_count}`);
            console.log(` --   URIToken sell count : ${uritoken_sell_count}`);
            console.log(` --    --      hook count : ${hook_count}`);
            console.log(` --      hookinvoke count : ${hookinvoke_count}`);
            main();
        case 2:
            // All Account Records
            var data_AllAccountRecord = await dbManager.db.GetAllAccountRecord();
            console.log(data_AllAccountRecord);
            main();
        case 3:
            // Unique Account Record
            const accountAddress = prompt(">> Account Address: ")
            var data_AccountRecord = await dbManager.db.GetAccountRecord(accountAddress);
            console.log(data_AccountRecord);
            main();
         case 4:
            // All History Records
            const tableNameAll = prompt(">> Table name (daily/monthly): ");
            var data_AllHistoryRecord = await dbManager.db.GetAllHistoryRecord(tableNameAll);
            console.log(data_AllHistoryRecord);
            main();
        case 5:
            // Daily B2M amount
            const dailyDate = prompt(">> Date (YYY-MM-DD): ");
            var data_DailyHistoryRecord = await dbManager.db.GetHistoryRecord("daily", dailyDate);
            console.log(data_DailyHistoryRecord);
            main();
        case 6:
            // Monthly B2M amount
            const monthlyDate = prompt(">> Date (YYYY-MM): ");
            console.log(monthlyDate+"-00");
            var data_MonthlyHistoryRecord = await dbManager.db.GetHistoryRecord("monthly", monthlyDate+"-00");
            console.log(data_MonthlyHistoryRecord);
            main();
        case 7:
            // exit
            process.exit();
        }
}

main();