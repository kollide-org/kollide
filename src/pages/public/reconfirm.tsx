import { useEffect, useState } from 'react'
import { useParams } from 'react-router'

import { AppLink } from '@/components/shared/app-link'
import { errorMessage, services } from '@/services'

/** The one-tap link in the "Still coming?" email. It works without signing in. */
export function Component() {
  const { token = '' } = useParams()
  const [state, setState] = useState<{ kind: 'working' } | { kind: 'done'; title: string; already: boolean; eventId: string } | { kind: 'error'; message: string }>({ kind: 'working' })

  useEffect(() => {
    let active = true
    services.bookings
      .reconfirm(token)
      .then((result) => active && setState({ kind: 'done', title: result.eventTitle, already: result.already, eventId: result.eventId }))
      .catch((caught) => active && setState({ kind: 'error', message: errorMessage(caught) }))
    return () => {
      active = false
    }
  }, [token])

  return (
    <div className="container-page py-20">
      <div role="status" className="mx-auto grid max-w-md gap-4 text-center">
        {state.kind === 'working' ? <h1 className="text-h2">Confirming…</h1> : null}
        {state.kind === 'done' ? (
          <>
            <h1 className="text-h2">Thank you, see you there!</h1>
            <p className="text-muted-foreground">Your place at <strong>{state.title}</strong> is confirmed{state.already ? ' (you had already confirmed)' : ''}.</p>
            <p><AppLink to={`/app/events/${state.eventId}`} className="text-primary underline underline-offset-4">Open the event</AppLink></p>
          </>
        ) : null}
        {state.kind === 'error' ? (
          <>
            <h1 className="text-h2">We could not confirm that</h1>
            <p className="text-muted-foreground">{state.message}</p>
            <p><AppLink to="/app/plans" className="text-primary underline underline-offset-4">Go to My plans</AppLink></p>
          </>
        ) : null}
      </div>
    </div>
  )
}
