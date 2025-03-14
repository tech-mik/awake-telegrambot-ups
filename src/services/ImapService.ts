import { eq } from 'drizzle-orm'
import Imap from 'imap'
import { simpleParser } from 'mailparser'
import { db } from '../lib/db'
import { upsTable } from '../schemas/telegram-bot'
import { parseMail, parseSender } from '../utils/imap'
import TelegramBotService from './BotService'

class ImapService extends Imap {
    private imap: Imap
    private bot: typeof TelegramBotService
    botId: number = 0

    constructor(imapConfig: Imap.Config, bot: typeof TelegramBotService) {
        super(imapConfig)
        this.imap = new Imap(imapConfig)
        this.bot = bot
    }

    connect() {
        if (this.imap.state !== 'disconnected') {
            this.bot.sendMessage(this.botId, 'IMAP service is already running')
            return
        }

        this.imap.connect()
        this.bot.sendMessage(this.botId, 'Starting IMAP service...')

        this.imap.once('ready', () => {
            this.imap.openBox('INBOX', false, (err) => {
                if (err) {
                    this.bot.sendMessage(this.botId, `Error opening inbox: ${err.message}`)
                } else {
                    this.bot.sendMessage(this.botId, 'IMAP service ready. Fetching messages...')
                }
            })
        })

        this.imap.once('error', (err: Error) => {
            this.bot.sendMessage(this.botId, `IMAP error: ${err.message}`)
            this.imap.end()
        })

        this.imap.on('mail', () => this.fetchMessages())
    }

    fetchMessages() {
        this.imap.search(['UNSEEN'], (error, results) => {
            if (error) return this.bot.sendMessage(this.botId, `IMAP search error: ${error.message}`)
            if (results.length === 0) return

            const fetchQuery = this.imap.fetch(results, { bodies: [''] })
            fetchQuery.on('message', (msg, seqno) => {
                let buffer = ''
                msg.on('body', (stream) => stream.on('data', (chunk) => (buffer += chunk.toString('utf8'))))

                msg.on('end', () => {
                    simpleParser(buffer, async (err, parsed) => {
                        if (err) return
                        const { from, text } = parsed
                        if (!from || !text) return

                        const parsedFrom = parseSender(from.text)
                        const { upsId, eventDate, message, type } = parseMail(text)

                        if (!upsId || !eventDate || !message || !type || parsedFrom !== process.env.IMAP_RECEIPENT_ADDRESS) return

                        const ups = await db.select().from(upsTable).where(eq(upsTable.upsId, upsId))
                        if (ups.length === 0) return

                        const category =
                            type.toLowerCase() === 'warning'
                                ? '⚠️ Warning!'
                                : type.toLowerCase() === 'critical'
                                ? '🔴 Critical!'
                                : 'ℹ️ Informational'
                        const msgContent = `${ups[0].name}\n${category}\nEvent: ${message}\nDate: ${new Date(eventDate)}`

                        await this.bot.sendMessage(this.botId, msgContent)
                        this.imap.seq.addFlags(seqno, 'SEEN', (err) => err && console.log('Error marking message as seen'))
                    })
                })
            })
        })
    }
}

export default ImapService
