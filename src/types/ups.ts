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

export type eventType = 'informational' | 'warning' | 'critical'
export enum UpsTypeMsg {
    'informational' = 'ℹ️ Informational',
    'warning' = '⚠️ Warning',
    'critical' = '🚨 Critical',
}

export type UpsMessage = (upsName: string, event: UpsEvents, type: eventType, timestamp: string) => string
