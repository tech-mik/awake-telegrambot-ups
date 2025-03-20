import winston from 'winston'
const { combine, timestamp, printf, json, prettyPrint, errors } = winston.format

const logger = winston.createLogger({
    level: 'info',
    format: combine(
        errors({
            stack: true,
        }),
        timestamp(),
        printf(({ timestamp, level, message }) => {
            return `${timestamp} ${level}: ${message}`
        }),
        json(),
        prettyPrint(),
    ),
    transports: [
        new winston.transports.File({
            level: 'error',
            filename: `logs/error/${new Date().toLocaleDateString('NL-nl').replaceAll('/', '-')}.log`,
        }),
        new winston.transports.File({
            level: 'info',
            filename: `logs/info/${new Date().toLocaleDateString('NL-nl').replaceAll('/', '-')}.log`,
        }),
        new winston.transports.File({
            level: 'warn',
            filename: `logs/warn/${new Date().toLocaleDateString('NL-nl').replaceAll('/', '-')}.log`,
        }),
    ],
    defaultMeta: { timestamp: new Date().toISOString() },
})

if (process.env.NODE_ENV !== 'production') {
    logger.add(
        new winston.transports.Console({
            format: winston.format.colorize(),
        }),
    )
}

declare global {
    var logger: import('winston').Logger
}

globalThis.logger = logger

export default logger
