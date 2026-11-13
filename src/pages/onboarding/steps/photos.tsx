import { ImagePlus, X } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState, type ChangeEvent } from 'react'

import { PHOTO_COUNT, photosSchema } from '@/features/onboarding/schemas'
import { cn } from '@/lib/utils'

import { FieldError, StepForm } from '../step-form'

import type { StepProps } from './types'

// The cropper is only needed once a photo has been picked.
const PhotoCropper = lazy(() => import('../photo-cropper'))

const MAX_FILE_BYTES = 15 * 1024 * 1024
const SLOT_LABELS = ['Main photo', 'Second photo', 'Third photo']

export function PhotosStep({ draft, update, onNext }: StepProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [slot, setSlot] = useState(0)
  const [source, setSource] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Free the picked file's memory once the cropper is done with it.
  useEffect(() => {
    if (!source) return
    return () => URL.revokeObjectURL(source)
  }, [source])

  const pick = (index: number) => {
    // New photos fill the first empty place, so there are never gaps.
    setSlot(Math.min(index, draft.photos.length))
    inputRef.current?.click()
  }

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Choose a photo. That file is not an image.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('That photo is over 15 MB. Choose a smaller one.')
      return
    }
    setError(null)
    setSource(URL.createObjectURL(file))
  }

  const remove = (index: number) => update({ photos: draft.photos.filter((_, position) => position !== index) })

  const submit = () => {
    const result = photosSchema.safeParse(draft.photos)
    if (result.success) onNext()
    else setError(result.error.issues[0].message)
  }

  return (
    <StepForm
      title="Add three photos."
      description="Clear, recent photos of you. Make the first one just you, so hosts know who to look for."
      onSubmit={submit}
    >
      <input ref={inputRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={onFile} />

      <ul className="grid grid-cols-3 gap-3 sm:gap-4" aria-describedby={error ? 'photos-error' : undefined}>
        {Array.from({ length: PHOTO_COUNT }, (_, index) => {
          const photo = draft.photos[index]
          return (
            <li key={index} className={cn('relative', index === 0 && 'col-span-2 row-span-2')}>
              <button
                type="button"
                onClick={() => pick(index)}
                data-autofocus={index === draft.photos.length ? '' : undefined}
                className={cn(
                  'group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl transition-[border-color,transform] duration-200 ease-out-soft active:scale-[0.98]',
                  photo ? 'bg-muted' : 'border-2 border-dashed border-foreground/25 bg-card hover:border-foreground/50',
                )}
              >
                {photo ? (
                  <>
                    <img src={photo} alt={`${SLOT_LABELS[index]}, added`} className="size-full object-cover" />
                    <span className="absolute inset-x-2 bottom-2 rounded-full bg-brand-ink/75 py-1 text-center text-xs font-semibold text-brand-antique opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      Change
                    </span>
                  </>
                ) : (
                  <span className="flex size-full flex-col items-center justify-center gap-2 p-2 text-muted-foreground">
                    <ImagePlus className={index === 0 ? 'size-8' : 'size-6'} strokeWidth={1.5} aria-hidden="true" />
                    <span className={cn('font-medium', index === 0 ? 'text-base' : 'text-xs sm:text-sm')}>
                      {index === 0 ? 'Add your main photo' : 'Add photo'}
                    </span>
                  </span>
                )}
              </button>
              {photo ? (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label={`Remove ${SLOT_LABELS[index].toLowerCase()}`}
                  className="absolute -top-2 -right-2 flex size-9 items-center justify-center rounded-full bg-card text-foreground shadow-lift transition-transform duration-200 active:scale-90"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="mt-5 min-h-6" aria-live="polite">
        {error ? (
          <FieldError id="photos-error" message={error} />
        ) : (
          <p className="text-muted-foreground">
            {draft.photos.length} of {PHOTO_COUNT} added
          </p>
        )}
      </div>

      {source ? (
        <Suspense fallback={null}>
          <PhotoCropper
            source={source}
            onCancel={() => setSource(null)}
            onCropped={(photo) => {
              const photos = [...draft.photos]
              photos[slot] = photo
              update({ photos })
              setSource(null)
            }}
          />
        </Suspense>
      ) : null}
    </StepForm>
  )
}
