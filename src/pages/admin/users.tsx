import { Ban, Camera, Check, Flag, MoreHorizontal, PauseCircle, PlayCircle, Search, ShieldOff, UsersRound } from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { PersonAvatar } from '@/components/people/person-avatar'
import { ReliabilityChip } from '@/components/people/reliability-chip'
import { VerifiedBadge } from '@/components/people/verified-badge'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/app/providers/session-context'
import { NoteDialog } from '@/features/admin/components/note-dialog'
import { QueueItem, QueueList, QueueSkeleton } from '@/features/admin/components/queue'
import { ViewTabs } from '@/features/admin/components/view-tabs'
import { useAdminUsers, useDecideSelfie, useSelfieQueue, useSetUserStatus } from '@/features/admin/queries'
import { formatAgo, formatDay } from '@/lib/format'
import type { AccountStatus, AdminUserRow, VerificationQueueItem } from '@/services'

const STATUS_BADGE: Record<Exclude<AccountStatus, 'active'>, { label: string; variant: 'warning' | 'destructive' | 'secondary' }> = {
  on_hold: { label: 'On hold', variant: 'warning' },
  suspended: { label: 'Suspended', variant: 'destructive' },
  banned: { label: 'Banned', variant: 'secondary' },
}

const ROLE_LABELS = { visitor: 'Visitor', member: 'Member', host: 'Host', admin: 'Admin' } as const

/** What each action does, in the words the admin sees before confirming. */
const ACTIONS: Record<AccountStatus, { menu: string; title: string; description: string; confirm: string; destructive: boolean }> = {
  on_hold: {
    menu: 'Put on hold',
    title: 'Put this account on hold',
    description: 'They keep the plans they have, but can’t send new requests or join squads until you restore them.',
    confirm: 'Put on hold',
    destructive: false,
  },
  suspended: {
    menu: 'Suspend',
    title: 'Suspend this account',
    description: 'They can sign in and see their account, but can’t book, request or join anything. They can appeal.',
    confirm: 'Suspend',
    destructive: true,
  },
  banned: {
    menu: 'Ban permanently',
    title: 'Ban this account',
    description: 'The account is closed for good and they can no longer sign in. Keep this for serious or repeated harm.',
    confirm: 'Ban',
    destructive: true,
  },
  active: {
    menu: 'Restore to active',
    title: 'Restore this account',
    description: 'Everything works for them again straight away.',
    confirm: 'Restore',
    destructive: false,
  },
}

const MENU_ICONS = { on_hold: PauseCircle, suspended: ShieldOff, banned: Ban, active: PlayCircle }

function UserRow({ row, isSelf }: { row: AdminUserRow; isSelf: boolean }) {
  const { user, person, reputation, openReports } = row
  const setStatus = useSetUserStatus()
  const [action, setAction] = useState<AccountStatus | null>(null)
  const badge = user.status === 'active' ? null : STATUS_BADGE[user.status]
  const options = (['on_hold', 'suspended', 'banned', 'active'] as const).filter((status) => status !== user.status)

  const confirm = (reason: string) =>
    action &&
    setStatus.mutate(
      { userId: user.id, status: action, reason },
      {
        onSuccess: () => {
          toast.success(action === 'active' ? `${person.firstName} is active again` : `${person.firstName}: ${ACTIONS[action].confirm.toLowerCase()} done`, {
            description: 'They’ve been told, with your reason.',
          })
          setAction(null)
        },
        onError: (error) => toast.error('That didn’t save', { description: error.message }),
      },
    )

  return (
    <QueueItem className="flex flex-wrap items-center gap-x-5 gap-y-4 p-5">
      <PersonAvatar person={person} className="size-12" />
      <div className="min-w-0 flex-1 basis-48">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{person.firstName}</span>
          {person.verified ? <VerifiedBadge /> : null}
          {user.role !== 'member' ? (
            <Badge variant="soft" size="sm">
              {ROLE_LABELS[user.role]}
            </Badge>
          ) : null}
          {badge ? (
            <Badge variant={badge.variant} size="sm">
              {badge.label}
            </Badge>
          ) : null}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {user.email} · joined {formatDay(user.createdAt)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {openReports > 0 ? (
          <Badge variant="destructive" size="sm">
            <Flag aria-hidden="true" />
            {openReports} open {openReports === 1 ? 'report' : 'reports'}
          </Badge>
        ) : null}
        <ReliabilityChip reputation={reputation} size="sm" />
      </div>
      {isSelf ? (
        <span className="w-10 text-center text-sm text-muted-foreground">You</span>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Manage ${person.firstName}’s account`}>
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {options.map((status, index) => {
              const Icon = MENU_ICONS[status]
              return (
                <Fragment key={status}>
                  {status === 'active' && index > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuItem variant={ACTIONS[status].destructive ? 'destructive' : 'default'} onSelect={() => setAction(status)}>
                    <Icon aria-hidden="true" />
                    {ACTIONS[status].menu}
                  </DropdownMenuItem>
                </Fragment>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <NoteDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
        title={action ? `${ACTIONS[action].title}: ${person.firstName}` : ''}
        description={action ? ACTIONS[action].description : ''}
        label="Reason"
        hint={`${person.firstName} is shown this, and can appeal.`}
        confirmLabel={action ? ACTIONS[action].confirm : ''}
        destructive={action ? ACTIONS[action].destructive : false}
        pending={setStatus.isPending}
        onConfirm={confirm}
      />
    </QueueItem>
  )
}

function Members() {
  const { session } = useSession()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [text, setText] = useState(query)
  const { data: rows, isPending, isError, refetch, isFetching } = useAdminUsers(query)

  // The address follows the search box a moment after typing stops.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (text.trim()) next.set('q', text.trim())
          else next.delete('q')
          return next
        },
        { replace: true, preventScrollReset: true },
      )
    }, 250)
    return () => window.clearTimeout(timer)
  }, [text, setParams])

  return (
    <div className="grid gap-6">
      <div className="relative max-w-md">
        <Label htmlFor="user-search" className="sr-only">
          Search members
        </Label>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="user-search"
          type="search"
          value={text}
          onChange={(change) => setText(change.target.value)}
          placeholder="Search by first name or email"
          className="pl-10"
        />
      </div>

      {isPending ? (
        <QueueSkeleton label="Loading members" rows={4} className="h-24" />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={UsersRound} title="No one by that name" description="Try a first name, or part of an email address." />
      ) : (
        <div aria-busy={isFetching}>
          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            {rows.length} {rows.length === 1 ? 'member' : 'members'}
            {query ? ` matching “${query}”` : ''}. Anyone with an open report is listed first.
          </p>
          <QueueList className="gap-3">
            {rows.map((row) => (
              <UserRow key={row.user.id} row={row} isSelf={row.user.id === session?.user.id} />
            ))}
          </QueueList>
        </div>
      )}
    </div>
  )
}

function SelfieCard({ item }: { item: VerificationQueueItem }) {
  const decide = useDecideSelfie()
  const { person } = item

  const act = (decision: 'verify' | 'reject') =>
    decide.mutate(
      { userId: person.userId, decision },
      {
        onSuccess: () =>
          decision === 'verify'
            ? toast.success(`${person.firstName} is verified`, { description: 'The badge shows on their card now.' })
            : toast.success('Asked for a new selfie', { description: `${person.firstName} has been told what helps.` }),
        onError: (error) => toast.error('That didn’t go through', { description: error.message }),
      },
    )

  return (
    <QueueItem className="p-6 sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3">{person.firstName}</h2>
        <p className="text-sm text-muted-foreground">Sent {formatAgo(item.submittedAt)}</p>
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[10rem_minmax(0,22rem)] sm:gap-6">
        <figure>
          {item.selfieUrl ? (
            <img src={item.selfieUrl} alt={`Selfie sent by ${person.firstName}`} className="aspect-[3/4] w-full rounded-xl object-cover ring-2 ring-primary/50" />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center rounded-xl bg-muted">
              <Camera className="size-6 text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          <figcaption className="mt-2 text-sm font-semibold">Selfie</figcaption>
        </figure>
        <figure>
          <ul className="grid grid-cols-3 gap-2">
            {item.photos.map((photo) => (
              <li key={photo.id}>
                <img src={photo.url} alt={photo.alt} loading="lazy" className="aspect-[3/4] w-full rounded-lg object-cover" />
              </li>
            ))}
          </ul>
          <figcaption className="mt-2 text-sm text-muted-foreground">Profile photos</figcaption>
        </figure>
      </div>
      <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-5">
        <Button onClick={() => act('verify')} disabled={decide.isPending}>
          <Check aria-hidden="true" />
          It’s a match. Verify
        </Button>
        <Button variant="outline" onClick={() => act('reject')} disabled={decide.isPending}>
          Ask for a new selfie
        </Button>
      </div>
    </QueueItem>
  )
}

function Selfies() {
  const { data: items, isPending, isError, refetch } = useSelfieQueue()
  if (isPending) return <QueueSkeleton label="Loading selfie checks" rows={1} className="h-96" />
  if (isError) return <ErrorState onRetry={() => void refetch()} />
  if (items.length === 0) {
    return <EmptyState icon={Camera} title="No selfies waiting" description="When a member sends a selfie to be verified, it appears here next to their photos." />
  }
  return (
    <QueueList>
      {items.map((item) => (
        <SelfieCard key={item.person.userId} item={item} />
      ))}
    </QueueList>
  )
}

/** Admin: every member, with their standing, and the selfie checks that earn the verified badge. */
export function Component() {
  const selfies = useSelfieQueue()
  return (
    <>
      <title>Users · Kollide admin</title>
      <PageHeader eyebrow="Admin" title="Users" description="Look someone up, see their standing, and put an account on hold, suspend or restore it." />
      <div className="mt-10">
        <ViewTabs
          label="Users"
          tabs={[
            { value: 'members', label: 'Members' },
            { value: 'selfies', label: 'Selfie checks', count: selfies.data?.length },
          ]}
        >
          {(view) => (view === 'members' ? <Members /> : <Selfies />)}
        </ViewTabs>
      </div>
    </>
  )
}
