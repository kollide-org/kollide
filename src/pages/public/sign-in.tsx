import { Mail } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'

import { useSession } from '@/app/providers/session-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage, services } from '@/services'

const RESEND_SECONDS = 60

export function Component() {
  const { status, role } = useSession()
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  if (status === 'ready' && role !== 'visitor') return <Navigate to="/app" replace />

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const sendCode = (event?: FormEvent) => {
    event?.preventDefault()
    return run(async () => {
      await services.auth.sendEmailCode(email.trim())
      setStep('code')
      setCooldown(RESEND_SECONDS)
    })
  }

  const verify = (event: FormEvent) => {
    event.preventDefault()
    return run(async () => {
      await services.auth.verifyEmailCode(email.trim(), code.trim())
      await navigate('/app', { replace: true })
    })
  }

  return (
    <div className="container-page py-12 md:py-20">
      <div className="mx-auto grid max-w-md gap-8">
        <header>
          <h1 className="text-h1">Sign in to Kollide</h1>
          <p className="mt-3 text-lead text-muted-foreground">
            New here? Signing in creates your account. You must be 18 or older.
          </p>
        </header>

        {step === 'email' ? (
          <div className="grid gap-6">
            <Button size="lg" variant="outline" disabled={busy} onClick={() => run(() => services.auth.signInWithGoogle())}>
              Continue with Google
            </Button>
            <div className="flex items-center gap-4 text-sm text-muted-foreground" aria-hidden>
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <form onSubmit={sendCode} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <Button type="submit" size="lg" disabled={busy || email.trim().length === 0}>
                <Mail /> Send code
              </Button>
            </form>
          </div>
        ) : (
          <form onSubmit={verify} className="grid gap-4">
            <p className="text-muted-foreground">
              We sent a 6-digit code to <strong className="text-foreground">{email}</strong>. It works for 10 minutes.
            </p>
            <div className="grid gap-2">
              <Label htmlFor="code">6-digit code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-[0.5em]"
              />
            </div>
            <Button type="submit" size="lg" disabled={busy || code.length !== 6}>
              Sign in
            </Button>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <Button type="button" variant="link" disabled={busy || cooldown > 0} onClick={() => void sendCode()}>
                {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setStep('email')
                  setCode('')
                  setError(null)
                }}
              >
                Use a different email
              </Button>
            </div>
          </form>
        )}

        {error ? (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive-soft/50 px-4 py-3 text-destructive-strong">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
