import { BellRing, Check, Clock, Laptop, Lock, LogOut, Moon, ShieldCheck, Sun, Trash2 } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { useSession } from '@/app/providers/session-context'
import { useTheme, type ThemePreference } from '@/app/providers/theme-context'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { AccountStanding } from '@/features/profile/components/account-standing'
import { useMyAppeals } from '@/features/profile/queries'
import { useDeleteAccount, useSettings, useUpdateSettings } from '@/features/settings/queries'
import { cn } from '@/lib/utils'
import type { NotificationChannel, NotificationTopic, PrivacySettings } from '@/services'

const SECTIONS = [
  { id: 'account', label: 'Account' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'leaving', label: 'Leaving Kollide' },
] as const

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-28 rounded-2xl border border-border/70 bg-card p-6 shadow-card sm:p-7">
      <h2 id={`${id}-heading`} className="text-h3">
        {title}
      </h2>
      {description ? <p className="mt-1.5 text-muted-foreground">{description}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  )
}

/** A setting that is a single yes or no. The whole row is the label. */
function SwitchRow({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string
  title: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <Label htmlFor={id} className="grid cursor-pointer gap-1 leading-snug font-normal">
        <span className="text-base font-semibold">{title}</span>
        <span id={`${id}-description`} className="text-sm leading-normal text-muted-foreground">
          {description}
        </span>
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-describedby={`${id}-description`} className="mt-0.5" />
    </div>
  )
}

const APPEAL_STATUS = {
  under_review: 'Under review',
  upheld: 'Decision kept',
  overturned: 'Reversed',
} as const

function Account() {
  const { session } = useSession()
  const appeals = useMyAppeals()
  const user = session!.user
  const standing = user.status

  return (
    <Section id="account" title="Account">
      <div className="grid gap-6">
        {standing === 'active' ? (
          <p className="flex items-center gap-3 rounded-xl bg-success-soft p-4 font-medium text-success-strong">
            <ShieldCheck className="size-5 shrink-0" aria-hidden="true" />
            Your account is in good standing.
          </p>
        ) : (
          <AccountStanding status={standing} />
        )}

        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted-foreground">Email</dt>
            <dd className="font-medium break-all">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Mobile number</dt>
            <dd className="font-medium">{user.phone ?? 'Not added'}</dd>
          </div>
        </dl>

        {appeals.data && appeals.data.length > 0 ? (
          <div>
            <h3 className="text-sm text-muted-foreground">Your appeals</h3>
            <ul className="mt-2 grid gap-2">
              {appeals.data.map((appeal) => (
                <li key={appeal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background/70 px-4 py-3">
                  <span className="font-medium">{appeal.about === 'tip' ? 'About a tip' : 'About your account'}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                    {appeal.status === 'under_review' ? <Clock className="size-4" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                    {APPEAL_STATUS[appeal.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Section>
  )
}

const PRIVACY_ROWS: { key: keyof PrivacySettings; title: string; description: string }[] = [
  {
    key: 'showOnEventCards',
    title: 'Show my photo on event cards',
    description: 'Your face can appear in the small row of people going. Off, you still go, just without being pictured.',
  },
  {
    key: 'openToMeetAgain',
    title: 'Let people I meet ask to meet again',
    description: 'After an event, guests can say they’d like to see you again. Off, they won’t be offered the choice for you.',
  },
]

const TOPICS: { key: NotificationTopic; title: string; description: string }[] = [
  { key: 'reminders', title: 'Reminders', description: 'The day before, and when it’s time to reconfirm' },
  { key: 'squads', title: 'Squads', description: 'Someone joins, or a squad fills up' },
  { key: 'meet_again', title: 'Meet again', description: 'When someone you met says yes too' },
  { key: 'new_events', title: 'New events', description: 'A few picks a week, and new hubs' },
]

const CHANNELS: { key: NotificationChannel; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'push', label: 'Push' },
]

function PreferencesSkeleton() {
  return (
    <div role="status" aria-label="Loading your settings" className="grid gap-4">
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="h-14 rounded-xl" />
    </div>
  )
}

function useSave() {
  const update = useUpdateSettings()
  return (patch: Parameters<typeof update.mutate>[0]) =>
    update.mutate(patch, {
      onSuccess: () => toast.success('Saved', { id: 'settings-saved', duration: 1600 }),
      onError: (error) => toast.error('That didn’t save', { description: error.message }),
    })
}

function Privacy() {
  const { data, isPending, isError, refetch } = useSettings()
  const save = useSave()
  return (
    <Section id="privacy" title="Privacy" description="Your last name, phone number, email and date of birth are never shown to other members.">
      {isPending ? (
        <PreferencesSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <div className="divide-y divide-border">
          {PRIVACY_ROWS.map((row) => (
            <SwitchRow
              key={row.key}
              id={`privacy-${row.key}`}
              title={row.title}
              description={row.description}
              checked={data.privacy[row.key]}
              onChange={(value) => save({ privacy: { [row.key]: value } })}
            />
          ))}
        </div>
      )}
    </Section>
  )
}

function Notifications() {
  const { data, isPending, isError, refetch } = useSettings()
  const save = useSave()
  return (
    <Section id="notifications" title="Notifications" description="Choose what reaches you outside Kollide. Everything still shows in your updates here.">
      <p className="mb-5 flex items-start gap-3 rounded-xl bg-background/70 p-4 text-sm">
        <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          <span className="font-semibold">Bookings, payments and safety are always on</span>
          <span className="text-muted-foreground"> so you never miss an approval, a refund or a change to your plans.</span>
        </span>
      </p>
      {isPending ? (
        <PreferencesSkeleton />
      ) : isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Notifications by topic, for email and push</caption>
          <thead>
            <tr className="text-sm text-muted-foreground">
              <th scope="col" className="pb-3 font-normal">
                Topic
              </th>
              {CHANNELS.map((channel) => (
                <th key={channel.key} scope="col" className="w-16 pb-3 text-center font-normal sm:w-20">
                  {channel.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border border-t border-border">
            {TOPICS.map((topic) => (
              <tr key={topic.key}>
                <th scope="row" className="py-4 pr-3 font-normal">
                  <span className="block font-semibold">{topic.title}</span>
                  <span className="block text-sm text-muted-foreground">{topic.description}</span>
                </th>
                {CHANNELS.map((channel) => (
                  <td key={channel.key} className="py-4 text-center">
                    <Switch
                      checked={data.notifications[topic.key][channel.key]}
                      onCheckedChange={(value) => save({ notifications: { [topic.key]: { [channel.key]: value } } })}
                      aria-label={`${topic.title} by ${channel.label.toLowerCase()}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Match my device', icon: Laptop },
]

function Appearance() {
  const { preference, setPreference } = useTheme()
  const name = useId()
  return (
    <Section id="appearance" title="Appearance">
      <fieldset>
        <legend className="sr-only">Theme</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map(({ value, label, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                'flex h-14 cursor-pointer items-center gap-3 rounded-xl border px-4 font-medium transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/40',
                preference === value ? 'border-primary bg-primary-soft text-primary-soft-foreground' : 'border-input hover:border-foreground/40',
              )}
            >
              <input type="radio" name={name} value={value} checked={preference === value} onChange={() => setPreference(value)} className="sr-only" />
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </Section>
  )
}

function DeleteAccountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const remove = useDeleteAccount()
  const [understood, setUnderstood] = useState(false)

  const confirm = () => remove.mutate()

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          remove.reset()
          setUnderstood(false)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>This can’t be undone.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2.5 text-muted-foreground">
          <li className="flex gap-2.5">
            <span aria-hidden="true" className="mt-2.5 size-1 shrink-0 rounded-full bg-primary" />
            Your profile, photos, plans, squads and connections are removed.
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden="true" className="mt-2.5 size-1 shrink-0 rounded-full bg-primary" />
            Upcoming bookings are cancelled. If you’ve paid for one, cancel it from My plans first, so the refund goes through.
          </li>
          <li className="flex gap-2.5">
            <span aria-hidden="true" className="mt-2.5 size-1 shrink-0 rounded-full bg-primary" />
            Safety reports are kept, so the community stays safe.
          </li>
        </ul>
        <div className="flex items-start gap-3 rounded-xl bg-background/70 p-4">
          <Checkbox id="delete-understood" checked={understood} onCheckedChange={(state) => setUnderstood(state === true)} className="mt-0.5" />
          <Label htmlFor="delete-understood" className="cursor-pointer leading-snug font-normal">
            I understand my account and everything in it will be deleted.
          </Label>
        </div>
        {remove.error ? (
          <p role="alert" className="rounded-xl bg-destructive-soft p-4 text-sm font-medium text-destructive-strong">
            {remove.error.message}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              remove.reset()
              setUnderstood(false)
              onOpenChange(false)
            }}
          >
            Keep my account
          </Button>
          <Button variant="destructive" disabled={!understood || remove.isPending} onClick={confirm}>
            <Trash2 aria-hidden="true" />
            {remove.isPending ? 'Deleting…' : 'Delete my account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Leaving() {
  const { signOut } = useSession()
  const [deleting, setDeleting] = useState(false)
  return (
    <Section id="leaving" title="Leaving Kollide">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut aria-hidden="true" />
          Sign out
        </Button>
        <Button variant="ghost" className="text-destructive-strong hover:bg-destructive-soft hover:text-destructive-strong" onClick={() => setDeleting(true)}>
          <Trash2 aria-hidden="true" />
          Delete my account
        </Button>
      </div>
      <DeleteAccountDialog open={deleting} onOpenChange={setDeleting} />
    </Section>
  )
}

/** Your account, what others can see, what reaches you, and how to leave. */
export function Component() {
  return (
    <>
      <title>Settings · Kollide</title>
      <PageHeader eyebrow="Settings" title="Your settings" description="What others can see, what reaches you, and your account." />

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-14">
        <nav aria-label="Settings sections" className="hidden lg:sticky lg:top-28 lg:block">
          <ul className="grid gap-1">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex h-10 items-center rounded-lg px-3 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex items-start gap-2 px-3 text-sm text-muted-foreground">
            <BellRing className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Changes save as you make them.
          </p>
        </nav>

        <div className="grid max-w-2xl gap-6">
          <Account />
          <Privacy />
          <Notifications />
          <Appearance />
          <Leaving />
        </div>
      </div>
    </>
  )
}
