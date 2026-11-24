import { ArrowLeft } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { AreaPicker } from '@/components/forms/area-picker'
import { ChoiceChips } from '@/components/forms/choice'
import { LanguagePicker } from '@/components/forms/language-picker'
import { PromptsEditor } from '@/components/forms/prompts-editor'
import { FieldError } from '@/components/forms/step-form'
import { AppLink } from '@/components/shared/app-link'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { tidyPrompts } from '@/domain/prompts'
import { areaSchema, interestsSchema, languagesSchema, MAX_INTERESTS, promptsSchema } from '@/features/onboarding/schemas'
import { useMyProfile, useUpdateProfile } from '@/features/profile/queries'
import type { Profile, ProfilePrompt, SpokenLanguage } from '@/services'
import { INTERESTS } from '@/services/types/common'
import type { AreaChoice } from '@/components/forms/area-picker'

type Section = 'area' | 'languages' | 'prompts' | 'interests'

function Panel({ id, title, description, error, children }: { id: Section | 'workplace'; title: string; description?: string; error?: string | null; children: ReactNode }) {
  return (
    <section id={`edit-${id}`} aria-labelledby={`edit-${id}-heading`} className="scroll-mt-28 rounded-2xl border border-border/70 bg-card p-6 shadow-card sm:p-7">
      <h2 id={`edit-${id}-heading`} className="text-h3">
        {title}
      </h2>
      {description ? <p className="mt-1.5 text-muted-foreground">{description}</p> : null}
      <div className="mt-6">{children}</div>
      {error ? (
        <div className="mt-4">
          <FieldError id={`edit-${id}-error`} message={error} />
        </div>
      ) : null}
    </section>
  )
}

function Editor({ profile }: { profile: Profile }) {
  const navigate = useNavigate()
  const save = useUpdateProfile()
  const [area, setArea] = useState<AreaChoice>({ city: profile.city, area: profile.area, zone: profile.zone })
  const [languages, setLanguages] = useState<SpokenLanguage[]>(profile.languages)
  const [prompts, setPrompts] = useState<ProfilePrompt[]>(profile.prompts)
  const [interests, setInterests] = useState<string[]>(profile.interests)
  const [workplace, setWorkplace] = useState(profile.workplace ?? '')
  const [errors, setErrors] = useState<Partial<Record<Section, string>>>({})

  const submit = () => {
    const found: Partial<Record<Section, string>> = {}
    const areaResult = areaSchema.safeParse(area)
    if (!areaResult.success) found.area = areaResult.error.issues[0].message
    const languagesResult = languagesSchema.safeParse(languages)
    if (!languagesResult.success) found.languages = languagesResult.error.issues[0].message
    const promptsResult = promptsSchema.safeParse(prompts)
    if (!promptsResult.success) found.prompts = promptsResult.error.issues[0].message
    const interestsResult = interestsSchema.safeParse(interests)
    if (!interestsResult.success) found.interests = interestsResult.error.issues[0].message
    setErrors(found)
    const first = (Object.keys(found) as Section[])[0]
    if (first) {
      document.getElementById(`edit-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    save.mutate(
      {
        area: area.area,
        zone: area.zone ?? undefined,
        languages,
        prompts: tidyPrompts(prompts),
        interests,
        workplace: workplace.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success('Profile saved', { description: 'This is how people see you now.' })
          void navigate('/app/profile')
        },
        onError: (error) => toast.error('That didn’t save', { description: error.message }),
      },
    )
  }

  const toggleInterest = (interest: string) =>
    setInterests((current) => (current.includes(interest) ? current.filter((value) => value !== interest) : [...current, interest]))

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="mt-10 grid max-w-2xl gap-6 pb-28"
    >
      <Panel id="area" title="Your area" description="Your profile shows the area, never an address." error={errors.area}>
        <AreaPicker label="Area" value={area} onChange={setArea} invalid={Boolean(errors.area)} describedBy={errors.area ? 'edit-area-error' : undefined} />
      </Panel>

      <Panel id="languages" title="Languages" description="Every one you can chat in, and any you’re learning." error={errors.languages}>
        <LanguagePicker value={languages} onChange={setLanguages} describedBy={errors.languages ? 'edit-languages-error' : undefined} />
      </Panel>

      <Panel id="prompts" title="Prompts" description="Two or three. At least one written." error={errors.prompts}>
        <PromptsEditor value={prompts} onChange={setPrompts} />
      </Panel>

      <Panel id="interests" title="Interests" description={`Up to ${MAX_INTERESTS}.`} error={errors.interests}>
        <ChoiceChips
          legend="Your interests"
          name="edit-interests"
          options={INTERESTS}
          value={interests as (typeof INTERESTS)[number][]}
          max={MAX_INTERESTS}
          onChange={toggleInterest}
        />
      </Panel>

      <Panel id="workplace" title="Work (optional)" description="Only shown if you add it.">
        <div className="grid gap-2">
          <Label htmlFor="edit-workplace">Where you work, or what you do</Label>
          <Input id="edit-workplace" value={workplace} maxLength={60} onChange={(event) => setWorkplace(event.target.value)} placeholder="Product designer, or leave it empty" />
        </div>
      </Panel>

      <div className="sticky bottom-20 z-20 flex justify-end gap-3 rounded-2xl border border-border/70 bg-background/92 p-3 backdrop-blur-xl md:bottom-6">
        <Button variant="ghost" asChild>
          <AppLink to="/app/profile">Cancel</AppLink>
        </Button>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}

/** Change your area, languages, prompts, interests and work after sign-up. */
export function Component() {
  const { data: profile, isPending, isError, refetch } = useMyProfile()

  return (
    <>
      <title>Edit profile · Kollide</title>
      <AppLink to="/app/profile" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Your profile
      </AppLink>
      <PageHeader eyebrow="Profile" title="Edit your profile" description="Changes show on your card as soon as you save." />
      {isPending ? (
        <div role="status" aria-label="Loading your profile" className="mt-10 grid max-w-2xl gap-6">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      ) : isError || !profile ? (
        <div className="mt-10">
          <ErrorState onRetry={() => void refetch()} />
        </div>
      ) : (
        <Editor profile={profile} />
      )}
    </>
  )
}
