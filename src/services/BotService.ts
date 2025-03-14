import TelegramBot, { SendMessageOptions } from 'node-telegram-bot-api'
import { config } from '../config'
import AppState from '../lib/state'
import { OnCommandOptions, TelegramError } from '../types/telegram'
import { isUserOnAdminList } from '../utils/telegram'

class TelegramBotService extends TelegramBot {
    constructor(token: string, options: TelegramBot.ConstructorOptions) {
        super(token, options)
        this.registerCommands()
    }

    private registerCommands() {
        /**
         * Admin commands
         */
        // /getstate - Get the current state of the bot
        this.onCommand(
            /\/getstate/,
            async (msg) => {
                if (!AppState) {
                    return this.sendMessage(msg.chat.id, 'State is currently unavailable.')
                }

                // Omzetten van Maps naar objecten, omdat JSON.stringify Maps niet direct ondersteunt
                const groups = AppState.groupsArray.map(([groupId, group]) => {
                    return {
                        [groupId]: {
                            ...group,
                            upsIds: [...group.upsIds],
                        },
                    }
                })
                const state = {
                    system: Object.fromEntries(AppState.system),
                    groups,
                    ups: Object.fromEntries(AppState.upsList),
                    pendingUserQueries: Object.fromEntries(AppState.pendingUserQueries),
                }

                const formattedState = JSON.stringify(state, null, 2)

                this.sendMessage(msg.chat.id, `<pre>${formattedState}</pre>`, { parse_mode: 'HTML' })
            },
            { admin: true },
        )
        // /wakebot - Wake up the bot
        this.onCommand(
            /\/wakebot/,
            async (msg) => {
                const botStatus = AppState.botStatus
                if (botStatus !== 'running') {
                    AppState.botStatus = 'running'
                    this.sendMessage(msg.chat.id, `Hi ${msg.from?.first_name}, bot is up and running!`)
                } else {
                    this.sendMessage(msg.chat.id, `Hi ${msg.from?.first_name}, I am already Awake.`)
                }
            },
            { admin: true },
        )
        // /gotosleep - Shutdown the bot
        this.onCommand(
            /\/gotosleep/,
            async (msg) => {
                this.sendMessage(msg.chat.id, `Goodbye ${msg.from?.first_name}, shutting down! 💤`)
                AppState.botStatus = 'idle'
            },
            { admin: true },
        )
        // /getgroupid - Get group ID
        this.onCommand(
            /\/getgroupid/,
            async (msg) => {
                this.sendMessage(msg.chat.id, `Group ID: ${msg.chat.id}`)
            },
            { admin: true, group: true },
        )
        // /getgrouplist - Get list of all groups
        this.onCommand(
            /\/getgrouplist/,
            async (msg) => {
                const groups = AppState.groupsArray
                const telegramGroupsPromises = groups.map(async ([groupId, groupInfo]) => {
                    // TODO: Implement the check on error's if not exist. Now it will crash and just set it to null
                    try {
                        const chatinfo = await this.getChat(groupId)
                        const returnGroup = {
                            groupId,
                            groupName: chatinfo.title,
                            groupInfo: {
                                ...groupInfo,
                                upsIds: [...groupInfo.upsIds],
                            },
                        }
                        return returnGroup
                    } catch (error: any) {
                        if ('code' in error && 'response' in error) {
                            const telegramError = error as TelegramError
                            if (telegramError.code === 'ETELEGRAM') {
                                if (telegramError.response.body.description === 'Bad Request: chat not found') {
                                    console.log(`Group with id ${groupId} not found, deleting group`)
                                    AppState.deleteGroup(groupId)
                                }
                            }
                        }
                        return
                    }
                })
                const telegramGroups = await Promise.all(telegramGroupsPromises)

                this.sendMessage(msg.chat.id, `<pre>${JSON.stringify(telegramGroups, null, 2)}</pre>`, { parse_mode: 'HTML' })
            },
            { admin: true },
        )
        // /getupslist - Get list with all UPSs
        this.onCommand(
            /\/getupslist/,
            async (msg) => {
                const upsList = [...AppState.upsList.values()].map((ups) => JSON.stringify(ups, null, 2))
                if (upsList.length < 1) {
                    return this.sendMessage(msg.chat.id, 'No UPSs available')
                }
                this.sendMessage(msg.chat.id, `<pre>${upsList}</pre>`, { parse_mode: 'HTML' })
            },
            { admin: true },
        )
        // /addups - Add new UPS
        this.onCommand(
            /\/addups/,
            async (msg) => {
                AppState.setPendingUserQuery(msg, 'WAITING_FOR_NEW_UPS')
                this.sendMessage(msg.chat.id, 'Please enter the ID of the UPS')

                const secondMessageHandler = async (queryMsg: TelegramBot.Message) => {
                    if (msg.chat.id !== queryMsg.chat.id) return
                    if (msg.from?.id !== queryMsg.from?.id) return

                    const query = AppState.pendingUserQueries.get(msg.chat.id)
                    if (query && query.queryString === 'WAITING_FOR_NEW_UPS') {
                        if (!queryMsg.text) {
                            this.sendMessage(queryMsg.chat.id, 'Please enter a valid name')
                            return
                        }

                        if ([...AppState.upsList.values()].some((ups) => ups.name === queryMsg.text)) {
                            this.sendMessage(queryMsg.chat.id, 'UPS with that name already exists, pick another one')
                            return
                        }

                        try {
                            const newUps = {
                                upsId: Number(query.inputs[0]),
                                name: queryMsg.text,
                                dateCreated: Date.now(),
                            }

                            await AppState.addUps(newUps)
                            const upsList = [...AppState.upsList.values()].map((ups) => JSON.stringify(ups, null, 2))

                            this.sendMessage(
                                queryMsg.chat.id,
                                `UPS with ID ${newUps.upsId} and name ${newUps.name} added.\r<pre>${upsList}</pre>`,
                                { parse_mode: 'HTML' },
                            )
                        } catch (error) {
                            this.sendErrorMessage(queryMsg.chat.id, error)
                        } finally {
                            AppState.clearPendingUserQuery(msg.chat.id)
                            this.removeListener('message', secondMessageHandler)
                        }
                    }
                }

                const firstMessageHandler = (queryMsg: TelegramBot.Message) => {
                    if (msg.chat.id !== queryMsg.chat.id) return
                    if (msg.from?.id !== queryMsg.from?.id) return

                    const query = AppState.pendingUserQueries.get(msg.chat.id)
                    if (query && query.queryString === 'WAITING_FOR_NEW_UPS') {
                        if (!queryMsg.text || isNaN(Number(queryMsg.text))) {
                            return this.sendMessage(queryMsg.chat.id, 'Please enter a valid ID')
                        }

                        if ([...AppState.upsList.values()].some((ups) => ups.upsId === Number(queryMsg.text))) {
                            this.sendMessage(queryMsg.chat.id, 'UPS with that ID already exists')
                            this.removeListener('message', firstMessageHandler)
                            return
                        }

                        AppState.updatePendingUserQueryInput(msg.chat.id, queryMsg.text)
                        this.sendMessage(queryMsg.chat.id, 'What is the name of the UPS?')
                        this.removeListener('message', firstMessageHandler)
                        this.on('message', secondMessageHandler)
                    }
                }

                this.on('message', firstMessageHandler)
            },
            { admin: true },
        )
        // /deleteups - Delete UPS
        this.onCommand(
            /\/deleteups/,
            async (msg) => {
                const chatId = msg.chat.id

                const upsList = [...AppState.upsList.values()]
                if (upsList.length < 1) {
                    return this.sendMessage(chatId, 'No UPSs available to delete')
                }

                const upsButtons = upsList.map((ups) => {
                    return [
                        {
                            text: ups.name,
                            callback_data: ups.upsId.toString(),
                        },
                    ]
                })

                this.sendMessage(chatId, 'Which UPS do you want to delete:', {
                    reply_markup: {
                        inline_keyboard: [...upsButtons, [{ text: 'All UPS', callback_data: 'all' }]],
                        resize_keyboard: true,
                        one_time_keyboard: true,
                    },
                })

                AppState.setPendingUserQuery(msg, 'WAITING_FOR_DELETE_UPS')
            },
            { admin: true },
        )
        // /updateups - Update UPS
        this.onCommand(
            /\/updateups/,
            async (msg) => {
                AppState.setPendingUserQuery(msg, 'WAITING_FOR_UPDATE_UPS')
                const chatId = msg.chat.id

                const upsList = [...AppState.upsList.values()]
                if (upsList.length < 1) {
                    return this.sendMessage(chatId, 'No UPSs available to update')
                }

                const upsButtons = upsList.map((ups) => {
                    return [
                        {
                            text: ups.name,
                            callback_data: ups.upsId.toString(),
                        },
                    ]
                })

                const options: SendMessageOptions = {
                    reply_markup: {
                        inline_keyboard: upsButtons,
                        resize_keyboard: true,
                        one_time_keyboard: true,
                    },
                }

                this.sendMessage(chatId, 'Which UPS do you want to update:', options)
            },
            { admin: true },
        )
        // /subscripegroup - Subscripe to a group
        this.onCommand(
            /\/subscripegroup/,
            async (msg) => {
                const chatId = msg.chat.id

                const upsList = [...AppState.upsList.values()]
                if (upsList.length < 1) {
                    return this.sendMessage(chatId, 'No UPS available to subscripe to')
                }

                const upsButtons = upsList.map((ups) => {
                    return [
                        {
                            text: ups.name,
                            callback_data: ups.upsId.toString(),
                        },
                    ]
                })
                const allUpsIds = [...AppState.upsList.keys()].join(',')
                AppState.setPendingUserQuery(msg, 'WAITING_FOR_SUBSCRIPE_BUTTONS')

                const options: SendMessageOptions = {
                    reply_markup: {
                        inline_keyboard: [...upsButtons, [{ text: 'All UPS', callback_data: allUpsIds }]],
                        resize_keyboard: true,
                        one_time_keyboard: true,
                    },
                }

                this.sendMessage(chatId, 'Which UPS do you want to subscripe to:', options)
            },
            { group: true, admin: true },
        )
        this.onCommand(
            /\/unsubscripegroup/,
            async (msg) => {
                const chatId = msg.chat.id
                const currentGroup = AppState.groups.get(chatId)

                if (!currentGroup?.upsIds?.size) {
                    return this.sendMessage(chatId, 'This group does not have any subscriptions yet.')
                }
                AppState.setPendingUserQuery(msg, 'WAITING_FOR_UNSUBSCRIPE_BUTTONS')
                const allUpsIds = [...currentGroup.upsIds.keys()].join(',')

                // TODO: Test when delete a UPS which a group is subscriped to
                const upsButtons = [...currentGroup.upsIds.values()].map((upsId) => {
                    const ups = AppState.upsList.get(upsId)
                    if (!ups) return []

                    return [
                        {
                            text: ups.name,
                            callback_data: ups.upsId.toString(),
                        },
                    ]
                })

                const options: SendMessageOptions = {
                    reply_markup: {
                        inline_keyboard: [...upsButtons, [{ text: 'All UPS', callback_data: allUpsIds }]],
                        resize_keyboard: true,
                        one_time_keyboard: true,
                    },
                }

                this.sendMessage(chatId, 'Which UPS do you want to unsubscripe from:', options)
            },
            { group: true, admin: true },
        )
        // TODO: Add user to admin list
        this.on('chat_member', (msg) => {
            console.log(msg)
            const newStatus = msg.new_chat_member?.status
            const oldStatus = msg.old_chat_member?.status
            const user = msg.new_chat_member?.user

            if (oldStatus !== 'administrator' && newStatus === 'administrator') {
                this.sendMessage(msg.chat.id, `${user?.first_name} is now an admin! 🚀`)
            }
        })
        // TODO: Remove user from admin list

        /**
         * User commands
         */
        // /whoami - Get userinfo
        this.onCommand(/\/whoami/, async (msg) => {
            this.sendMessage(msg.chat.id, `<pre>${JSON.stringify(msg.from, null, 2)}</pre>`, { parse_mode: 'HTML' })
        })
        // TODO: Get IMAP service status
        this.onCommand(/\/getbotstatus/, async (msg) => {
            super.sendMessage(msg.chat.id, `Bot status: ${AppState.botStatus}`)
        })
        // /help - Get list of all commands
        this.onCommand(/\/help/, async (msg) => {
            const commands = [
                { command: '/wakebot', description: 'Wake up the bot', admin: true },
                { command: '/gotosleep', description: 'Shutdown the bot', admin: true },
                { command: '/getgroupid', description: 'Get the group ID', admin: true },
                { command: '/getgrouplist', description: 'Get a list of all groups', admin: true },
                { command: '/getupslist', description: 'Get a list of all UPSs', admin: true },
                { command: '/addups', description: 'Add a new UPS', admin: true },
                { command: '/deleteups', description: 'Delete a UPS', admin: true },
                { command: '/updateups', description: 'Update a UPS', admin: true },
                { command: '/subscripegroup', description: 'Subscripe to a group', admin: true },
                { command: '/unsubscripegroup', description: 'Unsubscripe from a group', admin: true },
                { command: '/addadmin', description: 'Add user to admin list', admin: true },
                { command: '/removeadmin', description: 'Remove user from admin list', admin: true },
                { command: '/startimapservice', description: 'Start IMAP service', admin: true },
                { command: '/stopimapservice', description: 'Stop IMAP service', admin: true },
                { command: '/restartimapservice', description: 'Restart IMAP service', admin: true },
                { command: '/getimapstatus', description: 'Get IMAP service status', admin: true },
                { command: '/whoami', description: 'Get your user info', admin: false },
                { command: '/getbotstatus', description: 'Get the current status of the bot', admin: false },
                { command: '/getlastupsmessage', description: 'Get last message from UPSs', admin: false },
                { command: '/gettodayupsmessage', description: 'Get all messages from today from UPSs', admin: false },
            ]

            const adminCommands = commands.filter((command) => command.admin)
            const userCommands = commands.filter((command) => !command.admin)

            let commandList = 'List of available commands:\n\n'
            commandList += '*Admin Commands:*\n'
            commandList += adminCommands.map((cmd) => `${cmd.command} - ${cmd.description}`).join('\n')
            commandList += '\n\n'
            commandList += '*User Commands:*\n'
            commandList += userCommands.map((cmd) => `${cmd.command} - ${cmd.description}`).join('\n')

            this.sendMessage(msg.chat.id, commandList, { parse_mode: 'Markdown' })
        })
        // TODO: Get last message from UPSs
        // TODO: Get all messages from today from UPSs

        /**
         * Callback queries
         */
        this.on('callback_query', async (callbackQuery) => {
            // Check if the message and data is not empty
            const { message: msg, data, from } = callbackQuery
            if (!msg || !data || !from) return

            try {
                const query = AppState.pendingUserQueries.get(msg.chat.id)

                if (query) {
                    // Check if the query is issued by the same user
                    if (query.issuedBy !== from.id) return

                    // Check if user is an admin
                    // This maybe not needed, because the query is already checked in the onCommand function
                    // if (!(await this.isAdmin(msg.chat.id, from.id))) return

                    switch (query.queryString) {
                        /**
                         * CALLBACK QUERY FOR DELETING UPS
                         */
                        case 'WAITING_FOR_DELETE_UPS': {
                            // TODO: Implement unsubscriping groups from UPS when deleting

                            const upsId = Number(data)

                            try {
                                if (data === 'all') {
                                    if (AppState.upsList.size === 0) {
                                        this.sendMessage(msg.chat.id, 'No UPSs available to delete')
                                        return
                                    }

                                    await AppState.deleteAllUps()

                                    this.sendMessage(msg.chat.id, 'All UPSs deleted')
                                    AppState.clearPendingUserQuery(msg.chat.id)
                                } else {
                                    const ups1 = AppState.upsList.get(upsId)

                                    if (!ups1) {
                                        this.sendMessage(msg.chat.id, `UPS with ID ${upsId} not found`)
                                        return
                                    }

                                    await AppState.deleteUps(upsId)

                                    this.sendMessage(msg.chat.id, `UPS "${ups1.name}" deleted`)
                                    AppState.clearPendingUserQuery(msg.chat.id)
                                }
                            } catch (error) {
                                this.sendErrorMessage(msg.chat.id, error)
                            }
                            break
                        }
                        case 'WAITING_FOR_UPDATE_UPS': {
                            const upsId = Number(data)
                            const ups = AppState.upsList.get(upsId)

                            if (!ups) {
                                this.sendMessage(msg.chat.id, `UPS with ID ${upsId} not found`)
                                return
                            }

                            this.sendMessage(msg.chat.id, `What is the new name for UPS with ID ${upsId}?`)

                            const updateUpsHandler = async (queryMsg: TelegramBot.Message) => {
                                if (msg.chat.id !== queryMsg.chat.id) return
                                if (from?.id !== queryMsg.from?.id) return

                                const query = AppState.pendingUserQueries.get(msg.chat.id)
                                if (query && query.queryString === 'WAITING_FOR_UPDATE_UPS') {
                                    if (!queryMsg.text) {
                                        this.sendMessage(queryMsg.chat.id, 'Please enter a valid name')
                                        return
                                    }

                                    if ([...AppState.upsList.values()].some((ups) => ups.name === queryMsg.text)) {
                                        this.sendMessage(queryMsg.chat.id, 'UPS with that name already exists, pick another one')
                                        return
                                    }

                                    try {
                                        await AppState.updateUpsName(upsId, queryMsg.text)

                                        this.sendMessage(queryMsg.chat.id, `UPS with ID ${upsId} updated to "${queryMsg.text}"`)
                                    } catch (error) {
                                        console.error(error)
                                        this.sendErrorMessage(queryMsg.chat.id, error)
                                    } finally {
                                        AppState.clearPendingUserQuery(msg.chat.id)
                                        this.removeListener('message', updateUpsHandler)
                                    }
                                }
                            }
                            this.on('message', updateUpsHandler)

                            break
                        }
                        case 'WAITING_FOR_SUBSCRIPE_BUTTONS': {
                            try {
                                const upsIds = data.split(',').map(Number)

                                await AppState.subscripeGroupToUps(msg.chat.id, upsIds)

                                this.sendMessage(msg.chat.id, `Group subscribed to UPSs with ID(s): ${upsIds.join(', ')}`)
                            } catch (error) {
                                this.sendErrorMessage(msg.chat.id, error)
                            }

                            break
                        }
                        case 'WAITING_FOR_UNSUBSCRIPE_BUTTONS': {
                            const upsId = data.split(',').map(Number)
                            const currentGroup = AppState.groups.get(msg.chat.id)

                            if (!currentGroup) {
                                return this.sendMessage(msg.chat.id, 'This group does not have any subscriptions yet.')
                            }

                            try {
                                await AppState.unsubscripeGroupFromUps(msg.chat.id, upsId)

                                this.sendMessage(msg.chat.id, `Group unsubscribed from UPS with ID ${upsId}`)
                            } catch (error) {
                                this.sendErrorMessage(msg.chat.id, error)
                            }
                            break
                        }
                    }
                }
            } catch (err) {
                console.error(err)
                this.sendErrorMessage(msg.chat.id, err)
            }
        })

        /**
         * Polling error
         */
        this.on('polling_error', (err) => {
            if (this.isPolling()) this.stopPolling()

            this.startPolling()

            console.log(`There was a polling error:\r${JSON.stringify(err.message, null, 2)}.\rRestarting polling...`)
        })

        /**
         * Other events
         */

        // Check if bot is added to a group by a superadmin
        this.on('my_chat_member', async (msg) => {
            if (msg.new_chat_member?.status === 'member') {
                if (await this.isSuperAdmin(msg.from.id)) {
                    this.sendMessage(msg.chat.id, config.telegram.welcomeMessage(msg.chat.title || 'this chat'), {
                        parse_mode: 'HTML',
                    })
                } else {
                    this.sendMessage(msg.chat.id, 'Only superadmins can add this bot to a group! 👮‍♂️')
                    this.leaveChat(msg.chat.id).then(() => {
                        console.log(`Bot left the group because ${msg.from.id} did not have permission.`)
                    })
                }
            }
        })
    }

    public async sendMessage(
        chatId: TelegramBot.ChatId,
        text: string,
        options?: TelegramBot.SendMessageOptions,
    ): Promise<TelegramBot.Message> {
        if (AppState.botStatus === 'idle') {
            return super.sendMessage(chatId, 'Zzzzz ZZZzz zzzZ ZZzzz 😴')
        }
        return super.sendMessage(chatId, text, options)
    }

    private onCommand(
        regexp: RegExp,
        callback: (msg: TelegramBot.Message, match: RegExpExecArray | null) => void,
        options: OnCommandOptions = { admin: false, group: false },
    ) {
        return super.onText(regexp, async (msg, match) => {
            try {
                // Check if command is only for use by admin
                if (msg.from?.id !== config.telegram.creatorId && options?.admin) {
                    if (!msg.from?.id) return

                    // Check if user is admin in group and in database
                    if (!(await this.isAdmin(msg.chat.id, msg.from.id))) return
                }

                // Check if command is only for use in group chats
                if (options?.group && msg.chat.type !== 'group' && msg.chat.type !== 'supergroup') {
                    return this.sendMessage(msg.chat.id, 'This command can only be used in group chats')
                }

                callback(msg, match)
            } catch (error: unknown) {
                this.sendErrorMessage(msg.chat.id, error)
            }
        })
    }

    private sendErrorMessage(chatId: TelegramBot.ChatId, error: unknown) {
        if (error instanceof Error) {
            super.sendMessage(chatId, `😰 An error occurred: ${error.message}`)
        } else {
            super.sendMessage(chatId, `😰 An unknown error occurred: ${error}`)
        }
    }

    private async isAdmin(chatId: number, userId: number) {
        if (!chatId || !userId) return false

        const admins = await this.getChatAdministrators(chatId)
        return admins.some((admin) => admin.user.id === userId)
    }

    private async isSuperAdmin(userId: number) {
        return userId === config.telegram.creatorId || (await isUserOnAdminList(userId))
    }
}

export default TelegramBotService
