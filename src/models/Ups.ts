import { eq } from 'drizzle-orm'
import { db } from '../lib/db'
import { InsertUpsTable, upsTable, SelectUpsTable } from '../schemas/telegram-bot'

export async function addNewUps(ups: InsertUpsTable) {
    try {
        await db.insert(upsTable).values(ups)
    } catch (error) {
        console.error('Error adding new ups', error)
        throw new Error('Something went wrong while adding new ups')
    }
}

export async function deleteUpsById(upsId: SelectUpsTable['upsId']) {
    try {
        await db.delete(upsTable).where(eq(upsTable.upsId, upsId))
        console.log(`Ups ${upsId} deleted`)
    } catch (error) {
        console.error('Error deleting ups', error)
        throw new Error('Something went wrong while deleting ups')
    }
}

export async function deleteAllUpsFromDb() {
    try {
        await db.delete(upsTable)
        console.log('All ups deleted')
    } catch (error) {
        console.error('Error deleting all ups', error)
        throw new Error('Something went wrong while deleting all ups')
    }
}

export async function updateUpsById(upsId: SelectUpsTable['upsId'], newUps: InsertUpsTable) {
    try {
        await db
            .update(upsTable)
            .set({ ...newUps })
            .where(eq(upsTable.upsId, upsId))
        console.log(`Ups ${upsId} updated`)
    } catch (error) {
        console.error('Error updating ups', error)
        throw new Error('Something went wrong while updating ups')
    }
}
