export type UpsEvents =
    | 'annoyme'
    | 'battattach'
    | 'battdetach'
    | 'changeme'
    | 'commfailure'
    | 'commok'
    | 'doshutdown'
    | 'emergency'
    | 'failing'
    | 'killpower'
    | 'loadlimit'
    | 'mainsback'
    | 'onbattery'
    | 'offbattery'
    | 'powerout'
    | 'remotedown'
    | 'runlimit'
    | 'timeout'
    | 'startselftest'
    | 'endselftest'

export interface UpsPayload {
    event: UpsEvents
    timestamp: string
    upsName: string
}

export type UpsEventLevel = 'info' | 'warning' | 'critical'

export const upsEventTypeTitle: Record<UpsEventLevel, string> = {
    info: 'ℹ️ Informational',
    warning: '⚠️ Warning',
    critical: '🚨 Critical',
}
export type UpsTelegramMessage = (level: UpsEventLevel, upsName: string, message: string, timestamp: string) => string
