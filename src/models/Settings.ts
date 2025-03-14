import { db } from '../lib/db'
import { settingsTable } from '../schemas/telegram-bot'

export async function getAdminListFromSettings() {
    try {
        const { adminList } = (await db.select().from(settingsTable))[0]
        return adminList.split(',')
    } catch (error: any) {
        console.error(error)
        throw new Error('Error fetching admin list from settings')
    }
}
