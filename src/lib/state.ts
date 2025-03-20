import { asc } from 'drizzle-orm'
import TelegramBot from 'node-telegram-bot-api'
import { config } from '../config'
import { InsertUpsTable, SelectUpsTable, telegramGroupTable, upsTable } from '../schemas/telegram-bot'
import { State, StateGroup, SystemState, UserQueryString } from '../types/state'
import { db } from './db'
import Group from '../models/Group'
import { addNewUps, deleteAllUpsFromDb, deleteUpsById, updateUpsById } from '../models/Ups'

class AppState {
    protected static state: State = {
        groups: new Map(),
        system: new Map(),
        ups: new Map(),
        pendingUserQueries: new Map(),
    }

    /**
     * Initialize the state
     */
    public static async init() {
        try {
            // Setting the system state
            this.state.system.set('botStatus', config.system.initialStatus)

            // Fetch groups from the database
            // and hydrate the groups state
            const res = await db.select().from(telegramGroupTable)

            const groups = res.map((group) => {
                const upsIds = group.upsIds
                    ? group.upsIds
                          .split(',')
                          .filter((upsId) => Boolean(upsId))
                          .map((upsId) => upsId.trim())
                    : []
                return {
                    ...group,
                    upsIds,
                }
            })

            if (groups.length) {
                groups.forEach((group) => {
                    const { groupId, ...rest } = group
                    const stateGroup = {
                        ...rest,
                        upsIds: new Set(rest.upsIds),
                    }
                    this.state.groups?.set(groupId, stateGroup)
                })
            }

            // Fetch ups from the database
            // and hydrate the ups state
            const upsList = await db.select().from(upsTable).orderBy(asc(upsTable.dateCreated))

            if (upsList.length) {
                upsList.forEach(({ location, upsId, dateCreated }) => {
                    this.state.ups.set(upsId.trim(), { upsId, location, dateCreated: new Date(dateCreated).toLocaleDateString() })
                })
            }
        } catch (error) {
            AppState.setBotStatus('error')
            console.error('Failed to initialize AppState:', error)
        }
    }

    /**
     * PENDING USER QUERIES
     */
    public static get system() {
        return this.state.system
    }
    public static setPendingUserQuery(msg: TelegramBot.Message, queryString: UserQueryString) {
        this.state.pendingUserQueries.set(msg.chat.id, { issuedBy: msg.from?.id ?? 0, queryString, inputs: [] })
    }
    public static clearPendingUserQuery(chatId: TelegramBot.ChatId) {
        this.state.pendingUserQueries.delete(chatId)
    }
    public static get pendingUserQueries() {
        return this.state.pendingUserQueries
    }
    public static updatePendingUserQueryInput(chatId: TelegramBot.Chat['id'], input: string) {
        const pendingUserQuery = this.state.pendingUserQueries.get(chatId)
        if (pendingUserQuery) {
            pendingUserQuery.inputs.push(input)
        }
    }

    /**
     * UPSs
     */
    public static get upsList() {
        return this.state.ups
    }
    public static async addUps(ups: Required<Omit<InsertUpsTable, 'dateUpdated'>>) {
        const newUps = {
            ...ups,
            dateCreated: new Date(ups.dateCreated).toLocaleDateString(),
        }
        await addNewUps(ups)
        this.state.ups.set(ups.upsId, newUps)
    }
    public static async updateUpsLocation(upsId: SelectUpsTable['upsId'], newLocation: string) {
        const ups = this.state.ups.get(upsId)
        if (!ups) return

        await updateUpsById(upsId, { location: newLocation })
        this.state.ups.set(upsId, { ...ups, location: newLocation })
    }
    public static async deleteUps(upsId: SelectUpsTable['upsId']) {
        await deleteUpsById(upsId)
        this.state.ups.delete(upsId)
    }
    public static async deleteAllUps() {
        await deleteAllUpsFromDb()
        AppState.upsList.clear()
    }

    /**
     * GROUPS
     */
    public static get groups() {
        return this.state.groups
    }
    public static get groupsString() {
        return Array.from(this.state.groups.entries()).map((group) => JSON.stringify(group, null, 4))
    }
    public static get groupsArray() {
        return Array.from(this.state.groups.entries())
    }
    public static getGroupInfo(groupId: StateGroup['groupId']) {
        return this.state.groups?.get(groupId)
    }
    public static async deleteGroup(groupId: StateGroup['groupId']) {
        await Group.deleteGroupById(groupId)
        this.state.groups.delete(groupId)
    }
    public static async subscripeGroupToUps(groupId: StateGroup['groupId'], upsIds: SelectUpsTable['upsId'][]) {
        let group = this.state.groups.get(groupId)
        if (!group) {
            const newGroup = await Group.createGroup(groupId)
            this.state.groups.set(groupId, {
                dateCreated: newGroup[0].dateCreated,
                upsIds: new Set(),
            })
            group = this.state.groups.get(groupId)
        }

        await Group.subscripeGroupToUps(groupId, upsIds)

        upsIds.forEach((upsId) => {
            group!.upsIds.add(upsId)
        })
    }
    public static async unsubscripeGroupFromUps(groupId: StateGroup['groupId'], upsIds: SelectUpsTable['upsId'][]) {
        const group = this.state.groups.get(groupId)
        if (!group) return

        await Group.unsubscripeGroupFromUps(groupId, upsIds)

        upsIds.forEach((upsId) => {
            group.upsIds.delete(upsId)
        })
    }

    /**
     * SYSTEM
     */
    public static get botStatus() {
        return this.state.system.get('botStatus')
    }
    public static set botStatus(status: SystemState['botStatus']) {
        this.state.system.set('botStatus', status)
    }
    public static setBotStatus(status: SystemState['botStatus']) {
        this.state.system.set('botStatus', status)
    }
}

// Hydrate the state from the database
AppState.init().catch((error) => {
    console.error('Failed to initialize AppState:', error)
})

export default AppState
