import AppState from '../lib/state'
import { UpsTelegramMessage, upsEventTypeTitle } from '../types/ups'

export const generateTelegramMessage: UpsTelegramMessage = (level, upsName, message, timestamp) => {
    const upsLocation = AppState.upsList.get(upsName)?.location || ''

    return `${upsEventTypeTitle[level]}\n` + `🔌 ${upsName} - ${upsLocation}\n` + `${message}\n` + `${timestamp}`
}
