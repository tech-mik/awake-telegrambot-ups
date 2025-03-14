export interface UPSMail {
    type: 'Informational' | 'Critical' | 'Warning'
    message: string
    upsId: number
    eventDate: Date
}
