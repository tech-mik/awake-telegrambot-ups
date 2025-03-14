import { eq } from 'drizzle-orm'
import { db } from '../lib/db'
import { telegramGroupTable, SelectTelegramGroupTable, InsertTelegramGroupTable } from '../schemas/telegram-bot'
import AppState from '../lib/state'

async function createGroup(groupId: InsertTelegramGroupTable['groupId']) {
    try {
        console.log(groupId)
        const data = await db.insert(telegramGroupTable).values({ groupId }).returning()

        return data
    } catch (error) {
        console.error('Error adding group', error)
        throw new Error('Error adding group')
    }
}
async function deleteGroupById(groupId: SelectTelegramGroupTable['groupId']) {
    try {
        await db.delete(telegramGroupTable).where(eq(telegramGroupTable.groupId, groupId))
        console.log(`Group ${groupId} deleted`)
    } catch (error) {
        console.error(`Error deleting group width id ${groupId}`, error)
    }
}
async function subscripeGroupToUps(groupId: SelectTelegramGroupTable['groupId'], upsIds: number[]) {
    try {
        const currentGroups = AppState.groups.get(groupId)?.upsIds || []
        const newIds = Array.from(new Set([...currentGroups, ...upsIds])).join(',')

        await db.update(telegramGroupTable).set({ upsIds: newIds }).where(eq(telegramGroupTable.groupId, groupId))
        console.log(`Group ${groupId} subscribed to ups(s): ${newIds}`)
    } catch (error) {
        console.error('Error subscribing group to UPS(s)', error)
        throw new Error('Error subscribing group to UPS(s)')
    }
}
async function unsubscripeGroupFromUps(groupId: SelectTelegramGroupTable['groupId'], upsIds: number[]) {
    try {
        const currentGroup = AppState.groups.get(groupId)
        if (!currentGroup) throw new Error('Group not found in system')
        const newIds = [...currentGroup.upsIds].filter((id) => !upsIds.includes(id)).join(',')
        await db.update(telegramGroupTable).set({ upsIds: newIds }).where(eq(telegramGroupTable.groupId, groupId))
        console.log(`Group ${groupId} unsubscribed from ups(s): ${newIds}`)
    } catch (error) {
        console.error('Error unsubscribing group from UPS(s)', error)
        throw new Error('Error unsubscribing group from UPS(s)')
    }
}

export default {
    deleteGroupById,
    subscripeGroupToUps,
    unsubscripeGroupFromUps,
    createGroup,
}
