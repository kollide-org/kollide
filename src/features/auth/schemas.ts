import { z } from 'zod'

export const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .pipe(z.email('Enter a full email address, such as you@example.com.')),
})
export type EmailForm = z.infer<typeof emailSchema>

export const CODE_LENGTH = 6
export const codeSchema = z.string().regex(/^\d{6}$/, 'Enter all six digits.')
