import { SERVICE_MODE } from './config'
import type { Services } from './interfaces'
import { mockDevTools, mockServices } from './mock'
import type { DevTools } from './mock/auth'
import { realServices } from './real'

/**
 * The only place the app chooses between mock and real services.
 * Set VITE_SERVICES=real to use the real backend. Everything else imports
 * from this file and never knows which one it got.
 */
const services: Services = SERVICE_MODE === 'real' ? realServices : mockServices

export const {
  authService,
  profileService,
  eventService,
  bookingService,
  squadService,
  reviewService,
  paymentService,
  adminService,
  notificationService,
} = services

/** Development helpers for the role switcher. `null` when real services are in use. */
export const devTools: DevTools | null = SERVICE_MODE === 'mock' ? mockDevTools : null

export { SERVICE_MODE } from './config'
export { ServiceError, isServiceError, type ServiceErrorCode } from './errors'
export type * from './interfaces'
export type * from './types'
