import { Navigate, useParams } from 'react-router'

import { useSession } from '@/app/providers/session-context'
import { EventView } from '@/features/events/components/event-view'

/** The public preview of an event. Members are taken to the full event page. */
export function Component() {
  const { slug = '' } = useParams()
  const { session } = useSession()

  if (session?.user.onboardingComplete) return <Navigate to={`/app/events/${slug}`} replace />

  return (
    <div className="container-page pt-6 pb-24 md:pt-10">
      <EventView slug={slug} back={{ to: '/', label: 'Back to Kollide' }} />
    </div>
  )
}
