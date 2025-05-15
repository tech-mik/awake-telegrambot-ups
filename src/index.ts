import 'dotenv/config'
import express from 'express'
import { config } from './config'
import logger from './lib/logger'
import TelegramBotService from './services/BotService'
import { UpsPayload } from './types/ups'
import AppState from './lib/state'

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

    const upsLocation = AppState.upsList.get(upsName)?.location
    const newUpsName = upsLocation || upsName

    switch (event) {
        case 'onbattery':
            logger.warn(`UPS ${newUpsName} is on battery at ${timestamp}`)
            bot.handleUpsEvent('critical', newUpsName, 'UPS is on battery', timestamp)
            break

        case 'offbattery':
            logger.info(`UPS ${newUpsName} is off battery at ${timestamp}`)
            bot.handleUpsEvent('info', newUpsName, 'UPS is off battery', timestamp)
            break

        case 'commfailure':
            logger.warn(`UPS ${newUpsName} has communication failure at ${timestamp}`)
            bot.handleUpsEvent('critical', newUpsName, 'Lost communication with UPS', timestamp)
            break

        case 'commok':
            logger.info(`UPS ${newUpsName} has communication restored at ${timestamp}`)
            bot.handleUpsEvent('info', newUpsName, 'Communication with UPS restored', timestamp)
            break

        case 'failing':
            logger.warn(`UPS ${newUpsName} is failing at ${timestamp}`)
            bot.handleUpsEvent('critical', newUpsName, 'Ups battery is detached', timestamp)

            break

        case 'battdetach':
            logger.warn(`UPS ${newUpsName} has battery detached at ${timestamp}`)
            bot.handleUpsEvent('critical', newUpsName, 'Ups battery is detached', timestamp)
            break

        case 'battattach':
            logger.info(`UPS ${newUpsName} has battery attached at ${timestamp}`)
            bot.handleUpsEvent('info', newUpsName, 'Ups battery is attached', timestamp)
            break

        case 'mainsback':
            logger.info(`UPS ${newUpsName} has mains power restored at ${timestamp}`)
            break

        case 'powerout':
            logger.warn(`UPS ${newUpsName} has power outage at ${timestamp}`)
            break

        default:
            logger.warn(`Received unknown event from Raspberry Pi: ${event} at ${timestamp}`)
            break
    }

    res.sendStatus(200)
})

app.listen(process.env.WEBHOOK_PORT || 3000, () => {
    logger.info(`Server is running on port ${process.env.WEBHOOK_PORT || 3000}`)
})
