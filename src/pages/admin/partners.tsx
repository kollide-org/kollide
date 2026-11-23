import { ExternalLink, Link2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { FieldError } from '@/components/forms/step-form'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QueueItem, QueueList, QueueSkeleton } from '@/features/admin/components/queue'
import { usePartnerLinks, useUpdatePartnerLink } from '@/features/admin/queries'
import { formatDay } from '@/lib/format'
import type { PartnerLink } from '@/services'

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function PartnerRow({ link }: { link: PartnerLink }) {
  const update = useUpdatePartnerLink()
  const [value, setValue] = useState(link.ticketUrl)
  const [error, setError] = useState<string | null>(null)
  const id = `partner-${link.eventId}`
  const changed = value.trim() !== link.ticketUrl

  const save = (event: FormEvent) => {
    event.preventDefault()
    update.mutate(
      { eventId: link.eventId, ticketUrl: value },
      {
        onSuccess: (saved) => {
          setError(null)
          setValue(saved.ticketUrl)
          toast.success('Ticket link saved', { description: `“Get tickets” on ${link.eventTitle} now opens ${hostOf(saved.ticketUrl)}.` })
        },
        onError: (failure) => setError(failure.message),
      },
    )
  }

  return (
    <QueueItem className="p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-sans text-base font-semibold">{link.eventTitle}</h2>
        <p className="text-sm text-muted-foreground">
          {link.partnerName} · {formatDay(link.startsAt)}
        </p>
      </div>
      <form noValidate onSubmit={save} className="mt-4 grid gap-2">
        <Label htmlFor={id} className="text-sm text-muted-foreground">
          Ticket link
        </Label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            id={id}
            type="url"
            inputMode="url"
            value={value}
            onChange={(change) => setValue(change.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="font-mono text-sm"
          />
          <div className="flex shrink-0 gap-2">
            <Button type="submit" variant={changed ? 'default' : 'outline'} disabled={!changed || update.isPending} className="flex-1 sm:flex-none">
              {update.isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button variant="ghost" asChild className="flex-1 sm:flex-none">
              <a href={link.ticketUrl} target="_blank" rel="noopener noreferrer">
                Open
                <ExternalLink aria-hidden="true" />
                <span className="sr-only">(the current link, in a new tab)</span>
              </a>
            </Button>
          </div>
        </div>
        <FieldError id={`${id}-error`} message={error} />
      </form>
    </QueueItem>
  )
}

/** Admin: where "Get tickets" goes on each partner event. Tickets are bought on the partner's own site. */
export function Component() {
  const { data: links, isPending, isError, refetch } = usePartnerLinks()

  return (
    <>
      <title>Partner links · Kollide admin</title>
      <PageHeader
        eyebrow="Admin"
        title="Partner links"
        description="Partner events are run by venues and clubs. “Get tickets” sends members to the partner’s own site, so check each link works."
      />
      <div className="mt-10">
        {isPending ? (
          <QueueSkeleton label="Loading partner links" rows={3} className="h-36" />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : links.length === 0 ? (
          <EmptyState icon={Link2} title="No partner events" description="When a venue or club lists an event with us, its ticket link is managed here." />
        ) : (
          <QueueList className="gap-4">
            {links.map((link) => (
              <PartnerRow key={link.eventId} link={link} />
            ))}
          </QueueList>
        )}
      </div>
    </>
  )
}
