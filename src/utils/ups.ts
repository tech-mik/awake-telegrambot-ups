import { UpsTelegramMessage, upsEventTypeTitle } from '../types/ups'

export const generateTelegramMessage: UpsTelegramMessage = (level, upsName, message, timestamp) => {
    return `${upsEventTypeTitle[level]}\n` + `${upsName}\n` + `${message}\n` + `${timestamp}`
}
