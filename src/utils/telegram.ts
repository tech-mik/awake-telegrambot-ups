import { getAdminListFromSettings } from '../models/Settings.js'

export async function isUserOnAdminList(userId: number) {
    const adminList = await getAdminListFromSettings()
    return adminList.includes(userId.toString())
}
