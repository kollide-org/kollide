import type { Services } from '../interfaces'

import { mockAdminService } from './admin'
import { mockAuthService } from './auth'
import { mockBookingService } from './booking'
import { mockEventService } from './event'
import { mockNotificationService } from './notification'
import { mockPaymentService } from './payment'
import { mockProfileService } from './profile'
import { mockReviewService } from './review'
import { mockSquadService } from './squad'

export { mockDevTools } from './auth'

/** The whole backend, running in the browser. */
export const mockServices: Services = {
  authService: mockAuthService,
  profileService: mockProfileService,
  eventService: mockEventService,
  bookingService: mockBookingService,
  squadService: mockSquadService,
  reviewService: mockReviewService,
  paymentService: mockPaymentService,
  adminService: mockAdminService,
  notificationService: mockNotificationService,
}
