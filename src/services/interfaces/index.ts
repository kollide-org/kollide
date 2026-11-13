import type { AdminService } from './admin'
import type { AuthService } from './auth'
import type { BookingService } from './booking'
import type { EventService } from './event'
import type { NotificationService } from './notification'
import type { PaymentService } from './payment'
import type { ProfileService } from './profile'
import type { ReviewService } from './review'
import type { SquadService } from './squad'

export type {
  AdminService,
  AuthService,
  BookingService,
  EventService,
  NotificationService,
  PaymentService,
  ProfileService,
  ReviewService,
  SquadService,
}

/** The full set. A mock and a real implementation each provide all nine. */
export interface Services {
  authService: AuthService
  profileService: ProfileService
  eventService: EventService
  bookingService: BookingService
  squadService: SquadService
  reviewService: ReviewService
  paymentService: PaymentService
  adminService: AdminService
  notificationService: NotificationService
}
