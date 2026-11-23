import type { Settings, SettingsPatch } from '../types'

/** The signed-in member's own preferences. */
export interface SettingsService {
  getSettings(): Promise<Settings>
  /** Changes only the fields given and returns the whole set. */
  updateSettings(patch: SettingsPatch): Promise<Settings>
}
