// @ts-ignore
import * as dotenv from 'dotenv'
import { eq } from 'drizzle-orm'
import Imap from 'imap'
import { simpleParser } from 'mailparser'
import TelegramBot, { Chat, SendMessageOptions } from 'node-telegram-bot-api'
import { db } from './lib/db.js'
import { getGreeting, parseMail, parseSender } from './lib/utils.js'
import { telegramGroupTable, upsTable } from './schemas/telegram-bot.js'
dotenv.config()

class CustomImap extends Imap {
    public imap: Imap
    private bot: TelegramBot
    protected running: boolean = false
    protected userStates: string[] | null[] = []

    private botId = 1483691115 // TEMPORARY

    constructor({
        config,
        botSettings,
    }: {
        config: Imap.Config
        botSettings: [token: string, settings: TelegramBot.ConstructorOptions]
    }) {
        super(config)

        this.imap = new Imap(config)
        this.bot = new TelegramBot(...botSettings)

        // for testing purposes
        this.registerCommandListeners()

        this.bot.on('message', async (msg) => {
            if (msg.text === '/startbot') {
                if (await this.isAdmin(msg.chat, msg.from?.id)) {
                    if (!this.running) {
                        this.running = true
                        const greeting = getGreeting()
                        this.registerCommandListeners()

                        this.bot.sendMessage(msg.chat.id, `${greeting} ${msg.from?.first_name}, up and running! 🤖`)
                    } else {
                        this.bot.sendMessage(msg.chat.id, `I am already running, ${msg.from?.first_name}! 🤦‍♂️`)
                    }
                }
            }
        })
    }

    registerCommandListeners = () => {
        this.bot.onText(/\/stopimapservice/, (msg) => {
            this.imap.removeAllListeners()
            this.imap.end()
            this.bot.sendMessage(msg.chat.id, 'Imap service stopped')
        })

        this.bot.onText(/\/startimapservice/, (msg) => {
            this.connectImap()
        })
        /** END ADMIN COMMANDS */

        this.bot.onText(/\/imapstatus/, (msg) => {
            this.bot.sendMessage(msg.chat.id, this.imap.state)
        })

        this.bot.onText(/\/getchatid/, (msg) => {
            this.bot.sendMessage(msg.chat.id, msg.chat.id.toString())
        })

        this.bot.on('polling_error', (msg) => {
            if (this.bot.isPolling()) this.bot.stopPolling()

            this.bot.startPolling()

            console.log(`There was a polling error:/n${msg.cause}`)
        })

        /** HANDLE CALLBACK DATA */

        this.bot.on('message', async (msg) => {
            if (this.userStates[msg.chat.id]) {
                switch (this.userStates[msg.chat.id]) {
                    case 'waiting_for_new_ups':
                        // Check if user gave a message
                        if (!msg.text)
                            return this.bot.sendMessage(msg.chat.id, 'Please enter the UPS id and name, like this: 1223455-UPS_1')

                        const newUps = msg.text.replace(/\s+/g, '').split('-')

                        // Check if user gave the correct input
                        if (newUps.length !== 2)
                            return this.bot.sendMessage(msg.chat.id, 'Please enter the UPS id and name, like this: 1223455-UPS_1')

                        const upsId = parseInt(newUps[0])
                        const upsName = newUps[1]

                        // Check if UPS id is a number
                        if (isNaN(upsId))
                            return this.bot.sendMessage(
                                msg.chat.id,
                                'Please fill in a number as the UPS id, like this: 1223455-UPS_1',
                            )

                        // Check if UPS id already exists
                        const res = await db.select().from(upsTable).where(eq(upsTable.upsId, upsId))

                        if (res.length > 0) return this.bot.sendMessage(msg.chat.id, `The UPS with ID ${upsId} already exists`)

                        // Add UPS to the database
                        await db.insert(upsTable).values({
                            upsId,
                            name: upsName,
                        })

                        this.bot.sendMessage(msg.chat.id, `UPS "${upsName}" added successfully!`)
                        this.userStates[msg.chat.id] = null
                        break
                    default:
                        return
                }
            }
        })
        /** END HANDLE CALLBACK DATA */
    }

    private connectImap = () => {
        if (this.imap.state === 'disconnected') {
            this.imap.connect()

            this.bot.sendMessage(this.botId, 'Starting IMAP service...')

            this.imap.once('ready', () => {
                this.imap.openBox('INBOX', false, (err, box) => {
                    if (err) {
                        this.bot.sendMessage(this.botId, `An error occured while opening the message inbox.\n${err}`)
                    } else {
                        this.bot.sendMessage(this.botId, 'IMAP service ready. Fetching messages...')
                    }
                })
            })

            this.imap.once('error', (err: any) => {
                this.bot.sendMessage(this.botId, `An error occured while connecting to the mail server.\n${err}`)
                this.imap.end()
            })

            this.imap.once('end', () => {
                this.bot.sendMessage(this.botId, 'IMAP service ended')
            })

            this.imap.on('mail', () => {
                this.fetchMessages()
            })
        } else {
            this.bot.sendMessage(this.botId, 'IMAP service is already running')
        }
    }

    private fetchMessages = () => {
        // SEARCH FOR MESSAGES THAT ARE UNSEEN
        this.imap.search(['UNSEEN'], async (error, results) => {
            if (error) {
                await this.bot.sendMessage(this.botId, `An error occured while searching for messages.\n${error}`)
                return
            }

            if (results.length > 0) {
                console.log('New messages found')
                // FETCH THE MESSAGES
                const fetchQuery = this.imap.fetch(results, {
                    bodies: [''],
                })

                fetchQuery.on('message', (msg, seqno) => {
                    let buffer: string = ''

                    msg.on('body', (stream, info) => {
                        stream.on('data', (chunk) => {
                            buffer += chunk.toString('utf8')
                        })

                        stream.on('end', () => {
                            simpleParser(buffer, async (err, parsed) => {
                                const { from, text, subject } = parsed

                                if (from && text) {
                                    const parsedFrom = parseSender(from.text)
                                    const { upsId, eventDate, message, type } = parseMail(text)
                                    if (!upsId || !eventDate || !message || !type)
                                        return this.bot.sendMessage(
                                            this.botId,
                                            'An error occured while parsing the message from the UPS, please contact the developer.',
                                        )

                                    if (parsedFrom === process.env.IMAP_RECEIPENT_ADDRESS) {
                                        // PARSE THE INFORMATION FOR THE MESSAGE
                                        const ups = await db.select().from(upsTable).where(eq(upsTable.upsId, upsId))

                                        let category = ''
                                        switch (type.toLowerCase()) {
                                            case 'warning':
                                                category = `⚠️ Warning!`
                                                break

                                            case 'Critical':
                                                category = `🔴 Critical!`
                                                break

                                            default:
                                                category = `ℹ️ Informational`
                                        }

                                        // PARSE EVENT
                                        if (message === 'Event Notifications Disabled') {
                                            this.sendMessageToSubscripers(upsId, `Event Notifications Disabled\n${message}`)
                                                .then(() => {
                                                    this.imap.seq.addFlags(seqno, 'SEEN', (err) => {
                                                        if (err) {
                                                            this.bot.sendMessage(this.botId, 'Error marking message as seen')
                                                        }
                                                    })
                                                })
                                                .catch((err) => {
                                                    console.log(err)
                                                })
                                            return
                                        }

                                        const msg = [
                                            ups[0].name,
                                            category,
                                            `Event: ${message}`,
                                            `Date: ${new Date(eventDate)}`,
                                        ].join('\n')

                                        this.sendMessageToSubscripers(upsId, msg)
                                            .then(() => {
                                                this.imap.seq.addFlags(seqno, 'SEEN', (err) => {
                                                    if (err) {
                                                        console.log('Error marking message as seen')
                                                    }
                                                })
                                            })
                                            .catch((err) => {
                                                console.log('Error sending message to telegram')
                                                this.bot.sendMessage(
                                                    this.botId,
                                                    `An error occured while sending the message to telegram.\n${err}`,
                                                )
                                            })
                                    }
                                }
                            })
                        })
                    })
                })

                fetchQuery.on('error', (err) => {
                    this.bot.sendMessage(this.botId, `An error occured while fetching messages. Error: ${error}`)
                    console.log('Fetch error: ' + err)
                })

                fetchQuery.on('end', function () {
                    console.log('fetch end')
                })
            } else {
                this.bot.sendMessage(this.botId, 'No new messages to fetch. Waiting for new messages...')
            }
        })
    }

    private async isAdmin(chat: Chat, userId: number | undefined): Promise<boolean> {
        if (!userId || chat.type === 'private') return false

        try {
            const res = await this.bot.getChatAdministrators(chat.id)
            const isAdmin = res.some((admin) => admin.user.id === userId)

            if (!isAdmin) return false

            return true
        } catch (error) {
            this.bot.sendMessage(chat.id, 'An error occured while checking admin, I sent a message to the server.')
            console.log(error)
            return false
        }
    }

    private async sendMessageToSubscripers(upsId: number, message: string): Promise<void> {
        try {
            const groups = this.groups?.filter((group) => group.upsIds.includes(String(upsId)))

            if (groups.length === 0) return Promise.reject('No groups found')

            const messages: Promise<TelegramBot.Message>[] = []

            groups.forEach(async (group) => {
                messages.push(this.bot.sendMessage(group.groupId, message))
            })

            await Promise.all(messages)
        } catch (error) {
            console.log(error)
        }
    }
}

new CustomImap({
    config: {
        user: process.env.IMAP_USER || '',
        password: process.env.IMAP_PASSWORD || '',
        host: process.env.IMAP_HOST || '',
        port: 993,
        tls: true,
        keepalive: {
            interval: 5000,
            idleInterval: 30000,
            forceNoop: true,
        },
        authTimeout: 30000,
        tlsOptions: { rejectUnauthorized: false },
    },
    botSettings: [
        process.env.TELEGRAM_BOT_TOKEN || '',
        {
            polling: {
                interval: 1000,
                autoStart: true,
                params: {
                    timeout: 10,
                },
            },
        },
    ],
})
