import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, CircleAlert } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router'

import { AppLink } from '@/components/shared/app-link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { pathAfterSignIn, useGoogleSignIn, useRequestEmailCode } from '@/features/auth/hooks'
import { emailSchema, type EmailForm } from '@/features/auth/schemas'

const step = (index: number) => ({ '--i': index }) as CSSProperties

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.2 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8L20 3.1A12 12 0 0 0 1.300 6.600l4 3.100A7.200 7.200 0 0 1 12 4.800Z" />
    </svg>
  )
}

/** Sign in or join. One screen, two ways in: Google, or a code sent by email. */
export function Component() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from

  const google = useGoogleSignIn()
  const requestCode = useRequestEmailCode()
  const busy = google.isPending || requestCode.isPending

  const form = useForm<EmailForm>({ resolver: zodResolver(emailSchema), defaultValues: { email: '' } })
  const emailError = form.formState.errors.email?.message

  const continueWithGoogle = () => {
    google.mutate(undefined, {
      onSuccess: (session) => navigate(pathAfterSignIn(session, from), { replace: true, viewTransition: true }),
    })
  }

  const continueWithEmail = form.handleSubmit(({ email }) => {
    requestCode.mutate(email, {
      onSuccess: (sent) => navigate('/sign-in/code', { state: { email: sent.email, from }, viewTransition: true }),
    })
  })

  const failure = google.error ?? requestCode.error

  return (
    <>
      <title>Sign in · Kollide</title>
      <p className="rise-in eyebrow text-primary" style={step(0)}>
        Welcome
      </p>
      <h1 className="rise-in mt-4 text-h1" style={step(1)}>
        Sign in, or join us.
      </h1>
      <p className="rise-in mt-4 text-lead text-muted-foreground" style={step(2)}>
        New here? The same steps create your account.
      </p>

      <div className="rise-in mt-10" style={step(3)}>
        <Button variant="outline" size="lg" className="w-full bg-card" onClick={continueWithGoogle} disabled={busy}>
          <GoogleMark />
          {google.isPending ? 'Connecting to Google…' : 'Continue with Google'}
        </Button>

        <div className="my-7 flex items-center gap-4 text-sm text-muted-foreground" role="separator">
          <span className="h-px flex-1 bg-border" />
          or use your email
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={continueWithEmail} noValidate className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? 'email-error' : undefined}
              {...form.register('email')}
            />
            {emailError ? (
              <p id="email-error" className="flex items-center gap-1.5 text-sm text-destructive-strong">
                <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
                {emailError}
              </p>
            ) : null}
          </div>
          <Button type="submit" size="lg" disabled={busy}>
            {requestCode.isPending ? 'Sending your code…' : 'Email me a code'}
            {requestCode.isPending ? null : <ArrowRight aria-hidden="true" />}
          </Button>
        </form>

        {failure ? (
          <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl bg-destructive-soft px-4 py-3 text-sm text-destructive-strong">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {failure.message || 'That didn’t work. Please try again.'}
          </p>
        ) : null}
      </div>

      <p className="rise-in mt-10 text-sm text-muted-foreground" style={step(5)}>
        By continuing you agree to our{' '}
        <AppLink to="/terms" className="text-foreground underline underline-offset-4">
          terms
        </AppLink>{' '}
        and{' '}
        <AppLink to="/privacy" className="text-foreground underline underline-offset-4">
          privacy notice
        </AppLink>
        . Kollide is for people aged 18 and over, and it is not a dating app.
      </p>
    </>
  )
}
