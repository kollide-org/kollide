import { useQueryClient } from '@tanstack/react-query'
import { Heart, MessageCircleWarning, Smile } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router'
import { toast } from 'sonner'

import { AppLink } from '@/components/shared/app-link'
import { EmptyState } from '@/components/shared/empty-state'
import { NativeSelect } from '@/components/shared/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { ReportDialog } from '@/components/shared/report-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useFeedbackTags, useFeedbackTasks, useMyTaps } from '@/hooks/use-after-event'
import { formatWhen } from '@/lib/format'
import { mediaUrl } from '@/lib/media'
import { errorMessage, ISSUE_OPTIONS, services, type FeedbackPerson, type FeedbackTask, type IssueCode, type PositiveTag } from '@/services'

/** The 72-hour feedback flow: kind tags for each person, a private note if something felt off, and a rating for the host. */
export function Component() {
  const { id = '' } = useParams()
  const tasks = useFeedbackTasks()
  const tags = useFeedbackTags()
  const taps = useMyTaps(id)
  const task = tasks.data?.find((t) => t.eventId === id)

  if (tasks.isPending) return <Skeleton className="h-72 w-full" />
  if (!task) {
    return (
      <EmptyState
        icon={Smile}
        title="Nothing to share for this event"
        description="Feedback is open for 72 hours after an event, for people who were checked in."
        action={<AppLink to="/app/plans" className="text-primary underline underline-offset-4">Back to my plans</AppLink>}
      />
    )
  }

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="After the event"
        title={`How was ${task.eventTitle}?`}
        description={`Open until ${formatWhen(task.closesAt)}. Tags stay hidden until you have both shared, or the window closes. Nobody sees who tagged them.`}
      />
      <div className="grid gap-4">
        {task.people.map((person) => (
          <PersonFeedback key={person.userId} task={task} person={person} tags={tags.data ?? []} tapped={taps.data?.includes(person.userId) ?? false} />
        ))}
        {task.people.length === 0 ? <p className="text-muted-foreground">There is nobody else to give feedback to for this event.</p> : null}
      </div>
      {task.canRateHost ? <HostRating task={task} /> : null}
    </div>
  )
}

function PersonFeedback({ task, person, tags, tapped }: { task: FeedbackTask; person: FeedbackPerson; tags: PositiveTag[]; tapped: boolean }) {
  const queryClient = useQueryClient()
  const [picked, setPicked] = useState<number[]>([])
  const [feltOff, setFeltOff] = useState(false)
  const [issue, setIssue] = useState<IssueCode | ''>('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const name = person.firstName ?? 'Member'

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await action()
      toast.success(done)
      await Promise.all(['feedback-tasks', 'my-taps'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  function toggle(tagId: number) {
    setPicked((current) => (current.includes(tagId) ? current.filter((x) => x !== tagId) : current.length < 3 ? [...current, tagId] : current))
  }

  return (
    <Card>
      <CardContent className="grid gap-4 pt-6">
        <div className="flex items-center gap-4">
          <div className="size-14 shrink-0 overflow-hidden rounded-2xl bg-secondary">
            {person.photoKey ? <img src={mediaUrl(person.photoKey)} alt="" className="size-full object-cover" /> : null}
          </div>
          <h2 className="text-h3">{name}</h2>
          {person.isHost ? <Badge variant="soft">Host</Badge> : null}
        </div>

        {person.tagged ? (
          <p className="flex items-center gap-2 text-success-strong"><Heart aria-hidden className="size-4" /> You sent {name} your tags.</p>
        ) : (
          <fieldset className="grid gap-3">
            <legend className="text-sm text-muted-foreground">Pick up to 3 that fit {name}</legend>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={picked.includes(tag.id)}
                  onClick={() => toggle(tag.id)}
                  className={`h-9 rounded-full border px-4 text-sm transition-colors ${picked.includes(tag.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/25 hover:bg-accent'}`}
                >
                  {tag.label}
                </button>
              ))}
            </div>
            <div>
              <Button size="sm" disabled={busy || picked.length === 0} onClick={() => void run(() => services.feedback.giveTags(task.eventId, person.userId, picked), 'Tags sent.')}>
                Send tags
              </Button>
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {tapped ? (
            <Badge variant="success">You would like to meet again</Badge>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => services.connections.tap(task.eventId, person.userId).then((r) => { if (r.mutual) toast.success(`You and ${name} both want to meet again!`) }), 'Noted. We only tell them if they feel the same.')}>
              Meet again
            </Button>
          )}
          {person.flagged ? (
            <Badge>Private note sent</Badge>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setFeltOff((v) => !v)} aria-expanded={feltOff}>
              <MessageCircleWarning /> Something felt off
            </Button>
          )}
          <ReportDialog subject="user" subjectId={person.userId} label="Report" />
        </div>

        {feltOff && !person.flagged ? (
          <div className="grid gap-3 rounded-2xl bg-secondary p-4">
            <p className="text-sm">This is private. {name} will never see it. If several people raise the same thing, they get a gentle, anonymous note.</p>
            <div className="grid gap-2">
              <Label htmlFor={`issue-${person.userId}`}>What felt off?</Label>
              <NativeSelect id={`issue-${person.userId}`} value={issue} onChange={(e) => setIssue(e.target.value as IssueCode)}>
                <option value="">Choose one</option>
                {ISSUE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`note-${person.userId}`}>A few words (optional)</Label>
              <Textarea id={`note-${person.userId}`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div>
              <Button size="sm" disabled={busy || !issue} onClick={() => void run(() => services.feedback.submitPrivate(task.eventId, person.userId, issue as IssueCode, note.trim() || undefined), 'Thank you. This stays private.')}>
                Send privately
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function HostRating({ task }: { task: FeedbackTask }) {
  const queryClient = useQueryClient()
  const [values, setValues] = useState({ asDescribed: 0, feltSafe: 0, wellOrganised: 0 })
  const [busy, setBusy] = useState(false)
  const rows: { key: keyof typeof values; label: string }[] = [
    { key: 'asDescribed', label: 'It was as described' },
    { key: 'feltSafe', label: 'I felt safe' },
    { key: 'wellOrganised', label: 'It was well organised' },
  ]

  if (task.hostRated) {
    return <p className="rounded-2xl border border-border p-5">Thank you for rating the host.</p>
  }

  async function send() {
    setBusy(true)
    try {
      await services.feedback.rateHost(task.eventId, values)
      toast.success('Thank you for rating the host.')
      await queryClient.invalidateQueries({ queryKey: ['feedback-tasks'] })
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="grid gap-4 pt-6">
        <h2 className="text-h3">How was the host?</h2>
        <p className="text-sm text-muted-foreground">1 is not at all, 5 is completely. The host never sees your individual answers.</p>
        {rows.map((row) => (
          <div key={row.key} className="grid gap-2">
            <Label htmlFor={`rate-${row.key}`}>{row.label}</Label>
            <NativeSelect id={`rate-${row.key}`} value={values[row.key] || ''} onChange={(e) => setValues((v) => ({ ...v, [row.key]: Number(e.target.value) }))}>
              <option value="">Choose 1 to 5</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </NativeSelect>
          </div>
        ))}
        <div><Button disabled={busy || Object.values(values).some((v) => v === 0)} onClick={() => void send()}>Send rating</Button></div>
      </CardContent>
    </Card>
  )
}
