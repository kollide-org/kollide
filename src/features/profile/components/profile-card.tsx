import { BadgeCheck, CalendarCheck, Clock, Languages, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'

import { ReliabilityChip } from '@/components/people/reliability-chip'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ProfileCard as ProfileCardData } from '@/services'

interface ProfileCardProps {
  card: ProfileCardData
  /** Your own card also shows a pending verification, which nobody else sees. */
  own?: boolean
  className?: string
}

function Photo({ url, alt, eager = false }: { url: string; alt: string; eager?: boolean }) {
  return (
    <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-muted">
      <img src={url} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" className="size-full object-cover" />
    </div>
  )
}

function Prompt({ question, answer }: { question: string; answer: string }) {
  return (
    <blockquote className="rounded-2xl bg-background/70 p-5">
      <p className="text-sm font-medium text-muted-foreground">{question}</p>
      <p className="mt-1.5 font-display text-h4">{answer}</p>
    </blockquote>
  )
}

function Detail({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 text-muted-foreground">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </p>
  )
}

/**
 * The profile card. It shows a first name, an age and an area, and what
 * others have said that is positive or factual. It never shows a last name,
 * a phone number, an email, an address, or who gave any tag.
 */
export function ProfileCard({ card, own = false, className }: ProfileCardProps) {
  const [main, ...morePhotos] = [...card.photos].sort((a, b) => a.position - b.position)
  const verified = card.verification.status === 'verified'
  const { reputation } = card

  // Photos and prompts alternate, the way a conversation would.
  const blocks: ReactNode[] = []
  const prompts = [...card.prompts]
  const photos = [...morePhotos]
  while (prompts.length || photos.length) {
    const prompt = prompts.shift()
    if (prompt) blocks.push(<Prompt key={prompt.promptId} question={prompt.question} answer={prompt.answer} />)
    const photo = photos.shift()
    if (photo) blocks.push(<Photo key={photo.id} url={photo.url} alt={photo.alt} />)
  }

  return (
    <article className={cn('overflow-hidden rounded-3xl border border-border/70 bg-card p-2.5 shadow-card', className)}>
      <div className="relative">
        {main ? <Photo url={main.url} alt={main.alt} eager /> : <div className="aspect-[4/5] rounded-2xl bg-muted" />}
        <div className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-linear-to-t from-brand-ink/85 via-brand-ink/45 to-transparent px-5 pt-16 pb-5 text-brand-antique">
          <h2 className="flex items-center gap-2 text-h2">
            {card.firstName}, {card.age}
            {verified ? (
              <span className="inline-flex">
                <BadgeCheck className="size-6" aria-hidden="true" />
                <span className="sr-only">Verified</span>
              </span>
            ) : null}
          </h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-brand-antique/90">
            <MapPin className="size-4" aria-hidden="true" />
            {card.area}
          </p>
        </div>
      </div>

      <div className="grid gap-5 px-2.5 pt-5 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <ReliabilityChip reputation={reputation} />
          {card.onHold ? <Badge variant="destructive">On hold</Badge> : null}
          {own && card.verification.status === 'pending' ? (
            <Badge variant="warning">
              <Clock aria-hidden="true" />
              Verification pending
            </Badge>
          ) : null}
        </div>

        <Detail icon={<CalendarCheck className="size-5" aria-hidden="true" />}>
          Events attended: <span className="font-semibold text-foreground">{reputation.eventsAttended}</span>
        </Detail>

        {reputation.topTags.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold">Known for</h3>
            <ul className="mt-2.5 flex flex-wrap gap-2">
              {reputation.topTags.map(({ tag, count }) => (
                <li key={tag}>
                  <Badge variant="secondary">
                    {tag}
                    <span className="text-muted-foreground">{count}</span>
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {blocks}

        <div>
          <h3 className="text-sm font-semibold">Into</h3>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {card.interests.map((interest) => (
              <li key={interest}>
                <Badge variant="outline">{interest}</Badge>
              </li>
            ))}
          </ul>
        </div>

        <Detail icon={<Languages className="size-5" aria-hidden="true" />}>Speaks {card.languages.join(', ')}</Detail>

        {card.workplace ? <p className="text-muted-foreground">{card.workplace}</p> : null}

        {card.eventsInCommon.length > 0 ? (
          <div>
            <h3 className="text-sm font-semibold">Events in common</h3>
            <ul className="mt-2 grid gap-1 text-muted-foreground">
              {card.eventsInCommon.slice(0, 3).map((event) => (
                <li key={event.eventId}>{event.title}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </article>
  )
}
