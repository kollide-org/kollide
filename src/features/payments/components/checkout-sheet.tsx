import { CircleAlert, CreditCard, Lock, Smartphone, Wallet } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useState, type FormEvent, type ReactNode } from 'react'

import { FieldError } from '@/components/forms/step-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cardSchema, formatCardNumber, formatExpiry, upiSchema } from '@/features/payments/schemas'
import { formatInr } from '@/lib/format'
import { spring } from '@/lib/motion'
import { useMediaQuery, useMotionAllowed } from '@/lib/use-media-query'
import { cn } from '@/lib/utils'
import { SERVICE_MODE, type Checkout, type PaymentInput } from '@/services'

type Method = 'upi' | 'card'
type CardField = 'cardNumber' | 'expiry' | 'cvv' | 'nameOnCard'
type Errors = Partial<Record<'upiId' | CardField, string>>

interface CheckoutSheetProps {
  checkout: Checkout
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Processing: the sheet cannot be closed until the payment has an answer. */
  processing: boolean
  /** The message from a payment that did not go through. */
  failure: string | null
  onPay: (input: PaymentInput) => void
  onRetry: () => void
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <FieldError id={`${id}-error`} message={error} /> : hint ? <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/** Two circles drawing towards each other: the "processing" state. */
function Processing() {
  const motionAllowed = useMotionAllowed()
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center px-2 py-10 text-center">
      <div className="relative h-24 w-36" aria-hidden="true">
        <m.span
          className="absolute top-1/2 left-0 size-20 -translate-y-1/2 rounded-full bg-primary/85 mix-blend-multiply dark:mix-blend-screen"
          animate={motionAllowed ? { x: [0, 28, 0] } : undefined}
          transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
        <m.span
          className="absolute top-1/2 right-0 size-20 -translate-y-1/2 rounded-full bg-highlight/85 mix-blend-multiply dark:mix-blend-screen"
          animate={motionAllowed ? { x: [0, -28, 0] } : undefined}
          transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
      </div>
      <p className="mt-8 font-display text-h3">Confirming your payment</p>
      <p className="mt-2 max-w-xs text-muted-foreground">This takes a few seconds. Please keep this open.</p>
    </div>
  )
}

function Failure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center px-2 py-8 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-full bg-destructive-soft text-destructive-strong">
        <CircleAlert className="size-8" aria-hidden="true" />
      </span>
      <p className="mt-6 font-display text-h3">The payment didn’t go through</p>
      <p className="mt-2 max-w-sm text-muted-foreground" role="alert">
        {message} Any Kollide credit you have is untouched.
      </p>
      <Button size="lg" className="mt-8 w-full" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

/**
 * A simulated checkout with UPI and card. Nothing typed here is stored: the
 * details go to the payment service once and are forgotten.
 */
export function CheckoutSheet({ checkout, open, onOpenChange, processing, failure, onPay, onRetry }: CheckoutSheetProps) {
  const wide = useMediaQuery('(min-width: 640px)')
  const [method, setMethod] = useState<Method>('upi')
  const [upiId, setUpiId] = useState('')
  const [card, setCard] = useState({ cardNumber: '', expiry: '', cvv: '', nameOnCard: '' })
  const [errors, setErrors] = useState<Errors>({})
  const creditOnly = checkout.payableInr === 0

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (creditOnly) return onPay({ method: 'credit' })
    if (method === 'upi') {
      const parsed = upiSchema.safeParse({ upiId })
      if (!parsed.success) {
        setErrors({ upiId: parsed.error.issues[0].message })
        document.getElementById('pay-upi')?.focus()
        return
      }
      setErrors({})
      return onPay({ method: 'upi', upiId: parsed.data.upiId })
    }
    const parsed = cardSchema.safeParse(card)
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) next[issue.path[0] as CardField] ??= issue.message
      setErrors(next)
      document.getElementById(`pay-${Object.keys(next)[0]}`)?.focus()
      return
    }
    setErrors({})
    onPay({ method: 'card', ...parsed.data })
  }

  const described = (field: keyof Errors, hint = false) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `pay-${field}-error` : hint ? `pay-${field}-hint` : undefined,
  })

  const state = processing ? 'processing' : failure ? 'failure' : 'form'

  return (
    <Sheet open={open} onOpenChange={(next) => !processing && onOpenChange(next)}>
      <SheetContent
        side={wide ? 'right' : 'bottom'}
        showCloseButton={!processing}
        onEscapeKeyDown={(event) => processing && event.preventDefault()}
        onPointerDownOutside={(event) => processing && event.preventDefault()}
        className={cn('gap-0 overflow-y-auto p-0', wide ? 'w-full sm:max-w-md' : 'max-h-[94dvh] rounded-t-3xl')}
      >
        <SheetHeader className={cn('border-b border-border px-6 pt-6 pb-5', state !== 'form' && 'sr-only')}>
          <SheetTitle className="text-h3">{creditOnly ? 'Book with credit' : `Pay ${formatInr(checkout.payableInr)}`}</SheetTitle>
          <SheetDescription>{checkout.eventTitle}</SheetDescription>
        </SheetHeader>

        <div className="relative px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* The states cross-fade, so the sheet is never blank between them. */}
          <AnimatePresence mode="popLayout" initial={false}>
            <m.div
              key={state}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: spring.gentle }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              {state === 'processing' ? (
                <Processing />
              ) : state === 'failure' ? (
                <Failure message={failure ?? ''} onRetry={onRetry} />
              ) : (
                <form noValidate onSubmit={submit} className="grid gap-6">
                  {creditOnly ? (
                    <p className="flex items-start gap-3 rounded-2xl bg-success-soft p-4 text-success-strong">
                      <Wallet className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                      Your Kollide credit covers the whole {formatInr(checkout.priceInr)}. Nothing more to pay.
                    </p>
                  ) : (
                    <>
                      <div role="group" aria-label="How you’d like to pay" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1">
                        {(
                          [
                            ['upi', 'UPI', <Smartphone key="upi" className="size-4.5" aria-hidden="true" />],
                            ['card', 'Card', <CreditCard key="card" className="size-4.5" aria-hidden="true" />],
                          ] as const
                        ).map(([value, label, icon]) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={method === value}
                            onClick={() => {
                              setMethod(value)
                              setErrors({})
                            }}
                            className={cn(
                              'relative inline-flex h-11 items-center justify-center gap-2 rounded-xl font-medium transition-colors',
                              method === value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {method === value ? (
                              <m.span layoutId="pay-method" transition={spring.soft} className="absolute inset-0 rounded-xl bg-card shadow-card" aria-hidden="true" />
                            ) : null}
                            <span className="relative inline-flex items-center gap-2">
                              {icon}
                              {label}
                            </span>
                          </button>
                        ))}
                      </div>

                      {method === 'upi' ? (
                        <Field id="pay-upiId" label="UPI ID" error={errors.upiId} hint="The ID you pay with in any UPI app, such as name@okbank.">
                          <Input
                            id="pay-upiId"
                            value={upiId}
                            onChange={(change) => setUpiId(change.target.value)}
                            inputMode="email"
                            autoComplete="off"
                            autoCapitalize="none"
                            spellCheck={false}
                            placeholder="name@okbank"
                            {...described('upiId', true)}
                          />
                        </Field>
                      ) : (
                        <div className="grid gap-5">
                          <Field id="pay-cardNumber" label="Card number" error={errors.cardNumber}>
                            <Input
                              id="pay-cardNumber"
                              value={card.cardNumber}
                              onChange={(change) => setCard({ ...card, cardNumber: formatCardNumber(change.target.value) })}
                              inputMode="numeric"
                              autoComplete="cc-number"
                              placeholder="1234 5678 9012 3456"
                              {...described('cardNumber')}
                            />
                          </Field>
                          <div className="grid grid-cols-2 gap-4">
                            <Field id="pay-expiry" label="Expiry" error={errors.expiry}>
                              <Input
                                id="pay-expiry"
                                value={card.expiry}
                                onChange={(change) => setCard({ ...card, expiry: formatExpiry(change.target.value) })}
                                inputMode="numeric"
                                autoComplete="cc-exp"
                                placeholder="MM/YY"
                                {...described('expiry')}
                              />
                            </Field>
                            <Field id="pay-cvv" label="Security code" error={errors.cvv}>
                              <Input
                                id="pay-cvv"
                                value={card.cvv}
                                onChange={(change) => setCard({ ...card, cvv: change.target.value.replace(/\D/g, '').slice(0, 3) })}
                                inputMode="numeric"
                                autoComplete="cc-csc"
                                placeholder="123"
                                {...described('cvv')}
                              />
                            </Field>
                          </div>
                          <Field id="pay-nameOnCard" label="Name on the card" error={errors.nameOnCard}>
                            <Input
                              id="pay-nameOnCard"
                              value={card.nameOnCard}
                              onChange={(change) => setCard({ ...card, nameOnCard: change.target.value })}
                              autoComplete="cc-name"
                              {...described('nameOnCard')}
                            />
                          </Field>
                        </div>
                      )}
                    </>
                  )}

                  {SERVICE_MODE === 'mock' ? (
                    <p className="rounded-2xl border border-dashed border-foreground/20 p-4 text-sm text-muted-foreground">
                      This is a practice checkout, so no money moves. To see a payment fail, use a UPI ID ending in @fail or a card
                      number ending in 0002.
                    </p>
                  ) : null}

                  <div className="grid gap-3">
                    <Button type="submit" size="lg" className="w-full">
                      <Lock aria-hidden="true" />
                      {creditOnly ? 'Book with credit' : `Pay ${formatInr(checkout.payableInr)}`}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Your payment details are used once and never stored by Kollide.
                    </p>
                  </div>
                </form>
              )}
            </m.div>
          </AnimatePresence>
        </div>
      </SheetContent>
    </Sheet>
  )
}
