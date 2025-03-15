import 'dotenv/config'
import express from 'express'
import TelegramBotService from './services/BotService'
import { config } from './config'

const app = express()
app.use(express.json())
const bot = new TelegramBotService(config.telegram.token, config.telegram.options)

// Bot webhook for commands from Raspberry Pi
app.post('/webhook', (req, res) => {
    const { authorization } = req.headers
    if (!authorization) return res.sendStatus(401)

    const secret = authorization.split('Bearer ')[1]
    if (!secret || secret !== process.env.WEBHOOK_SECRET) return res.sendStatus(403)

    const { upsName, event, timestamp } = req.body

    bot.sendMessage(1483691115, `Hello ${secret}!, ${upsName} has ${event} at ${timestamp}`)

    res.sendStatus(200)
})

app.listen(process.env.WEBHOOK_PORT || 3000, () => {
    console.log(`Server is running on port ${process.env.WEBHOOK_PORT || 3000}`)
})
