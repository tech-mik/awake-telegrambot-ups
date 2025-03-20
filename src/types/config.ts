import TelegramBot from 'node-telegram-bot-api'
import { SystemState } from './state'

export interface Config {
    telegram: {
        token: string
        options: TelegramBot.ConstructorOptions
        creatorId: number[]
        welcomeMessage: (title: string) => string
    }
    system: {
        initialStatus: SystemState['botStatus']
    }
}
