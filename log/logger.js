const fs = require("fs");
/**
* Log messages
* @param {string} type - The log message's type (ERR: Error, WRN: Warn, INF: Info) 
* @param {string} message - The log message
*/
function Log(type, message) {
	const date = new Date().toISOString().slice(0, 19);
	
	message = `B2M-listener ${date} ${type}: ${message}\n`;
	console.log(message);
	
	switch (type) {
		case "ERR":
		fs.appendFileSync(`../log/${type}.txt`, message);
		break;
		case "WRN":
		fs.appendFileSync(`../log/${type}.txt`, message);
		break;
		case "INF":
		fs.appendFileSync(`../log/${type}.txt`, message);
		break;
	}
};

module.exports = { Log };