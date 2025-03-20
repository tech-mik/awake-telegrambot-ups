import { Config } from './types/config'

if (!process.env.WEBHOOK_PORT) throw new Error('WEBHOOK_SECRET is missing in .env')
if (isNaN(Number(process.env.WEBHOOK_PORT))) throw new Error('WEBHOOK_PORT is not a number')
if (!process.env.WEBHOOK_SECRET) throw new Error('WEBHOOK_PORT is missing in .env')
if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is missing in .env')
if (!process.env.TELEGRAM_CREATOR_ID) throw new Error('TELEGRAM_CREATOR_ID is missing in .env')
if (process.env.TELEGRAM_CREATOR_ID.split(',').filter((id) => isNaN(Number(id))))
    throw new Error('TELEGRAM_CREATOR_ID is not a number')
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing in .env')

export const config: Config = {
    system: {
        initialStatus: 'running',
    },
    telegram: {
        token: process.env.TELEGRAM_BOT_TOKEN,
        options: { polling: true },
        creatorId: process.env.TELEGRAM_CREATOR_ID.split(',').map(Number),
        welcomeMessage: (title) =>
            `############################################\n` +
            `###  UPS Telegram Bot Service\n` +
            `###  \n` +
            `###  This bot listens for incoming messages from \n` +
            `###  \n` +
            `###  @author Mik ten Holt\n` +
            `###  @license MIT\n` +
            `###  @version 1.0.0\n` +
            `###  \n` +
            `###  Disclaimer: This bot is provided \"as is\" without any warranties. \n` +
            `###  Ensure you comply with Telegram's bot policies and guidelines.\n` +
            `###  \n` +
            `###  Hey everyone! 👋 Thanks for adding me to <b>${title}!</b> 🎉\n\n` +
            `###  I'm here to keep you updated about the UPSs statusses. Type /help to see what I can do.\n` +
            `###  Looking forward to assisting you all! 😊`,
        // options: { polling: { autoStart: true, interval: 1000, params: { timeout: 10 } } },
    },
}
