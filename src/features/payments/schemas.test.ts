import { describe, expect, it } from 'vitest'

import { cardSchema, expiryIsValid, formatCardNumber, formatExpiry, upiSchema } from './schemas'

describe('payment form', () => {
  it('accepts a UPI ID and refuses anything else', () => {
    expect(upiSchema.safeParse({ upiId: 'ananya@okbank' }).success).toBe(true)
    expect(upiSchema.safeParse({ upiId: ' ananya.rao@ybl ' }).success).toBe(true)
    expect(upiSchema.safeParse({ upiId: 'ananya' }).success).toBe(false)
    expect(upiSchema.safeParse({ upiId: 'a@b' }).success).toBe(false)
  })

  it('checks a card the way the payment service does', () => {
    const card = { cardNumber: '4111 1111 1111 1111', expiry: '12/30', cvv: '123', nameOnCard: 'Ananya Rao' }
    expect(cardSchema.safeParse(card).success).toBe(true)
    expect(cardSchema.parse(card).cardNumber).toBe('4111111111111111')
    expect(cardSchema.safeParse({ ...card, cardNumber: '4111 1111' }).success).toBe(false)
    expect(cardSchema.safeParse({ ...card, cvv: '12' }).success).toBe(false)
    expect(cardSchema.safeParse({ ...card, nameOnCard: ' ' }).success).toBe(false)
  })

  it('treats a card as valid until the end of its expiry month', () => {
    const now = new Date(2026, 10, 16)
    expect(expiryIsValid('11/26', now)).toBe(true)
    expect(expiryIsValid('10/26', now)).toBe(false)
    expect(expiryIsValid('13/30', now)).toBe(false)
    expect(expiryIsValid('1230', now)).toBe(false)
  })

  it('formats what people type', () => {
    expect(formatCardNumber('4111111111111111999')).toBe('4111 1111 1111 1111')
    expect(formatCardNumber('4111-11')).toBe('4111 11')
    expect(formatExpiry('1')).toBe('1')
    expect(formatExpiry('123')).toBe('12/3')
    expect(formatExpiry('12/30')).toBe('12/30')
  })
})
