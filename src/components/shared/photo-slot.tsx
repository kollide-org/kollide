import { ImagePlus, Loader2 } from 'lucide-react'

import { mediaUrl } from '@/lib/media'
import { cn } from '@/lib/utils'

interface PhotoSlotProps {
  index: number
  photoKey: string | null
  busy?: boolean
  onFile: (file: File) => void
  className?: string
}

/** One photo tile. Click it to pick a picture from the device. */
export function PhotoSlot({ index, photoKey, busy = false, onFile, className }: PhotoSlotProps) {
  const src = photoKey ? mediaUrl(photoKey) : ''
  return (
    <label
      className={cn(
        'relative grid aspect-square cursor-pointer place-items-center overflow-hidden rounded-2xl bg-secondary text-sm text-muted-foreground outline-none focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
        className,
      )}
    >
      {src ? (
        <img src={src} alt={`Photo ${index}`} className="size-full object-cover" />
      ) : (
        <span className="flex flex-col items-center gap-1">
          <ImagePlus aria-hidden className="size-6" />
          {photoKey ? `Photo ${index}` : `Add photo ${index}`}
        </span>
      )}
      {busy ? (
        <span className="absolute inset-0 grid place-items-center bg-background/70" role="status" aria-label="Uploading">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </span>
      ) : null}
      <input
        type="file"
        accept="image/*"
        aria-label={`Choose photo ${index}`}
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onFile(file)
        }}
      />
    </label>
  )
}
