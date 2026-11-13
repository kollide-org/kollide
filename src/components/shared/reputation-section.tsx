import { AppLink } from '@/components/shared/app-link'
import { ReputationLine, TagBadges } from '@/components/shared/reputation-badges'
import { Card, CardContent } from '@/components/ui/card'
import { useMyReputation, useMyTips } from '@/hooks/use-after-event'

/** On your own profile: how you show up, your top tags, and any kind notes from the community. */
export function ReputationSection({ userId }: { userId: string }) {
  const reputation = useMyReputation(userId)
  const tips = useMyTips()
  return (
    <>
      <Card className="ph-no-capture">
        <CardContent className="grid gap-3 pt-6">
          <h2 className="text-h3">How others see you</h2>
          {reputation.data ? <ReputationLine reputation={reputation.data} /> : null}
          {reputation.data ? <TagBadges tags={reputation.data.topTags} /> : null}
          <p className="text-sm text-muted-foreground">Worked out from check-ins and the kind words people share. You cannot edit it, and it keeps the last 12 months.</p>
        </CardContent>
      </Card>
      {tips.data && tips.data.length > 0 ? (
        <Card className="ph-no-capture">
          <CardContent className="grid gap-3 pt-6">
            <h2 className="text-h3">A gentle note from the community</h2>
            <ul className="grid gap-2">{tips.data.map((tip) => <li key={tip.id}>{tip.message}</li>)}</ul>
            <p className="text-sm text-muted-foreground">Only you can see this. It is anonymous. <AppLink to="/app/appeals" className="text-primary underline underline-offset-4">Disagree? Tell us.</AppLink></p>
          </CardContent>
        </Card>
      ) : null}
    </>
  )
}
