import 'dotenv/config'
import express from 'express'
import TelegramBotService from './services/BotService'
import { config } from './config'
import { UpsPayload } from './types/ups'
import { generateUpsMessage } from './utils/ups'

const app = express()
app.use(express.json())
const bot = new TelegramBotService(config.telegram.token, config.telegram.options)

// Bot webhook for commands from Raspberry Pi
app.post('/webhook', (req, res) => {
    const { authorization } = req.headers
    if (!authorization) return res.sendStatus(401)

    const secret = authorization.split('Bearer ')[1]
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
        logger.warn('Unauthorized request from Raspberry Pi')
        return res.sendStatus(403)
    }

    const { upsName, event, timestamp } = req.body as UpsPayload
    if (!upsName || !event || !timestamp) {
        logger.warn('Received invalid request from Raspberry Pi')
        return res.sendStatus(400)
    }

    switch (event) {
        case 'onbattery':
            logger.warn(`UPS ${upsName} is on battery at ${timestamp}`)
            const message = generateUpsMessage(upsName, event, 'critical', timestamp)

            bot.handleUpsEvent(upsName, message, timestamp)
            break

        case 'offbattery':
            logger.info(`UPS ${upsName} is off battery at ${timestamp}`)
            break

        case 'commfailure':
            logger.warn(`UPS ${upsName} has communication failure at ${timestamp}`)
            break

        case 'commok':
            logger.info(`UPS ${upsName} has communication restored at ${timestamp}`)
            break

        case 'failing':
            logger.warn(`UPS ${upsName} is failing at ${timestamp}`)
            break

        case 'battdetach':
            logger.warn(`UPS ${upsName} has battery detached at ${timestamp}`)
            break

        case 'battattach':
            logger.info(`UPS ${upsName} has battery attached at ${timestamp}`)
            break

        default:
            logger.warn(`Received unknown event from Raspberry Pi: ${event} at ${timestamp}`)
            break
    }

    bot.sendMessage(1483691115, `Hello ${secret}!, ${upsName} has ${event} at ${timestamp}`)

    res.sendStatus(200)
})

app.listen(process.env.WEBHOOK_PORT || 3000, () => {
    logger.info(`Server is running on port ${process.env.WEBHOOK_PORT || 3000}`)
})
