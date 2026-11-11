import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useSession } from '@/app/providers/session-context'
import { PhotoSlot } from '@/components/shared/photo-slot'
import { Button } from '@/components/ui/button'
import { uploadImage } from '@/lib/upload-image'
import { errorMessage, services, type MyProfile } from '@/services'

/** The three photos of a profile: replace or remove each one. */
export function PhotosEditor({ profile }: { profile: MyProfile }) {
  const { refreshProfile } = useSession()
  const [busy, setBusy] = useState<number | null>(null)
  const byPosition = new Map(profile.photos.map((photo) => [photo.position, photo.key]))

  async function run(position: number, action: () => Promise<void>) {
    setBusy(position)
    try {
      await action()
      await refreshProfile()
    } catch (caught) {
      toast.error(errorMessage(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map((position) => {
        const key = byPosition.get(position) ?? null
        return (
          <div key={position} className="grid gap-2">
            <PhotoSlot
              index={position}
              photoKey={key}
              busy={busy === position}
              onFile={(file) =>
                void run(position, async () => {
                  const uploaded = await uploadImage(file, 'profile_photo')
                  await services.profile.setProfilePhoto(position, uploaded)
                })
              }
            />
            {key ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                aria-label={`Remove photo ${position}`}
                onClick={() => void run(position, () => services.profile.removeProfilePhoto(position))}
              >
                <Trash2 /> Remove
              </Button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
