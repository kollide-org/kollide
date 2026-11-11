import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { useSession } from '@/app/providers/session-context'
import { ChipSelect } from '@/components/shared/chip-select'
import { PhotosEditor } from '@/components/shared/photos-editor'
import { VerifySection } from '@/components/shared/verify-section'
import { NativeSelect } from '@/components/shared/native-select'
import { PageHeader } from '@/components/shared/page-header'
import { PromptsEditor } from '@/components/shared/prompts-editor'
import { filledPrompts, slotsFrom } from '@/lib/prompts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useReferenceData } from '@/hooks/use-reference-data'
import { errorMessage, services, type MyProfile } from '@/services'

function ageFrom(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null
  const born = new Date(dateOfBirth)
  const now = new Date()
  let age = now.getFullYear() - born.getFullYear()
  if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) age -= 1
  return age
}

export function Component() {
  const { profile } = useSession()
  const [editing, setEditing] = useState(false)
  if (!profile) return null
  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Your profile"
        title={profile.firstName ?? 'Your profile'}
        action={
          editing ? null : (
            <Button variant="outline" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          )
        }
      />
      {editing ? <EditForm profile={profile} onDone={() => setEditing(false)} /> : <View profile={profile} />}
      <VerifySection />
    </div>
  )
}

function View({ profile }: { profile: MyProfile }) {
  const reference = useReferenceData()
  const age = ageFrom(profile.dateOfBirth)
  const label = (items: { id: number; label: string }[] | undefined, id: number) =>
    items?.find((item) => item.id === id)?.label ?? ''

  return (
    <Card>
      <CardContent className="grid gap-6 pt-6">
        <p className="text-lead">
          {[age ? `${age}` : null, label(reference.data?.areas, profile.areaId ?? -1) || null].filter(Boolean).join(' · ')}
          {profile.isVerified ? (
            <Badge className="ml-3" variant="soft">
              Verified
            </Badge>
          ) : null}
        </p>
        <PhotosEditor profile={profile} />
        <section aria-label="Prompts" className="grid gap-4">
          {profile.bioPrompts.map((item) => (
            <div key={item.prompt}>
              <p className="eyebrow text-primary">{item.prompt}</p>
              <p className="mt-1">{item.answer}</p>
            </div>
          ))}
        </section>
        <section aria-label="Interests" className="flex flex-wrap gap-2">
          {profile.interestIds.map((id) => (
            <Badge key={id} variant="soft">
              {label(reference.data?.interests, id)}
            </Badge>
          ))}
        </section>
        <section aria-label="Languages" className="flex flex-wrap gap-2">
          {profile.languageIds.map((id) => (
            <Badge key={id}>{label(reference.data?.languages, id)}</Badge>
          ))}
        </section>
      </CardContent>
    </Card>
  )
}

function EditForm({ profile, onDone }: { profile: MyProfile; onDone: () => void }) {
  const { refreshProfile } = useSession()
  const reference = useReferenceData()
  const [firstName, setFirstName] = useState(profile.firstName ?? '')
  const [lastName, setLastName] = useState(profile.lastName ?? '')
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [areaId, setAreaId] = useState(String(profile.areaId ?? ''))
  const [interestIds, setInterestIds] = useState(profile.interestIds)
  const [languageIds, setLanguageIds] = useState(profile.languageIds)
  const [slots, setSlots] = useState(() => slotsFrom(profile.bioPrompts))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await services.profile.updateMyProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        areaId: areaId ? Number(areaId) : undefined,
        prompts: filledPrompts(slots),
        interestIds,
        languageIds,
      })
      await refreshProfile()
      toast.success('Profile saved.')
      onDone()
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="grid max-w-xl gap-6">
      <div className="grid gap-2">
        <Label htmlFor="edit-first-name">First name</Label>
        <Input id="edit-first-name" maxLength={40} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="edit-last-name">Last name</Label>
        <Input id="edit-last-name" maxLength={60} value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="edit-phone">Phone</Label>
        <Input id="edit-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="edit-area">Area</Label>
        <NativeSelect id="edit-area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          {reference.data?.areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <ChipSelect label="Interests" items={reference.data?.interests ?? []} selected={interestIds} onChange={setInterestIds} max={10} />
      <ChipSelect label="Languages" items={reference.data?.languages ?? []} selected={languageIds} onChange={setLanguageIds} max={5} />
      <PromptsEditor value={slots} onChange={setSlots} />
      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive-soft/50 px-4 py-3 text-destructive-strong">
          {error}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          Save
        </Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
