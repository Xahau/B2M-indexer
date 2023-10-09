const dbManager = require("../db/manager");
const prompt = require("prompt-sync")({ sigint: true });

async function main() {
    console.log(`${__filename}: Get Burn2Mint stats from your own local indexer!`);

    console.log(`Data points:\n1. All Account Records.\n2. Unique Account Record.\n3. Overall B2M Statistics.\n4. All History Records.\n5. Daily B2M Amount.\n6. Monthly B2M Amount.\n7. EXIT.`);

    const requestNumber = parseInt(prompt("> Request Number: "));

    // We bluntly display the *raw* data to push you guys to play around with the data in your own unique ways :)
    // you can :->: construct a graph // provide an API service of some sort // use the data internally, go stupid go crazy.

    switch (requestNumber) {
        case 1:
            // All Account Records
            var data_AllAccountRecord = await dbManager.GetAllAccountRecord();
            console.log(data_AllAccountRecord);
            break;
        case 2:
            // Unique Account Record
            const accountAddress = prompt(">> Account Address: ")
            var data_AccountRecord = await dbManager.GetAccountRecord(accountAddress);
            console.log(data_AccountRecord);
            break;
        case 3:
            // Overall B2M statistics
            var burnt_amount = 0;
            var minted_amount = 0;
            var total_funded_accounts = 0;
            var data_MonthlyHistoryRecord = await dbManager.GetAllHistoryRecord("monthly");
            data_MonthlyHistoryRecord.forEach(record => {
                burnt_amount += record.burnt_amount;
                minted_amount += record.minted_amount;
                total_funded_accounts += record.newly_funded_account;
            });
            console.log(` -- B2M-Funded Account : ${total_funded_accounts} Xahau Accounts`);
            console.log(` --          Burnt XRP : ${burnt_amount / 1000000} $XRP`);
            console.log(` --         Minted XAH : ${minted_amount / 1000000} $XAH`);
            console.log(` --      Un-minted XAH : ${(burnt_amount - minted_amount) / 1000000} $XAH`);
            break;
        case 4:
            // All History Records
            const tableNameAll = prompt(">> Table name (daily/monthly): ");
            var data_AllHistoryRecord = await dbManager.GetAllHistoryRecord(tableNameAll);
            console.log(data_AllHistoryRecord);
            break;
        case 5:
            // Daily B2M amount
            const dailyDate = prompt(">> Date (YYY-MM-DD): ");
            var data_DailyHistoryRecord = await dbManager.GetHistoryRecord("daily", dailyDate);
            console.log(data_DailyHistoryRecord);
            break;
        case 6:
            // Monthly B2M amount
            const monthlyDate = prompt(">> Date (YYYY-MM): ");
            console.log(monthlyDate+"-00");
            var data_MonthlyHistoryRecord = await dbManager.GetHistoryRecord("monthly", monthlyDate+"-00");
            console.log(data_MonthlyHistoryRecord);
            break;
        case 7:
            // exit
            break;
        }
}

main();