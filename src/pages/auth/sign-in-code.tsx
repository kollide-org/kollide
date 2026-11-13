import { ArrowRight, CircleAlert, MailCheck } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'

import { AppLink } from '@/components/shared/app-link'
import { Button } from '@/components/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { pathAfterSignIn, useRequestEmailCode, useVerifyEmailCode } from '@/features/auth/hooks'
import { CODE_LENGTH, codeSchema } from '@/features/auth/schemas'
import { devTools } from '@/services'

const step = (index: number) => ({ '--i': index }) as CSSProperties
const RESEND_AFTER_SECONDS = 30

/** Step two of email sign-in: enter the 6-digit code. */
export function Component() {
  const navigate = useNavigate()
  const location = useLocation()
  const { email, from } = (location.state as { email?: string; from?: string } | null) ?? {}

  const verify = useVerifyEmailCode()
  const resend = useRequestEmailCode()
  const [code, setCode] = useState('')
  const [formatError, setFormatError] = useState<string | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(RESEND_AFTER_SECONDS)
  const inputRef = useRef<HTMLInputElement>(null)

  // Start with the cursor in the code boxes, and put it back there after a wrong code clears them.
  useEffect(() => {
    inputRef.current?.focus()
  }, [verify.isError])

  useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = window.setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [secondsLeft])

  // Arriving here without an email (a refresh, a pasted link) starts again.
  if (!email) return <Navigate to="/sign-in" replace />

  const submit = (value: string) => {
    const parsed = codeSchema.safeParse(value)
    if (!parsed.success) {
      setFormatError(parsed.error.issues[0].message)
      return
    }
    setFormatError(null)
    verify.mutate(
      { email, code: parsed.data },
      {
        onSuccess: (session) => navigate(pathAfterSignIn(session, from), { replace: true, viewTransition: true }),
        onError: () => setCode(''),
      },
    )
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit(code)
  }

  const error = formatError ?? verify.error?.message ?? null

  return (
    <>
      <title>Enter your code · Kollide</title>
      <span className="rise-in inline-flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground" style={step(0)}>
        <MailCheck className="size-6" strokeWidth={1.6} aria-hidden="true" />
      </span>
      <h1 className="rise-in mt-6 text-h1" style={step(1)}>
        Check your email.
      </h1>
      <p className="rise-in mt-4 text-lead text-muted-foreground" style={step(2)}>
        We sent a 6-digit code to <span className="font-semibold wrap-anywhere text-foreground">{email}</span>.
      </p>

      <form onSubmit={onSubmit} noValidate className="rise-in mt-10" style={step(3)}>
        <label htmlFor="code" className="text-sm font-semibold">
          6-digit code
        </label>
        <div className="mt-2">
          <InputOTP
            id="code"
            ref={inputRef}
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(value) => {
              setCode(value)
              if (formatError) setFormatError(null)
              if (verify.isError) verify.reset()
            }}
            onComplete={submit}
            inputMode="numeric"
            pattern="^\d+$"
            autoComplete="one-time-code"
            disabled={verify.isPending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'code-error' : undefined}
          >
            <InputOTPGroup>
              {Array.from({ length: CODE_LENGTH }, (_, index) => (
                <InputOTPSlot key={index} index={index} aria-invalid={error ? true : undefined} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error ? (
          <p id="code-error" role="alert" className="mt-3 flex items-center gap-1.5 text-sm text-destructive-strong">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        ) : null}

        {devTools ? (
          <p className="mt-4 rounded-xl border border-dashed border-foreground/25 px-4 py-3 text-sm text-muted-foreground">
            Mock mode: no email is sent. The code is <span className="font-semibold text-foreground">{devTools.emailCode}</span>.
          </p>
        ) : null}

        <Button type="submit" size="lg" className="mt-7 w-full" disabled={verify.isPending}>
          {verify.isPending ? 'Checking…' : 'Continue'}
          {verify.isPending ? null : <ArrowRight aria-hidden="true" />}
        </Button>
      </form>

      <div className="rise-in mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm" style={step(5)}>
        <Button
          variant="link"
          className="text-sm"
          disabled={secondsLeft > 0 || resend.isPending}
          onClick={() => resend.mutate(email, { onSuccess: () => setSecondsLeft(RESEND_AFTER_SECONDS) })}
        >
          {secondsLeft > 0 ? `Send a new code in ${secondsLeft}s` : resend.isPending ? 'Sending…' : 'Send a new code'}
        </Button>
        <AppLink to="/sign-in" className="rounded-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          Use a different email
        </AppLink>
      </div>
    </>
  )
}
