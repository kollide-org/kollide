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
  rate_limited: 'Too many tries. Please wait a minute and try again.',
}

export function errorMessage(error: unknown): string {
  if (error instanceof ServiceError) {
    return MESSAGES[error.code] ?? 'Something went wrong. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}
