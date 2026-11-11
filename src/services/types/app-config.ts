export interface AppConfig {
  /** False in v1. The UI hides everything to do with paying while it is false. */
  paymentsEnabled: boolean
  /** The current version of the code of conduct and privacy notice. */
  noticeVersion: string
}

export interface AppConfigService {
  get(): Promise<AppConfig>
}
