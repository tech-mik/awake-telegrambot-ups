import { UpsMessage, UpsTypeMsg } from '../types/ups'

export const generateUpsMessage: UpsMessage = (upsName, event, type, timestamp) => {
    const message = `${UpsTypeMsg[type]}\n` + `${upsName}\n` + `${event}\n` + `${timestamp}`

    return message
}
