export type OnCommandOptions =
    | {
          admin?: boolean
          group?: boolean
      }
    | undefined

export interface TelegramErrorETELEGRAM extends Error {
    code: 'ETELEGRAM'
    response: {
        body: {
            ok: boolean
            error_code: number
            description: string
        }
    }
}

export interface TelegramErrorEFATAL extends Error {
    code: 'EFATAL'
}

export interface TelegramErrorEPARSE extends Error {
    code: 'EPARSE'
    response: {
        body: string
    }
}

export type TelegramError = TelegramErrorETELEGRAM | TelegramErrorEFATAL | TelegramErrorEPARSE
