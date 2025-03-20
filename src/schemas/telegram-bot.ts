import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm'
import { index, int, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { config } from '../config'

export const upsTable = sqliteTable(
    'ups',
    {
        upsId: text('ups_id').primaryKey(),
        location: text().notNull(),
        dateCreated: int('date_created')
            .$defaultFn(() => Date.now())
            .notNull(),
        dateUpdated: int('date_updated')
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (t) => [index('ups_id_index').on(t.upsId)],
)
export type SelectUpsTable = InferSelectModel<typeof upsTable>
export type InsertUpsTable = InferInsertModel<typeof upsTable>

export const telegramGroupTable = sqliteTable(
    'telegram-groups',
    {
        id: int().primaryKey({ autoIncrement: true }),
        groupId: int('group_id').notNull(),
        upsIds: text('ups_ids'),
        dateCreated: int('date_created')
            .$defaultFn(() => Date.now())
            .notNull(),
        dateUpdated: int('date_updated')
            .$onUpdateFn(() => Date.now())
            .notNull(),
    },
    (t) => [index('group_id_index').on(t.groupId)],
)
export type SelectTelegramGroupTable = InferSelectModel<typeof telegramGroupTable>
export type InsertTelegramGroupTable = InferInsertModel<typeof telegramGroupTable>

export const messagesTable = sqliteTable(
    'messages',
    {
        id: int().primaryKey({ autoIncrement: true }),
        upsId: int('ups_id')
            .notNull()
            .references(() => upsTable.upsId, { onDelete: 'cascade' }),
        message: text().notNull(),
        dateCreated: int('date_created').$defaultFn(() => Date.now()),
        dateUpdated: int('date_updated').$onUpdateFn(() => Date.now()),
    },
    (t) => [index('message_id_index').on(t.id)],
)

export type SelectMessagesTable = InferSelectModel<typeof messagesTable>
export type InsertMessageTable = InferInsertModel<typeof messagesTable>

export const settingsTable = sqliteTable('settings', {
    adminList: text('admin_list').default(String(config.telegram.creatorId)).notNull(),
})

export type SelectSettingsTable = InferSelectModel<typeof settingsTable>
export type InsertSettingsTable = InferInsertModel<typeof settingsTable>
