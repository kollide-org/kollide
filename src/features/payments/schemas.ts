import { z } from 'zod'

/**
 * The same rules the payment service applies, checked in the form first, so a
 * typo is caught at once rather than after the "processing" screen.
 */
export const upiSchema = z.object({
  upiId: z
    .string()
    .trim()
    .regex(/^[a-z0-9._-]{2,}@[a-z]{2,}$/i, 'Enter a UPI ID, such as name@okbank.'),
})

export function expiryIsValid(value: string, now: Date = new Date()): boolean {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(value.trim())
  if (!match) return false
  const month = Number(match[1])
  const year = 2000 + Number(match[2])
  if (month < 1 || month > 12) return false
  // A card is valid until the end of its expiry month.
  return new Date(year, month, 1) > now
}

export const cardSchema = z.object({
  cardNumber: z
    .string()
    .transform((value) => value.replace(/\s/g, ''))
    .pipe(z.string().regex(/^\d{16}$/, 'Enter the 16-digit card number.')),
  expiry: z.string().refine((value) => expiryIsValid(value), 'Check the expiry date, as MM/YY.'),
  cvv: z.string().regex(/^\d{3}$/, 'Enter the 3-digit code on the back.'),
  nameOnCard: z.string().trim().min(2, 'Enter the name on the card.'),
})

/** "4111111111111111" becomes "4111 1111 1111 1111". */
export function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, '')
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
}

/** "1230" becomes "12/30". The slash appears as soon as the month is complete. */
export function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}
