/** A failed service call. `code` is a short stable string (for example `under_18`) that the UI turns into words. */
export class ServiceError extends Error {
  code: string

  constructor(code: string, message?: string) {
    super(message ?? code)
    this.name = 'ServiceError'
    this.code = code
  }
}

const MESSAGES: Record<string, string> = {
  under_18: 'You must be 18 or older to join Kollide.',
  dob_required: 'Please enter your date of birth.',
  consent_required: 'Please accept the code of conduct and the privacy notice to continue.',
  notice_version_mismatch: 'The notices were updated. Please reload the page and accept the new version.',
  first_name_required: 'Please enter your first name.',
  last_name_invalid: 'That last name is too long.',
  phone_invalid: 'Use the international format for your phone number, for example +919876543210.',
  gender_required: 'Please choose an option for gender.',
  area_required: 'Please choose your area.',
  interests_invalid: 'Choose between 1 and 10 interests.',
  languages_invalid: 'Choose between 1 and 5 languages.',
  prompts_invalid: 'Answer 2 or 3 prompts, each with a short answer.',
  photos_required: 'Three photos are needed.',
  already_onboarded: 'Your profile is already set up.',
  not_active: 'Your account is not active right now. Please contact support.',
  not_onboarded: 'Please finish setting up your profile first.',
  not_signed_in: 'Please sign in again.',
  invalid_code: 'That code is wrong or has expired. Check the email and try again.',
  invalid_type: 'Please choose a picture.',
  too_large: 'That picture is too large. Try a smaller one.',
  not_allowed: 'You do not have permission to do that.',
  too_many_uploads: 'Too many uploads. Please wait a little and try again.',
  invalid_key: 'That upload expired. Please choose the picture again.',
  invalid_position: 'Photos go in position 1 to 3.',
  min_photos: 'Your profile needs at least one photo.',
  photo_not_found: 'That photo is already gone.',
  verification_pending: 'Your selfie is already waiting for review.',
  already_reviewed: 'That selfie was already reviewed.',
  not_found: 'We could not find that.',
  upload_failed: 'The upload did not finish. Please try again.',
  webp_unsupported: 'Your browser cannot prepare photos. Please update it and try again.',
  not_an_image: 'That file is not a picture we can read.',
  too_big_to_shrink: 'We could not make that picture small enough. Try a different one.',
  cover_required: 'Please add a cover photo before you submit.',
  address_required: 'Please add the exact address before you submit.',
  start_in_past: 'The event must start in the future.',
  dates_invalid: 'The event must end after it starts.',
  title_invalid: 'Please give the event a title of at least 3 characters.',
  description_too_long: 'The description is too long.',
  house_party_limit: 'A house party can have up to 25 guests.',
  house_party_type: 'Only community events can be house parties.',
  capacity_invalid: 'Capacity must be between 2 and 500.',
  age_invalid: 'Check the age range: the minimum is 18.',
  payments_off: 'Kollide does not take payments yet. Choose free, pay at the venue or cost split.',
  price_label_required: 'Tell people what to expect, for example “₹300 at the venue”.',
  price_label_invalid: 'That price text is too long.',
  event_locked: 'This event can no longer be changed that way.',
  type_locked: 'The type of an event cannot be changed.',
  invalid_input: 'Some of the details are not valid. Please check the form.',
  partner_url_required: 'A partner event needs an https ticket link.',
  partner_fields_not_allowed: 'Only partner events have a ticket link.',
  already_host: 'You are already a host.',
  application_pending: 'Your application is already with our team.',
  message_invalid: 'Please tell us a little about what you would like to host.',
  note_required: 'Please write a note for the host.',
  slug_taken: 'That hub address is already used.',
  slug_invalid: 'The address can only use lowercase letters, numbers and dashes.',
  color_invalid: 'Choose a valid colour.',
  event_not_published: 'Only published events can be featured.',
  invalid_status_change: 'That event is not in the right state for this.',
  women_only: 'This event is for women only.',
  age_not_allowed: 'This event has an age range that does not include you.',
  own_event: 'You are hosting this event.',
  event_started: 'This event has already started.',
  partner_event: 'Tickets for this event are sold on the partner’s site.',
  already_requested: 'You have already asked to join this event.',
  event_full: 'That event cannot take more people.',
  payments_disabled: 'Paid events are not open yet.',
  payments_not_implemented: 'Paid events are not open yet.',
  invalid_decision: 'Please choose approve, waitlist or decline.',
  invalid_booking_change: 'That booking has already changed. Please refresh.',
  booking_not_active: 'This link no longer works: the booking has changed.',
  squad_full: 'That squad already has 6 people.',
  already_in_squad: 'You are already in a squad for this event.',
  creator_cannot_leave: 'You started this squad, so disband it instead of leaving.',
  meeting_point_invalid: 'Please say where the squad meets (at least 3 characters).',
  name_invalid: 'That squad name is too long.',
  rate_limited: 'Too many tries. Please wait a minute and try again.',
}

export function errorMessage(error: unknown): string {
  if (error instanceof ServiceError) {
    return MESSAGES[error.code] ?? 'Something went wrong. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}
