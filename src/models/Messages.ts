import { db } from '../lib/db'
import logger from '../lib/logger'
import { InsertMessageTable, messagesTable } from '../schemas/telegram-bot'

export async function createMessage(message: InsertMessageTable) {
    try {
        await db.insert(messagesTable).values(message)
    } catch (error) {
        logger.error('Error inserting message')
    }
}
