import { mockAppConfig } from './mock/app-config'
import { mockAuth } from './mock/auth'
import { mockProfile } from './mock/profile'
import { mockReference } from './mock/reference'
import { realAppConfig } from './real/app-config'
import { realAuth } from './real/auth'
import { realProfile } from './real/profile'
import { realReference } from './real/reference'
import type { AppConfigService } from './types/app-config'
import type { AuthService } from './types/auth'
import type { ProfileService } from './types/profile'
import type { ReferenceService } from './types/reference'

/**
 * The one place that decides between the mock and the real backend.
 * Set VITE_SERVICES=real to use Supabase. Anything else, or nothing, uses the mock.
 * Components never import `./mock` or `./real` (a lint rule enforces it).
 */
const real = import.meta.env.VITE_SERVICES === 'real'

export const servicesMode: 'mock' | 'real' = real ? 'real' : 'mock'

export const services: {
  auth: AuthService
  profile: ProfileService
  appConfig: AppConfigService
  reference: ReferenceService
} = real
  ? { auth: realAuth, profile: realProfile, appConfig: realAppConfig, reference: realReference }
  : { auth: mockAuth, profile: mockProfile, appConfig: mockAppConfig, reference: mockReference }

export { ServiceError, errorMessage } from './types/errors'
export type { AuthUser } from './types/auth'
export type * from './types/profile'
export type { AppConfig } from './types/app-config'
export type { ReferenceData, ReferenceItem } from './types/reference'
