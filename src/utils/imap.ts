import { UPSMail } from '../types/imap'

export const parseSender = (sender: string | undefined): string | undefined => {
    if (!sender) return undefined

    let parsedMail = sender.split('<')
    parsedMail = parsedMail[1].split('>')
    return parsedMail[0]
}

export const parseMail = (mail: string): UPSMail => {
    const parsedLines = mail.split('\n')

    const [type, message] = parsedLines[1].replace(/\s+/g, '').split(':')
    const [name, id] = parsedLines[2].replace(/\s+/g, '').split('-')
    const dateStr = parsedLines[3].split('Occurred:')[1].trim()
    const formattedDateStr = dateStr.replace(',', '')
    const date = Date.parse(formattedDateStr)

    return {
        type,
        message,
        upsId: id,
        eventDate: date,
    } as unknown as UPSMail
}

export const generateUniqueString = (length: number = 12): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let uniqueString = ''

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length)
        uniqueString += characters[randomIndex]
    }

    return uniqueString
}

/**
 * This function creates a greeting based on the current time of the day.
 *
 * Between 6 and 12, it returns 'Good morning'
 *
 * Between 12 and 18, it returns 'Good afternoon'
 *
 * Between 18 and 24, it returns 'Good evening'
 *
 * Otherwise, it returns 'Good night'
 */
export const getGreeting = () => {
    const currentHour = new Date().getHours()
    let greeting = ''

    if (currentHour >= 6 && currentHour < 12) {
        greeting = 'Good morning'
    } else if (currentHour >= 12 && currentHour < 18) {
        greeting = 'Good afternoon'
    } else if (currentHour >= 18 && currentHour < 24) {
        greeting = 'Good evening'
    } else {
        greeting = 'Good night'
    }

    return greeting
}
