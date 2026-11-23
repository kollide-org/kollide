import type { SettingsService } from '../interfaces'
import { DEFAULT_SETTINGS, type ID, type NotificationTopic, type Settings } from '../types'

import { getDb, saveDb, type Db } from './db'
import { copy, latency, requireUser } from './runtime'

/** A member's settings, with the defaults filled in for anything they never changed. */
export function settingsOf(db: Db, userId: ID): Settings {
  const stored = db.settings[userId]
  return {
    privacy: { ...DEFAULT_SETTINGS.privacy, ...stored?.privacy },
    notifications: Object.fromEntries(
      (Object.keys(DEFAULT_SETTINGS.notifications) as NotificationTopic[]).map((topic) => [
        topic,
        { ...DEFAULT_SETTINGS.notifications[topic], ...stored?.notifications[topic] },
      ]),
    ) as Settings['notifications'],
  }
}

export const mockSettingsService: SettingsService = {
  async getSettings() {
    await latency(0.6)
    const db = getDb()
    const user = requireUser(db)
    return copy(settingsOf(db, user.id))
  },

  async updateSettings(patch) {
    await latency(0.4)
    const db = getDb()
    const user = requireUser(db)
    const current = settingsOf(db, user.id)
    const next: Settings = {
      privacy: { ...current.privacy, ...patch.privacy },
      notifications: { ...current.notifications },
    }
    for (const [topic, channels] of Object.entries(patch.notifications ?? {}) as [NotificationTopic, object][]) {
      if (topic in next.notifications) next.notifications[topic] = { ...next.notifications[topic], ...channels }
    }
    db.settings[user.id] = next
    saveDb()
    return copy(next)
  },
}
