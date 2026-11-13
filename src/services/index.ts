import { SERVICE_MODE } from './config'
import type { Services } from './interfaces'
import type { Role, Session } from './types'

/**
 * The only place the app chooses between mock and real services.
 * Set VITE_SERVICES=real to use the real backend. Everything else imports
 * from this file and never knows which one it got.
 *
 * The chosen implementation is loaded on first use, in its own chunk, so the
 * mock backend and its seed data never slow down the first screen.
 */
let loading: Promise<Services> | null = null

function loadServices(): Promise<Services> {
  loading ??=
    SERVICE_MODE === 'real'
      ? import('./real').then((module) => module.realServices)
      : import('./mock').then((module) => module.mockServices)
  return loading
}

/** A stand-in that forwards each call to the real object once it has loaded. */
function lazy<K extends keyof Services>(name: K): Services[K] {
  return new Proxy({} as Services[K], {
    get:
      (_target, method) =>
      async (...args: unknown[]) => {
        const service = (await loadServices())[name] as unknown as Record<PropertyKey, (...input: unknown[]) => unknown>
        return service[method](...args)
      },
  })
}

export const authService = lazy('authService')
export const profileService = lazy('profileService')
export const eventService = lazy('eventService')
export const bookingService = lazy('bookingService')
export const squadService = lazy('squadService')
export const reviewService = lazy('reviewService')
export const paymentService = lazy('paymentService')
export const adminService = lazy('adminService')
export const notificationService = lazy('notificationService')

/** Development helpers for the role switcher and the mock sign-in screens. */
export interface DevTools {
  /** The only email code the mock sign-in accepts. */
  emailCode: string
  /** Signs in as the seeded account for a role, or signs out for "visitor". */
  signInAs(role: Role): Promise<Session | null>
  /** Throws away every change and reseeds. */
  resetData(): Promise<void>
}

const mockDevTools = () => import('./mock').then((module) => module.mockDevTools)

/** `null` when real services are in use. */
export const devTools: DevTools | null =
  SERVICE_MODE === 'mock'
    ? {
        emailCode: '123456',
        signInAs: async (role) => (await mockDevTools()).signInAs(role),
        resetData: async () => (await mockDevTools()).resetData(),
      }
    : null

export { SERVICE_MODE } from './config'
export { ServiceError, isServiceError, type ServiceErrorCode } from './errors'
export type * from './interfaces'
export type * from './types'
