import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { AppLink } from '@/components/shared/app-link'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useMySquads } from '@/hooks/use-bookings'
import { errorMessage, services, type MySquad } from '@/services'

export function Component() {
  const squads = useMySquads()
  return (
    <div className="grid gap-8">
      <PageHeader eyebrow="Together" title="Squads" description="Small groups of 4 to 6 who go to an event together." />
      {squads.data?.length === 0 ? (
        <p className="text-muted-foreground">You are not in a squad yet. Open an event to start one or join one.</p>
      ) : null}
      <div className="grid gap-4">
        {squads.data?.map((squad) => (
          <SquadCard key={squad.id} squad={squad} />
        ))}
      </div>
    </div>
  )
}

function SquadCard({ squad }: { squad: MySquad }) {
  const queryClient = useQueryClient()
  const detail = useQuery({
    queryKey: ['squad', squad.id],
    queryFn: () => services.squads.getSquad(squad.id),
    enabled: squad.myStatus === 'approved',
  })

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action()
      toast.success(done)
      await Promise.all(['my-squads', 'squad', 'event-squads', 'notifications-unread'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
    } catch (caught) {
      toast.error(errorMessage(caught))
    }
  }

  return (
    <Card>
      <CardContent className="grid gap-3 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-h3">{squad.name ?? 'Squad'}</h2>
            <AppLink to={`/app/events/${squad.eventId}`} className="text-sm text-primary underline underline-offset-4">{squad.eventTitle}</AppLink>
          </div>
          <Badge variant="soft">{squad.myStatus === 'requested' ? 'Request sent' : `${squad.memberCount} of 6${squad.isCreator ? ' · you started it' : ''}`}</Badge>
        </div>
        {detail.data ? (
          <>
            <p>Meet: <strong>{detail.data.meetingPoint}</strong></p>
            <ul className="grid gap-2">
              {detail.data.members.map((member) => (
                <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{member.firstName ?? 'Member'}{member.status === 'requested' ? ' (wants to join)' : ''}</span>
                  {detail.data.isCreator && member.status === 'requested' ? (
                    <span className="flex gap-2">
                      <Button size="sm" onClick={() => void run(() => services.squads.decide(squad.id, member.userId, true), 'Approved.')}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => void run(() => services.squads.decide(squad.id, member.userId, false), 'Declined.')}>Decline</Button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <div>
          {squad.isCreator ? (
            <Button variant="destructive" size="sm" onClick={() => void run(() => services.squads.disband(squad.id), 'Squad disbanded.')}>Disband squad</Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => void run(() => services.squads.leave(squad.id), 'You left the squad.')}>Leave squad</Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
