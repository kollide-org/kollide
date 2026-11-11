import { BadgeCheck, Camera } from 'lucide-react'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useSession } from '@/app/providers/session-context'
import { Button } from '@/components/ui/button'
import { uploadImage } from '@/lib/upload-image'
import { errorMessage, services } from '@/services'

/** Selfie verification. The selfie is private, reviewed by an admin, then deleted. */
export function VerifySection() {
  const { profile } = useSession()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const state = useQuery({ queryKey: ['verification'], queryFn: () => services.profile.getVerificationState() })

  async function pick(file: File) {
    setBusy(true)
    try {
      const key = await uploadImage(file, 'selfie')
      await services.profile.submitSelfie(key)
      await queryClient.invalidateQueries({ queryKey: ['verification'] })
      toast.success('Selfie sent. We will review it soon.')
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const result = state.data ?? 'none'
  const message =
    profile?.isVerified || result === 'approved'
      ? 'You are verified. Your selfie was deleted after review.'
      : result === 'pending'
        ? 'Your selfie is waiting for review. Nobody else can see it.'
        : result === 'rejected'
          ? 'We could not verify that selfie. You can send a new one.'
          : 'Send a selfie so we can verify you. Only our team sees it, and it is deleted after review.'
  const canSend = !profile?.isVerified && result !== 'pending' && result !== 'approved'

  return (
    <section aria-label="Verification" className="grid gap-3 rounded-2xl border border-border p-5">
      <h2 className="flex items-center gap-2 text-h3">
        <BadgeCheck aria-hidden className="text-primary" /> Verify my profile
      </h2>
      <p className="text-muted-foreground">{message}</p>
      {canSend ? (
        <div>
          <Button asChild variant="outline" disabled={busy}>
            <label className="cursor-pointer">
              <Camera /> {busy ? 'Sending…' : 'Take or choose a selfie'}
              <input
                type="file"
                accept="image/*"
                capture="user"
                aria-label="Choose selfie"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) void pick(file)
                }}
              />
            </label>
          </Button>
        </div>
      ) : null}
    </section>
  )
}
