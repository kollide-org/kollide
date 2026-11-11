import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { BootFallback } from '@/app/layouts/boot-fallback'
import { useSession } from '@/app/providers/session-context'
import { ChipSelect } from '@/components/shared/chip-select'
import { NativeSelect } from '@/components/shared/native-select'
import { PhotoSlot } from '@/components/shared/photo-slot'
import { PromptsEditor } from '@/components/shared/prompts-editor'
import { emptyPromptSlots, filledPrompts } from '@/lib/prompts'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAppConfig } from '@/hooks/use-app-config'
import { useReferenceData } from '@/hooks/use-reference-data'
import { uploadImage } from '@/lib/upload-image'
import { errorMessage, services, type Gender } from '@/services'

const STEPS = ['About you', 'Interests and languages', 'Prompts', 'Photos', 'Almost there']

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

function eighteenYearsAgo(): string {
  const date = new Date()
  date.setFullYear(date.getFullYear() - 18)
  return date.toISOString().slice(0, 10)
}

export function Component() {
  const { status, user, profile, refreshProfile } = useSession()
  const navigate = useNavigate()
  const reference = useReferenceData()
  const config = useAppConfig()

  const [step, setStep] = useState(0)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState<Gender | ''>('')
  const [areaId, setAreaId] = useState('')
  const [phone, setPhone] = useState('')
  const [interestIds, setInterestIds] = useState<number[]>([])
  const [languageIds, setLanguageIds] = useState<number[]>([])
  const [slots, setSlots] = useState(emptyPromptSlots)
  const [photoKeys, setPhotoKeys] = useState<(string | null)[]>([null, null, null])
  const [photoBusy, setPhotoBusy] = useState<number | null>(null)
  const [acceptConduct, setAcceptConduct] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'loading') return <BootFallback />
  if (!user) return <Navigate to="/sign-in" replace />
  if (profile?.onboardingCompletedAt) return <Navigate to="/app" replace />

  const filled = filledPrompts(slots)
  const stepProblem = (): string | null => {
    switch (step) {
      case 0:
        if (!firstName.trim()) return 'Please enter your first name.'
        if (!dateOfBirth) return 'Please enter your date of birth.'
        if (dateOfBirth > eighteenYearsAgo()) return 'You must be 18 or older to join Kollide.'
        if (!gender) return 'Please choose an option for gender.'
        if (!areaId) return 'Please choose your area.'
        return null
      case 1:
        if (interestIds.length < 1) return 'Choose at least one interest.'
        if (languageIds.length < 1) return 'Choose at least one language.'
        return null
      case 2:
        return filled.length >= 2 ? null : 'Answer at least two prompts.'
      case 3:
        return photoKeys.every(Boolean) ? null : 'Please add three photos.'
      default:
        return null
    }
  }

  const next = () => {
    const problem = stepProblem()
    setError(problem)
    if (!problem) setStep((current) => current + 1)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!acceptConduct || !acceptPrivacy) {
      setError('Please accept the code of conduct and the privacy notice to continue.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await services.profile.completeOnboarding({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        dateOfBirth,
        gender: gender as Gender,
        areaId: Number(areaId),
        interestIds,
        languageIds,
        prompts: filled,
        photoKeys: photoKeys as string[],
        noticeVersion: config.data?.noticeVersion ?? 'v1',
        acceptConduct,
        acceptPrivacy,
      })
      await refreshProfile()
      toast.success('You’re in. Welcome to Kollide.')
      await navigate('/app', { replace: true })
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  async function addPhoto(index: number, file: File) {
    setPhotoBusy(index)
    setError(null)
    try {
      const key = await uploadImage(file, 'profile_photo')
      setPhotoKeys((keys) => keys.map((existing, i) => (i === index ? key : existing)))
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setPhotoBusy(null)
    }
  }

  const last = step === STEPS.length - 1

  return (
    <div className="container-page py-10 md:py-16">
      <form onSubmit={submit} className="mx-auto grid max-w-xl gap-8">
        <header>
          <p className="eyebrow text-primary">
            Step {step + 1} of {STEPS.length}
          </p>
          <h1 className="mt-2 text-h1">{STEPS[step]}</h1>
        </header>

        {step === 0 ? (
          <div className="grid gap-5">
            <Field label="First name" id="first-name">
              <Input id="first-name" autoComplete="given-name" maxLength={40} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </Field>
            <Field label="Last name (optional, only the host and admins see it)" id="last-name">
              <Input id="last-name" autoComplete="family-name" maxLength={60} value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </Field>
            <Field label="Date of birth (we show your age, never the date)" id="dob">
              <Input id="dob" type="date" max={eighteenYearsAgo()} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </Field>
            <Field label="Gender" id="gender">
              <NativeSelect id="gender" value={gender} onChange={(e) => setGender(e.target.value as Gender | '')}>
                <option value="">Choose…</option>
                {GENDERS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Your area in Bengaluru" id="area">
              <NativeSelect id="area" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="">Choose…</option>
                {reference.data?.areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Phone (optional, international format like +919876543210)" id="phone">
              <Input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-8">
            <ChipSelect label="Interests" items={reference.data?.interests ?? []} selected={interestIds} onChange={setInterestIds} max={10} />
            <ChipSelect label="Languages you speak" items={reference.data?.languages ?? []} selected={languageIds} onChange={setLanguageIds} max={5} />
          </div>
        ) : null}

        {step === 2 ? <PromptsEditor value={slots} onChange={setSlots} /> : null}

        {step === 3 ? (
          <div className="grid gap-4">
            <p className="text-muted-foreground">
              Add three photos of you. We shrink them and remove hidden data such as your location before they leave
              your device.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {photoKeys.map((key, index) => (
                <PhotoSlot
                  key={index}
                  index={index + 1}
                  photoKey={key}
                  busy={photoBusy === index}
                  onFile={(file) => void addPhoto(index, file)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {last ? (
          <div className="grid gap-5">
            <label className="flex items-start gap-3">
              <Checkbox checked={acceptConduct} onCheckedChange={(value) => setAcceptConduct(value === true)} className="mt-1" aria-label="I accept the code of conduct" />
              <span>
                I accept the{' '}
                <a href="/safety" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
                  code of conduct
                </a>
                .
              </span>
            </label>
            <label className="flex items-start gap-3">
              <Checkbox checked={acceptPrivacy} onCheckedChange={(value) => setAcceptPrivacy(value === true)} className="mt-1" aria-label="I accept the privacy notice" />
              <span>
                I have read the{' '}
                <a href="/privacy" target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">
                  privacy notice
                </a>
                .
              </span>
            </label>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive-soft/50 px-4 py-3 text-destructive-strong">
            {error}
          </p>
        ) : null}

        <div className="flex justify-between gap-3">
          <Button type="button" variant="ghost" disabled={step === 0 || busy} onClick={() => { setError(null); setStep(step - 1) }}>
            Back
          </Button>
          {last ? (
            <Button type="submit" size="lg" disabled={busy}>
              Finish
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={next}>
              Continue
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
