import { ArrowRight, BadgeCheck, CalendarDays, Info, MapPin, PartyPopper, UsersRound } from 'lucide-react'
import * as m from 'motion/react-m'
import { useId, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Stagger, StaggerItem } from '@/components/motion/stagger'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'

const SWATCHES = [
  { name: 'Primary', note: 'Cherry rose', className: 'bg-primary text-primary-foreground' },
  { name: 'Highlight', note: 'Dusty rose', className: 'bg-highlight text-highlight-foreground' },
  { name: 'Background', note: 'Antique white', className: 'bg-background text-foreground' },
  { name: 'Card', note: 'Raised surface', className: 'bg-card text-card-foreground' },
  { name: 'Secondary', note: 'Quiet fill', className: 'bg-secondary text-secondary-foreground' },
  { name: 'Muted', note: 'Skeletons, wells', className: 'bg-muted text-muted-foreground' },
  { name: 'Primary soft', note: 'Tinted fill', className: 'bg-primary-soft text-primary-soft-foreground' },
  { name: 'Highlight soft', note: 'Tinted fill', className: 'bg-highlight-soft text-highlight-soft-foreground' },
  { name: 'Success', note: 'Fixed', className: 'bg-success text-on-status' },
  { name: 'Warning', note: 'Fixed, fills only', className: 'bg-warning text-on-warning' },
  { name: 'Error', note: 'Fixed', className: 'bg-destructive text-on-status' },
  { name: 'Ink', note: 'Text', className: 'bg-foreground text-background' },
]

const TYPE_SCALE = [
  { token: 'text-display', label: 'Display', sample: 'Never walk in alone', display: true },
  { token: 'text-h1', label: 'Heading 1', sample: 'This week in Bengaluru', display: true },
  { token: 'text-h2', label: 'Heading 2', sample: 'Squads forming near you', display: true },
  { token: 'text-h3', label: 'Heading 3', sample: 'Board games at Dialogues Café', display: true },
  { token: 'text-h4', label: 'Heading 4', sample: 'House rules', display: true },
  { token: 'text-lead', label: 'Lead', sample: 'Find an event, then go with a small group of verified people.' },
  { token: 'text-base', label: 'Body', sample: 'Hosts see your profile and how often you turn up before they approve.' },
  { token: 'text-sm', label: 'Small', sample: 'Saturday 14 November · 7:30 pm · Indiranagar' },
  { token: 'text-xs', label: 'Caption', sample: '4 spots left' },
]

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="border-t border-border py-12 md:py-16">
      <h2 id={id} className="text-h2">
        {title}
      </h2>
      {description ? <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p> : null}
      <div className="mt-8">{children}</div>
    </section>
  )
}

function BrandTile({ className, children }: { className: string; children: ReactNode }) {
  return <div className={cn('flex min-h-40 items-center justify-center rounded-2xl p-6', className)}>{children}</div>
}

export function Component() {
  const [pressed, setPressed] = useState(0)

  return (
    <div className="container-page pb-24">
      <title>Style guide · Kollide</title>

      <header className="py-12 md:py-20">
        <p className="eyebrow text-primary">Design system</p>
        <h1 className="mt-3 text-h1">Kollide style guide</h1>
        <p className="mt-4 max-w-2xl text-lead text-muted-foreground">
          Every colour, radius, shadow and font below comes from one tokens file. Switch between light and dark with the
          button in the header.
        </p>
      </header>

      <Section title="Brand">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <BrandTile className="border border-border bg-brand-antique">
            <span className="font-display text-[3.5rem] leading-none text-brand-cherry">kollide</span>
          </BrandTile>
          <BrandTile className="bg-brand-cherry">
            <span className="font-display text-[3.5rem] leading-none text-brand-antique">kollide</span>
          </BrandTile>
          <BrandTile className="bg-brand-dusty">
            <span className="font-display text-[3.5rem] leading-none text-brand-antique">kollide</span>
          </BrandTile>
          <BrandTile className="bg-brand-ink">
            <span className="flex size-24 items-center justify-center rounded-3xl bg-brand-cherry font-display text-[4rem] leading-none text-brand-antique">
              k
            </span>
          </BrandTile>
        </div>
      </Section>

      <Section
        title="Colour"
        description="Cherry rose is for the one main action, links and the verified badge. Dusty rose is for small highlights, and never for body-size text on the page background."
      >
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {SWATCHES.map((swatch) => (
            <li
              key={swatch.name}
              className={cn('flex min-h-28 flex-col justify-end rounded-xl border border-border/70 p-4', swatch.className)}
            >
              <span className="font-semibold">{swatch.name}</span>
              <span className="text-sm">{swatch.note}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type" description="Gloock for headings, Instrument Sans for everything else. These nine sizes are the whole scale.">
        <dl className="grid gap-8">
          {TYPE_SCALE.map((row) => (
            <div key={row.token} className="grid gap-2 md:grid-cols-[10rem_1fr] md:items-baseline md:gap-6">
              <dt className="text-sm text-muted-foreground">
                {row.label}
                <code className="mt-0.5 block text-xs">{row.token}</code>
              </dt>
              <dd className={cn(row.token, row.display && 'font-display', 'min-w-0 wrap-break-word')}>{row.sample}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section title="Buttons" description="One primary button per screen. Everything else uses a quieter style.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            Request to join
            <ArrowRight aria-hidden="true" />
          </Button>
          <Button variant="soft">Join a squad</Button>
          <Button variant="secondary">Waitlist</Button>
          <Button variant="outline">Share my plan</Button>
          <Button variant="ghost">Not now</Button>
          <Button variant="destructive">Report</Button>
          <Button variant="link">Refund rules</Button>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button size="lg">Large</Button>
          <Button>Default</Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="Badges and chips">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>
            <BadgeCheck aria-hidden="true" />
            Verified
          </Badge>
          <Badge variant="highlight">Shows up: 11 of 12</Badge>
          <Badge variant="highlight-soft">Squads forming</Badge>
          <Badge variant="soft">New to Kollide</Badge>
          <Badge variant="secondary">Pay at venue</Badge>
          <Badge variant="outline">Women only</Badge>
          <Badge variant="success">Approved</Badge>
          <Badge variant="warning">Waitlisted</Badge>
          <Badge variant="destructive">On hold</Badge>
        </div>
      </Section>

      <Section title="Form controls" description="Every control has a visible label, a 44 px touch target and 16 px text.">
        <div className="grid max-w-3xl gap-6 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="sg-name">First name</Label>
            <Input id="sg-name" placeholder="Ananya" autoComplete="off" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sg-area">Area of Bengaluru</Label>
            <Select>
              <SelectTrigger id="sg-area" className="w-full">
                <SelectValue placeholder="Choose an area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="indiranagar">Indiranagar</SelectItem>
                <SelectItem value="koramangala">Koramangala</SelectItem>
                <SelectItem value="hsr">HSR Layout</SelectItem>
                <SelectItem value="jayanagar">Jayanagar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sg-email">Email</Label>
            <Input id="sg-email" type="email" defaultValue="ananya@" aria-invalid="true" aria-describedby="sg-email-error" />
            <p id="sg-email-error" className="flex items-center gap-1.5 text-sm text-destructive-strong">
              <Info className="size-4" aria-hidden="true" />
              Enter a full email address.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sg-prompt">A perfect Sunday is…</Label>
            <Textarea id="sg-prompt" placeholder="Filter coffee, a long walk in Cubbon Park…" />
          </div>
          <div className="flex items-center gap-3">
            <Checkbox id="sg-conduct" defaultChecked />
            <Label htmlFor="sg-conduct">I accept the code of conduct</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="sg-women" />
            <Label htmlFor="sg-women">Women-only events</Label>
          </div>
        </div>
      </Section>

      <Section title="Cards" description="16 px corners, a hairline border and a warm, soft shadow.">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Board games and filter coffee</CardTitle>
              <CardDescription>A small, friendly table for people who are new to the city.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 text-muted-foreground">
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4.5" aria-hidden="true" />
                Sat 14 Nov · 5:00 pm
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="size-4.5" aria-hidden="true" />
                Indiranagar
              </p>
            </CardContent>
            <CardFooter className="justify-between">
              <Badge variant="highlight-soft" size="sm">
                4 spots left
              </Badge>
              <AvatarGroup>
                {['A', 'R', 'M'].map((initial) => (
                  <Avatar key={initial} className="size-8">
                    <AvatarFallback className="bg-secondary text-xs font-semibold">{initial}</AvatarFallback>
                  </Avatar>
                ))}
                <AvatarGroupCount className="size-8 text-xs">+5</AvatarGroupCount>
              </AvatarGroup>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loading</CardTitle>
              <CardDescription>Skeletons, never spinners.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3" role="status" aria-label="Loading">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="size-8 rounded-full" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tabs</CardTitle>
              <CardDescription>For switching views inside one screen.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="upcoming">
                <TabsList>
                  <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                  <TabsTrigger value="past">Past</TabsTrigger>
                </TabsList>
                <TabsContent value="upcoming" className="pt-4 text-base text-muted-foreground">
                  Two plans this week.
                </TabsContent>
                <TabsContent value="past" className="pt-4 text-base text-muted-foreground">
                  Eleven events attended.
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Screen states" description="Every screen has four: loading, empty, error and success.">
        <div className="grid gap-5 lg:grid-cols-2">
          <EmptyState
            icon={UsersRound}
            title="No squads yet"
            description="Squads are small groups going to the same event. Start one, and others can ask to join you."
            action={<Button variant="soft">Start a squad</Button>}
          />
          <ErrorState onRetry={() => toast.success('Loaded', { description: 'Everything is back.' })} />
        </div>
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Leave this squad?</DialogTitle>
                <DialogDescription>
                  Your place goes to the next person waiting. You can ask to join again later.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Stay</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Leave squad</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open sheet</Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="mx-auto max-w-xl rounded-t-3xl">
              <SheetHeader>
                <SheetTitle>Refund rules</SheetTitle>
                <SheetDescription>
                  Full refund up to 72 hours before the event. After that, you get Kollide credit.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-8 text-base text-muted-foreground">
                If Kollide cancels an event, your refund is automatic.
              </div>
            </SheetContent>
          </Sheet>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover for a tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>Worked out from check-ins</TooltipContent>
          </Tooltip>

          <Button
            variant="outline"
            onClick={() => toast.success('Request sent', { description: 'The host will reply soon.' })}
          >
            Show a toast
          </Button>
        </div>
      </Section>

      <Section
        title="Motion"
        description="Springs between 150 and 300 ms. Only position, scale and opacity move. Lists arrive one item at a time."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Staggered list</CardTitle>
              <CardDescription>Plays when it scrolls into view.</CardDescription>
            </CardHeader>
            <CardContent>
              <Stagger inView className="grid gap-3">
                {['Ananya asked to join', 'Rohan asked to join', 'Meera asked to join'].map((line) => (
                  <StaggerItem key={line} className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
                    <Avatar className="size-9">
                      <AvatarFallback className="bg-highlight-soft text-sm font-semibold text-highlight-soft-foreground">
                        {line[0]}
                      </AvatarFallback>
                    </Avatar>
                    {line}
                  </StaggerItem>
                ))}
              </Stagger>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Spring feedback</CardTitle>
              <CardDescription>Hover or tap. The card lifts and settles.</CardDescription>
            </CardHeader>
            <CardContent>
              <m.button
                type="button"
                onClick={() => setPressed((count) => count + 1)}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.97 }}
                transition={spring.soft}
                className="flex w-full items-center justify-between gap-4 rounded-xl border border-border bg-background p-5 text-left shadow-card"
              >
                <span className="flex items-center gap-3">
                  <span className="inline-flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
                    <PartyPopper className="size-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold">New Year’s Eve in Bengaluru</span>
                    <span className="block text-sm text-muted-foreground">Tapped {pressed} times</span>
                  </span>
                </span>
                <ArrowRight className="size-5 text-muted-foreground" aria-hidden="true" />
              </m.button>
            </CardContent>
          </Card>
        </div>
      </Section>
    </div>
  )
}
