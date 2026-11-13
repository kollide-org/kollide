import { ServiceError } from '../errors'
import type { Services } from '../interfaces'

/**
 * Where the real backend plugs in.
 *
 * Nothing is decided about the backend yet, so every method here rejects with
 * `not_implemented`. To connect one, replace each placeholder with an object
 * that implements the matching interface in `../interfaces`, for example
 * `authService: createHttpAuthService(apiClient)`. No component changes.
 */
function notImplemented<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get: (_target, method) => () =>
      Promise.reject(new ServiceError('not_implemented', `${name}.${String(method)} has no real implementation yet.`)),
  })
}

export const realServices: Services = {
  authService: notImplemented('authService'),
  profileService: notImplemented('profileService'),
  eventService: notImplemented('eventService'),
  bookingService: notImplemented('bookingService'),
  squadService: notImplemented('squadService'),
  reviewService: notImplemented('reviewService'),
  paymentService: notImplemented('paymentService'),
  adminService: notImplemented('adminService'),
  notificationService: notImplemented('notificationService'),
}
