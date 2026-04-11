'use strict';
const { createLogger, format, transports } = require('winston');
const config = require('../config');

const logger = createLogger({
    level: config.logging.level,
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.errors({ stack: true }),
        config.app.env === 'production'
            ? format.json()
            : format.printf(({ timestamp, level, message }) =>
                `${timestamp} [${level.toUpperCase()}] ${message}`)
    ),
    transports: [
        new transports.Console(),
        ...(config.app.env === 'production'
            ? [new transports.File({ filename: 'logs/error.log', level: 'error' }),
               new transports.File({ filename: 'logs/combined.log' })]
            : [])
    ],
});

module.exports = logger;
