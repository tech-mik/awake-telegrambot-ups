import TelegramBot from 'node-telegram-bot-api'
import { SelectTelegramGroupTable, SelectUpsTable } from '../schemas/telegram-bot'

export type State = {
    system: Map<keyof SystemState, SystemState[keyof SystemState]>
    groups: Map<StateGroup['groupId'], Omit<StateGroup, 'groupId'>>
    ups: Map<SelectUpsTable['upsId'], StateUps>
    pendingUserQueries: Map<string | number, UserQuery>
}

export type SystemState = {
    botStatus?: 'running' | 'idle' | 'error'
}

export type StateGroup = Pick<SelectTelegramGroupTable, 'groupId' | 'dateCreated'> & {
    upsIds: Set<SelectUpsTable['upsId']>
}

export type StateUps = Omit<SelectUpsTable, 'dateUpdated' | 'dateCreated'> & {
    dateCreated: string
}

export interface UserQuery {
    queryString: UserQueryString
    inputs: string[]
    issuedBy: TelegramBot.User['id']
}

export type UserQueryString =
    | 'WAITING_FOR_SUBSCRIPE_BUTTONS'
    | 'WAITING_FOR_IMAP_START'
    | 'WAITING_FOR_NEW_UPS'
    | 'WAITING_FOR_DELETE_UPS'
    | 'WAITING_FOR_UPDATE_UPS'
    | 'WAITING_FOR_UNSUBSCRIPE_BUTTONS'
    | 'WAITING_FOR_STATUS'
