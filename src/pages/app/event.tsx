import { useParams } from 'react-router'

import { EventView } from '@/features/events/components/event-view'

/** The event page for members. */
export function Component() {
  const { slug = '' } = useParams()
  return <EventView slug={slug} back={{ to: '/app', label: 'All events' }} />
}
