const winston = require("winston");
const util = require("util");

const Logger = winston.createLogger({
	level: "verbose",
	format: winston.format.combine(
		winston.format.label({ label: "Migrator" }),
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.splat() // See https://stackoverflow.com/a/46973676/97964
	),
	transports: [
		new winston.transports.Console({
			level: "debug",
			format: winston.format.combine(
				winston.format.colorize(),
				winston.format.printf(info => `${info.timestamp} ${info.label} ${info.level}:\t${util.format(info.message)}`)
			)
		}),
		new winston.transports.File({
			filename: "migrator.log",
			level: "silly",
			format: winston.format.logstash(),
			maxsize: 1024 * 1024,
			maxFiles: 2,
			tailable: true
		})
	],
	exitOnError: false
});

module.exports = Logger;
