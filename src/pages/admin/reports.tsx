import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { AppLink } from '@/components/shared/app-link'
import { NativeSelect } from '@/components/shared/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { UserStatusBadge } from '@/components/shared/user-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatWhen } from '@/lib/format'
import { errorMessage, services, type ReportOutcome, type ReportRow, type ReportStatus } from '@/services'

const FILTERS: { value: 'pending' | ReportStatus; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
]
const OUTCOMES: { value: ReportOutcome; label: string; help: string }[] = [
  { value: 'dismiss', label: 'Dismiss: nothing to act on', help: 'Lifts the hold if no other report about this person is waiting.' },
  { value: 'warn', label: 'Warn the person', help: 'Sends a formal warning. Lifts the hold if no other report is waiting.' },
  { value: 'suspend', label: 'Suspend', help: 'They can sign in and appeal, but cannot join, host or give feedback until you lift it.' },
  { value: 'ban', label: 'Ban', help: 'Signs them out, blocks sign-in, cancels their upcoming events and bookings, and blocks their email and phone.' },
]

/** The reports queue: who reported whom, what happened, and what you decided. Held people stay held until you decide. */
export function Component() {
  const [filter, setFilter] = useState<'pending' | ReportStatus>('pending')
  const [selected, setSelected] = useState<string | null>(null)
  const reports = useQuery({ queryKey: ['admin-reports', filter], queryFn: () => services.admin.listReports(filter) })

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Admin" title="Reports" description="Reports about people, events and squads. A person who is reported by someone they shared an event with is put on hold straight away." />
      <div role="group" aria-label="Filter" className="flex gap-2">
        {FILTERS.map((f) => (
          <Button key={f.value} size="sm" variant={filter === f.value ? 'default' : 'outline'} aria-pressed={filter === f.value} onClick={() => { setFilter(f.value); setSelected(null) }}>
            {f.label}
          </Button>
        ))}
      </div>
      {reports.data?.length === 0 ? <p className="text-muted-foreground">Nothing here.</p> : null}
      <div className="grid gap-3">
        {reports.data?.map((report) => (
          <ReportCard key={report.id} report={report} open={selected === report.id} onToggle={() => setSelected(selected === report.id ? null : report.id)} />
        ))}
      </div>
    </div>
  )
}

function ReportCard({ report, open, onToggle }: { report: ReportRow; open: boolean; onToggle: () => void }) {
  return (
    <Card data-testid="report-card">
      <CardContent className="grid gap-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-h3">{report.subjectType === 'user' ? report.subjectFirstName ?? 'Member' : `${report.subjectType} hosted by ${report.subjectFirstName ?? 'a member'}`}</h2>
            <p className="text-sm text-muted-foreground">
              {report.reason.replaceAll('_', ' ')} · reported by {report.reporterFirstName ?? 'a former member'} · {formatWhen(report.createdAt)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {report.held ? <Badge variant="warning">Put on hold</Badge> : null}
            <UserStatusBadge status={report.subjectStatus} />
            <Badge variant="soft">{report.status}{report.actionTaken ? `: ${report.actionTaken}` : ''}</Badge>
            <Button size="sm" variant="outline" onClick={onToggle}>{open ? 'Close' : 'Open'}</Button>
          </div>
        </div>
        {open ? <ReportPanel id={report.id} /> : null}
      </CardContent>
    </Card>
  )
}

function ReportPanel({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const detail = useQuery({ queryKey: ['admin-report', id], queryFn: () => services.admin.getReport(id) })
  const [outcome, setOutcome] = useState<ReportOutcome>('dismiss')
  const [internal, setInternal] = useState('')
  const [userNote, setUserNote] = useState('')
  const [confirmBan, setConfirmBan] = useState(false)
  const [busy, setBusy] = useState(false)
  const d = detail.data

  const refresh = () => Promise.all(['admin-reports', 'admin-report', 'admin-users', 'admin-user'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))

  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true)
    try {
      await action()
      toast.success(done)
      await refresh()
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (detail.isPending) return <p className="text-muted-foreground">Loading…</p>
  if (!d) return <p role="alert" className="text-destructive-strong">{errorMessage(detail.error)}</p>
  const finished = d.status === 'resolved' || d.status === 'dismissed'
  const needsReason = outcome !== 'dismiss'
  const canSend = !busy && (!needsReason || internal.trim().length >= 3) && (outcome !== 'ban' || confirmBan)

  return (
    <div className="grid gap-5 border-t border-border pt-4">
      <section className="grid gap-1">
        <h3 className="text-h3">What was reported</h3>
        {d.subjectLabel ? <p className="text-sm text-muted-foreground">About: {d.subjectLabel}</p> : null}
        <p className="whitespace-pre-line">{d.details ?? 'No details were given.'}</p>
        <p className="text-sm text-muted-foreground">
          Reporter: {d.reporter?.firstName ?? 'a former member'}{d.reporter?.isVerified ? ' (verified)' : ''}
        </p>
      </section>

      <section className="grid gap-1">
        <h3 className="text-h3">About {d.subject.firstName ?? 'this member'}</h3>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <UserStatusBadge status={d.subject.status} /> {d.subject.isVerified ? 'Verified' : 'Not verified'} · shows up {d.subject.showsUpAttended} of {d.subject.showsUpTotal} · joined {formatWhen(d.subject.createdAt)}
          <AppLink to={`/admin/users?user=${d.subject.id}`} className="text-primary underline underline-offset-4">Open profile</AppLink>
        </p>
        {d.otherReports.length > 0 ? (
          <p className="text-sm">Other reports about them: {d.otherReports.map((o) => `${o.reason.replaceAll('_', ' ')} (${o.status})`).join(', ')}</p>
        ) : null}
        {d.flags.length > 0 ? <p className="text-sm">Flags: {d.flags.map((f) => `${f.kind.replaceAll('_', ' ')} (${f.status})`).join(', ')}</p> : null}
        {d.moderation.length > 0 ? <p className="text-sm">History: {d.moderation.map((m) => m.action).join(', ')}</p> : null}
      </section>

      <section className="grid gap-1" aria-label="Private feedback">
        <h3 className="text-h3">Private notes about them</h3>
        <p className="text-sm text-muted-foreground">Written by people who were at the same events. Who wrote them is never shown, and neither is which event.</p>
        {d.privateFeedback.length === 0 ? <p className="text-sm">None.</p> : null}
        <ul className="grid gap-1">
          {d.privateFeedback.map((f, i) => (
            <li key={i} className="rounded-xl bg-secondary p-3 text-sm">
              <strong>{f.issueCode.replaceAll('_', ' ')}</strong> · {f.month}{f.note ? `: ${f.note}` : ''}
            </li>
          ))}
        </ul>
      </section>

      {finished ? (
        <section className="grid gap-1 rounded-2xl border border-border p-4">
          <h3 className="text-h3">Decision: {d.actionTaken}</h3>
          {d.adminNote ? <p className="text-sm">Internal note: {d.adminNote}</p> : null}
          {d.userNote ? <p className="text-sm">Told to the person: {d.userNote}</p> : null}
        </section>
      ) : (
        <section className="grid gap-3 rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-h3">Decide</h3>
            {d.status === 'open' ? <Button size="sm" variant="soft" disabled={busy} onClick={() => void run(() => services.admin.startReview(id), 'You are reviewing this report.')}>Start review</Button> : <Badge variant="soft">Reviewing{d.reviewerFirstName ? `: ${d.reviewerFirstName}` : ''}</Badge>}
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`outcome-${id}`}>Outcome</Label>
            <NativeSelect id={`outcome-${id}`} value={outcome} onChange={(e) => { setOutcome(e.target.value as ReportOutcome); setConfirmBan(false) }}>
              {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </NativeSelect>
            <p className="text-sm text-muted-foreground">{OUTCOMES.find((o) => o.value === outcome)?.help}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`internal-${id}`}>Internal note{needsReason ? ' (required)' : ' (optional)'}</Label>
            <Textarea id={`internal-${id}`} maxLength={1000} value={internal} onChange={(e) => setInternal(e.target.value)} />
          </div>
          {outcome !== 'dismiss' ? (
            <div className="grid gap-2">
              <Label htmlFor={`usernote-${id}`}>Message to the person (optional, max 300 characters)</Label>
              <Textarea id={`usernote-${id}`} maxLength={300} value={userNote} onChange={(e) => setUserNote(e.target.value)} />
            </div>
          ) : null}
          {outcome === 'ban' ? (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmBan} onChange={(e) => setConfirmBan(e.target.checked)} /> I understand this signs them out and cancels their upcoming events and bookings.</label>
          ) : null}
          <div>
            <Button disabled={!canSend} onClick={() => void run(() => services.admin.resolveReport(id, outcome, internal.trim() || undefined, userNote.trim() || undefined), 'Decision saved.')}>Save decision</Button>
          </div>
        </section>
      )}

      {d.subject.status === 'on_hold' ? <LiftHold userId={d.subject.id} busy={busy} onRun={run} /> : null}
    </div>
  )
}

function LiftHold({ userId, busy, onRun }: { userId: string; busy: boolean; onRun: (a: () => Promise<unknown>, done: string) => Promise<void> }) {
  const [note, setNote] = useState('')
  return (
    <section className="grid gap-2 rounded-2xl border border-border p-4">
      <h3 className="text-h3">Lift the hold</h3>
      <Label htmlFor={`lift-${userId}`}>Reason</Label>
      <Textarea id={`lift-${userId}`} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
      <div><Button variant="outline" disabled={busy || note.trim().length < 3} onClick={() => void onRun(() => services.admin.liftHold(userId, note.trim()), 'The hold was lifted.')}>Lift hold</Button></div>
    </section>
  )
}
