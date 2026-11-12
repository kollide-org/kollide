import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { NativeSelect } from '@/components/shared/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { TagBadges } from '@/components/shared/reputation-badges'
import { UserStatusBadge } from '@/components/shared/user-status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDate, formatWhen } from '@/lib/format'
import { errorMessage, services, type ModerationAction, type UserDetail, type UserStatus } from '@/services'

const ACTIONS: { value: ModerationAction; label: string; help: string }[] = [
  { value: 'note', label: 'Send a message', help: 'A note in the app and by email. Nothing else changes.' },
  { value: 'warn', label: 'Warn', help: 'A formal warning, recorded. The account stays active.' },
  { value: 'hold', label: 'Put on hold', help: 'They cannot join, host or give feedback. They can appeal.' },
  { value: 'suspend', label: 'Suspend', help: 'Like a hold, until you lift it. Bookings are kept.' },
  { value: 'ban', label: 'Ban', help: 'Signs them out, blocks sign-in, cancels upcoming events and bookings, blocks their email and phone.' },
  { value: 'reactivate', label: 'Reactivate', help: 'Back to active. Lifts a ban, including the email and phone block.' },
]

/** Find a person, see how they are doing, and hold, suspend, ban or reactivate them with a reason. Every decision is recorded. */
export function Component() {
  const [params, setParams] = useSearchParams()
  const selected = params.get('user')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<UserStatus | ''>('')
  const [submitted, setSubmitted] = useState<{ q: string; status: UserStatus | '' }>({ q: '', status: '' })
  const users = useQuery({
    queryKey: ['admin-users', submitted],
    queryFn: () => services.admin.searchUsers({ q: submitted.q || undefined, status: submitted.status || undefined, limit: 50 }),
  })

  function search(event: FormEvent) {
    event.preventDefault()
    setSubmitted({ q: q.trim(), status })
  }

  return (
    <div className="grid gap-6">
      <PageHeader eyebrow="Admin" title="Users" description="Search by first name, last name, email, the end of a phone number, or an id." />
      <form onSubmit={search} role="search" className="flex flex-wrap items-end gap-3">
        <div className="grid gap-2">
          <Label htmlFor="user-q">Search</Label>
          <Input id="user-q" value={q} onChange={(e) => setQ(e.target.value)} className="w-72" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="user-status">Status</Label>
          <NativeSelect id="user-status" value={status} onChange={(e) => setStatus(e.target.value as UserStatus | '')} className="w-44">
            <option value="">Any</option>
            <option value="active">Active</option>
            <option value="on_hold">On hold</option>
            <option value="suspended">Suspended</option>
            <option value="banned">Banned</option>
          </NativeSelect>
        </div>
        <Button type="submit">Search</Button>
      </form>

      {users.data?.length === 0 ? <p className="text-muted-foreground">Nobody matches.</p> : null}
      <ul className="grid gap-2">
        {users.data?.map((u) => (
          <li key={u.userId}>
            <Card data-testid="user-row">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
                <div>
                  <p className="flex items-center gap-1.5 text-lg font-medium">
                    {u.firstName ?? 'No name yet'} {u.lastName ?? ''}
                    {u.isVerified ? <BadgeCheck aria-label="Verified" className="size-5 text-primary" /> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">{u.email ?? 'no email'} · {u.phoneHint ?? 'no phone'} · joined {formatDate(u.createdAt)}{u.roles.length ? ` · ${u.roles.join(', ')}` : ''}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {u.openReports > 0 ? <Badge variant="warning">{u.openReports} open {u.openReports === 1 ? 'report' : 'reports'}</Badge> : null}
                  <UserStatusBadge status={u.status} />
                  <Button size="sm" variant="outline" onClick={() => setParams(selected === u.userId ? {} : { user: u.userId })}>{selected === u.userId ? 'Close' : 'Open'}</Button>
                </div>
              </CardContent>
            </Card>
            {selected === u.userId ? <UserPanel id={u.userId} /> : null}
          </li>
        ))}
      </ul>
      {selected && !users.data?.some((u) => u.userId === selected) ? <UserPanel id={selected} /> : null}
    </div>
  )
}

function UserPanel({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const detail = useQuery({ queryKey: ['admin-user', id], queryFn: () => services.admin.userDetail(id) })
  const [action, setAction] = useState<ModerationAction>('note')
  const [reason, setReason] = useState('')
  const [userNote, setUserNote] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const d: UserDetail | undefined = detail.data

  async function apply() {
    setBusy(true)
    try {
      await services.admin.setUserStatus(id, action, reason.trim(), userNote.trim() || undefined)
      toast.success('Done. It is in the audit log.')
      setReason('')
      setUserNote('')
      setConfirm(false)
      await Promise.all(['admin-user', 'admin-users', 'admin-reports'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })))
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  if (detail.isPending) return <p className="p-4 text-muted-foreground">Loading…</p>
  if (!d) return <p role="alert" className="p-4 text-destructive-strong">{errorMessage(detail.error)}</p>
  const isAdmin = d.roles.includes('admin')
  const needsConfirm = action === 'ban' || action === 'suspend'

  return (
    <div className="mt-2 grid gap-5 rounded-2xl border border-border bg-card p-5" aria-label={`Details for ${d.firstName ?? 'member'}`}>
      <section className="grid gap-1">
        <h2 className="text-h3">{d.firstName} {d.lastName}</h2>
        <p className="text-sm text-muted-foreground">{d.email} · {d.phoneHint ?? 'no phone'} · {d.age ? `${d.age} years old · ` : ''}joined {formatDate(d.createdAt)} · id {d.id}</p>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <UserStatusBadge status={d.status} />
          {d.verification ? <Badge variant={d.verification.result === 'approved' ? 'success' : 'soft'}>Verification: {d.verification.result}{d.verification.reviewedAt ? ` (${formatDate(d.verification.reviewedAt)})` : ''}</Badge> : <Badge variant="soft">No selfie submitted</Badge>}
          {d.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
        </p>
      </section>

      <section className="grid gap-1">
        <h3 className="text-h3">Reputation</h3>
        {d.reputation ? (
          <>
            <p className="text-sm">Attended {d.reputation.eventsAttended} · shows up {d.reputation.showsUpAttended} of {d.reputation.showsUpTotal} (last 12 months) · hosted {d.reputation.eventsHosted}</p>
            <TagBadges tags={d.reputation.topTags} />
          </>
        ) : <p className="text-sm text-muted-foreground">New to Kollide: nothing yet.</p>}
        {d.tips.length > 0 ? <p className="text-sm">Community notes shown to them: {d.tips.map((t) => `“${t.message}”`).join(' ')}</p> : null}
      </section>

      <section className="grid gap-1" aria-label="Flags and reports">
        <h3 className="text-h3">Flags and reports</h3>
        {d.flags.length === 0 && d.reportsAbout.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : null}
        <ul className="grid gap-1 text-sm">
          {d.flags.map((f) => <li key={f.id}>Flag: {f.kind.replaceAll('_', ' ')} ({f.status}) · {formatDate(f.createdAt)}</li>)}
          {d.reportsAbout.map((r) => <li key={r.id}>Report: {r.reason.replaceAll('_', ' ')} ({r.status}{r.actionTaken ? `: ${r.actionTaken}` : ''}) · {formatDate(r.createdAt)}</li>)}
        </ul>
      </section>

      <section className="grid gap-1" aria-label="Moderation history">
        <h3 className="text-h3">Moderation history</h3>
        {d.moderation.length === 0 ? <p className="text-sm text-muted-foreground">No decisions yet.</p> : null}
        <ul className="grid gap-1 text-sm">
          {d.moderation.map((m, i) => <li key={i}><strong>{m.action}</strong> by {m.adminFirstName ?? 'an admin'} · {formatWhen(m.createdAt)}: {m.reason}{m.userNote ? ` (told them: ${m.userNote})` : ''}</li>)}
        </ul>
      </section>

      {isAdmin ? <p className="rounded-xl bg-secondary p-3 text-sm">This person is an admin. Remove their admin role before moderating them.</p> : (
        <section className="grid gap-3 rounded-2xl border border-border p-4" aria-label="Take action">
          <h3 className="text-h3">Take action</h3>
          <div className="grid gap-2">
            <Label htmlFor="mod-action">Action</Label>
            <NativeSelect id="mod-action" value={action} onChange={(e) => { setAction(e.target.value as ModerationAction); setConfirm(false) }}>
              {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </NativeSelect>
            <p className="text-sm text-muted-foreground">{ACTIONS.find((a) => a.value === action)?.help}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mod-reason">Reason (kept in the record, never shown to them)</Label>
            <Textarea id="mod-reason" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-16" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mod-note">Message to the person (optional, max 300 characters)</Label>
            <Textarea id="mod-note" maxLength={300} value={userNote} onChange={(e) => setUserNote(e.target.value)} className="min-h-16" />
          </div>
          {needsConfirm ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> I am sure.</label> : null}
          <div><Button disabled={busy || reason.trim().length < 3 || (needsConfirm && !confirm)} onClick={() => void apply()}>Apply</Button></div>
        </section>
      )}
    </div>
  )
}
