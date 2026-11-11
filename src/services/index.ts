import { mockAdmin } from './mock/admin'
import { mockAppConfig } from './mock/app-config'
import { mockAuth } from './mock/auth'
import { mockBookings } from './mock/bookings'
import { mockEvents } from './mock/events'
import { mockProfile } from './mock/profile'
import { mockNotifications } from './mock/notifications'
import { mockReference } from './mock/reference'
import { mockSquads } from './mock/squads'
import { mockUpload } from './mock/upload'
import { realAdmin } from './real/admin'
import { realAppConfig } from './real/app-config'
import { realAuth } from './real/auth'
import { realBookings } from './real/bookings'
import { realEvents } from './real/events'
import { realProfile } from './real/profile'
import { realNotifications } from './real/notifications'
import { realReference } from './real/reference'
import { realSquads } from './real/squads'
import { realUpload } from './real/upload'
import type { AdminService } from './types/admin'
import type { AppConfigService } from './types/app-config'
import type { AuthService } from './types/auth'
import type { BookingsService } from './types/bookings'
import type { NotificationsService } from './types/notifications'
import type { SquadsService } from './types/squads'
import type { EventsService } from './types/events'
import type { ProfileService } from './types/profile'
import type { ReferenceService } from './types/reference'
import type { UploadService } from './types/upload'

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
  upload: UploadService
  admin: AdminService
  events: EventsService
  bookings: BookingsService
  squads: SquadsService
  notifications: NotificationsService
} = real
  ? { auth: realAuth, profile: realProfile, appConfig: realAppConfig, reference: realReference, upload: realUpload, admin: realAdmin, events: realEvents, bookings: realBookings, squads: realSquads, notifications: realNotifications }
  : { auth: mockAuth, profile: mockProfile, appConfig: mockAppConfig, reference: mockReference, upload: mockUpload, admin: mockAdmin, events: mockEvents, bookings: mockBookings, squads: mockSquads, notifications: mockNotifications }

export { ServiceError, errorMessage } from './types/errors'
export type { AuthUser } from './types/auth'
export type * from './types/profile'
export type { AppConfig } from './types/app-config'
export type { ReferenceData, ReferenceItem } from './types/reference'
export type { PendingVerification, HostApplication, AdminEvent, AdminHub, HubInput } from './types/admin'
export type * from './types/events'
export type * from './types/bookings'
export type * from './types/squads'
export type * from './types/notifications'
export type { JobRun } from './types/admin'
export type { UploadPurpose } from './types/upload'
