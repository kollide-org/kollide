/** What other members can see of you. Each one is enforced by the services, not only hidden in the interface. */
export interface PrivacySettings {
  /** Your photo can appear in the small row of faces on event cards. Off: you are still going, just not pictured. */
  showOnEventCards: boolean
  /** People you checked in with can say they would meet you again. Off: the option is not offered to them. */
  openToMeetAgain: boolean
}

/**
 * Topics a member can switch off. Bookings, payments, safety and account
 * messages are not listed: those are always sent.
 */
export type NotificationTopic = 'reminders' | 'squads' | 'meet_again' | 'new_events'

export type NotificationChannel = 'email' | 'push'

export type NotificationSettings = Record<NotificationTopic, Record<NotificationChannel, boolean>>

export interface Settings {
  privacy: PrivacySettings
  notifications: NotificationSettings
}

export interface SettingsPatch {
  privacy?: Partial<PrivacySettings>
  notifications?: Partial<Record<NotificationTopic, Partial<Record<NotificationChannel, boolean>>>>
}

export const DEFAULT_SETTINGS: Settings = {
  privacy: { showOnEventCards: true, openToMeetAgain: true },
  notifications: {
    reminders: { email: true, push: true },
    squads: { email: false, push: true },
    meet_again: { email: true, push: true },
    new_events: { email: false, push: false },
  },
}
