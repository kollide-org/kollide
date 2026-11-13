import { ArrowLeft } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import * as m from 'motion/react-m'
import { useState, type ComponentType } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'

import { BootFallback } from '@/app/layouts/boot-fallback'
import { useSession } from '@/app/providers/session-context'
import { Button } from '@/components/ui/button'
import { useOnboardingDraft } from '@/features/onboarding/draft'
import { canOpenStep, firstIncompleteStep, ONBOARDING_STEPS, stepIndex } from '@/features/onboarding/steps'
import { spring } from '@/lib/motion'
import { ROLE_HOME } from '@/services/types/role'

import { AreaStep } from './steps/area'
import { BirthdayStep } from './steps/birthday'
import { ConsentStep } from './steps/consent'
import { GenderStep } from './steps/gender'
import { InterestsStep, LanguagesStep } from './steps/interests'
import { NameStep } from './steps/name'
import { PhoneStep } from './steps/phone'
import { PhotosStep } from './steps/photos'
import { PromptsStep } from './steps/prompts'
import { SelfieStep } from './steps/selfie'
import type { StepProps } from './steps/types'
import { Welcome } from './welcome'

const STEP_COMPONENTS: Record<string, ComponentType<StepProps>> = {
  name: NameStep,
  birthday: BirthdayStep,
  gender: GenderStep,
  area: AreaStep,
  photos: PhotosStep,
  interests: InterestsStep,
  languages: LanguagesStep,
  prompts: PromptsStep,
  phone: PhoneStep,
  selfie: SelfieStep,
  consent: ConsentStep,
}

function Flow({ userId, step }: { userId: string; step: string | undefined }) {
  const navigate = useNavigate()
  const { signOut } = useSession()
  const { draft, update } = useOnboardingDraft(userId)
  const index = stepIndex(step)

  // Remember the last step shown, so the next one slides in from the right direction.
  const [shown, setShown] = useState({ index, direction: 1 })
  if (shown.index !== index) setShown({ index, direction: index > shown.index ? 1 : -1 })
  const direction = shown.index === index ? shown.direction : index > shown.index ? 1 : -1

  // An unknown step, or one whose earlier steps are unfinished, goes back to where the person left off.
  if (!step || index < 0 || !canOpenStep(step, draft)) {
    return <Navigate to={`/onboarding/${firstIncompleteStep(draft)}`} replace />
  }

  const total = ONBOARDING_STEPS.length
  const Step = STEP_COMPONENTS[step]
  const go = (target: number) => navigate(`/onboarding/${ONBOARDING_STEPS[target].id}`, { viewTransition: false })

  return (
    <div className="paper flex min-h-dvh flex-col">
      <title>Set up your profile · Kollide</title>
      <header className="mx-auto flex h-16 w-full max-w-2xl items-center gap-3 px-5 md:h-20">
        {index > 0 ? (
          <Button variant="ghost" size="icon" className="-ml-2.5" onClick={() => go(index - 1)} aria-label="Back to the previous step">
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
        ) : null}
        <div
          role="progressbar"
          aria-label="Profile setup"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
          aria-valuetext={`Step ${index + 1} of ${total}`}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/12"
        >
          <div
            className="h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out-soft"
            style={{ transform: `scaleX(${(index + 1) / total})` }}
          />
        </div>
        <span className="w-12 text-right text-sm text-muted-foreground tabular-nums" aria-hidden="true">
          {index + 1} / {total}
        </span>
        <Button variant="ghost" size="sm" className="-mr-2" onClick={() => void signOut()}>
          Exit
        </Button>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <m.div
            key={step}
            custom={direction}
            className="flex flex-1 flex-col"
            initial={{ opacity: 0, x: 28 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 * direction }}
            transition={spring.snappy}
          >
            <Step draft={draft} update={update} onNext={() => go(Math.min(index + 1, total - 1))} />
          </m.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

/**
 * Profile setup. Each step has its own address, so the browser's back button
 * works, and the draft is saved as it goes, so a refresh loses nothing.
 */
export function Component() {
  const { session, role, status } = useSession()
  const { step } = useParams()

  if (status === 'loading') return <BootFallback />
  if (!session) return <Navigate to="/sign-in" replace state={{ from: '/onboarding' }} />

  if (session.user.onboardingComplete) {
    if (step === 'welcome') return <Welcome />
    // The final step lands here the moment the profile is created.
    return <Navigate to={step === 'consent' ? '/onboarding/welcome' : ROLE_HOME[role]} replace />
  }
  if (step === 'welcome') return <Navigate to="/onboarding" replace />

  return <Flow userId={session.user.id} step={step} />
}
