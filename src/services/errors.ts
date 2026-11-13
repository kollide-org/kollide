/**
 * The one error type every service throws, mock or real.
 * Screens switch on `code`, so their error states never depend on a transport.
 */
export type ServiceErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'account_on_hold'
  | 'payment_failed'
  | 'not_implemented'
  | 'unknown'

export class ServiceError extends Error {
  readonly code: ServiceErrorCode

  constructor(code: ServiceErrorCode, message: string) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
  }
}

export function isServiceError(error: unknown, code?: ServiceErrorCode): error is ServiceError {
  return error instanceof ServiceError && (code === undefined || error.code === code)
}
