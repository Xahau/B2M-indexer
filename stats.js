const dbManager = require("./db/manager");
const prompt = require("prompt-sync")({ sigint: true });

async function main() {
    console.log(`${__filename}: Get Burn2Mint stats from your own local indexer!`);

    console.log(`Data points:\n1. All Account Records.\n2. Specific Account Record.\n3. All History Records.\n4. Specific History Record.\n5. EXIT`);

    const requestNumber = parseInt(prompt("> Request Number: "));

    // We bluntly display the *raw* data to push you guys to play around with the data in your own unique ways :)
    // you can :->: construct a graph // provide an API service of some sort // use the data internally, go stupid go crazy.

    switch (requestNumber) {
        case 1:
            var data_AllAccountRecord = await dbManager.GetAllAccountRecord();
            console.log(data_AllAccountRecord);
            break
        case 2:
            const accountAddress = prompt(">> Account Address: ")
            var data_AccountRecord = await dbManager.GetAccountRecord(accountAddress);
            console.log(data_AccountRecord);
            break
        case 3:
            const tableNameAll = prompt(">> Table name (daily/monthly): ");
            var data_AllHistoryRecord = await dbManager.GetAllHistoryRecord(tableNameAll);
            console.log(data_AllHistoryRecord);
            break
        case 4:
            const tableNameSpecific = prompt(">> Table name (daily/monthly): ");
            var data_SpecificHistoryRecord = await dbManager.GetAllHistoryRecord(tableNameSpecific);
            console.log(data_SpecificHistoryRecord);
            break
        case 5:
            break;
        }
}

main();