import { ZoomIn, ZoomOut } from 'lucide-react'
import { useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cropImage } from '@/lib/image'

/** Profile photos are portrait, four wide by five tall. */
export const PHOTO_ASPECT = 4 / 5
const OUTPUT_WIDTH = 720
const OUTPUT_HEIGHT = 900

interface PhotoCropperProps {
  /** The picked file, as an object URL. */
  source: string
  onCancel: () => void
  onCropped: (photo: string) => void
}

/** Drag to position, pinch or slide to zoom, then keep the framed part of the photo. */
export default function PhotoCropper({ source, onCancel, onCropped }: PhotoCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState<Area | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!area) return
    setSaving(true)
    try {
      onCropped(await cropImage(source, area, OUTPUT_WIDTH, OUTPUT_HEIGHT))
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'That photo could not be prepared. Try another one.')
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onCancel())}>
      <DialogContent className="gap-5 p-5 sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Frame your photo</DialogTitle>
          <DialogDescription>Drag to move it. Pinch, scroll or use the slider to zoom.</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl bg-brand-ink">
          <Cropper
            image={source}
            crop={crop}
            zoom={zoom}
            aspect={PHOTO_ASPECT}
            minZoom={1}
            maxZoom={4}
            showGrid={false}
            objectFit="cover"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        </div>

        <div className="flex items-center gap-3">
          <ZoomOut className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            aria-label="Zoom"
            className="h-11 w-full cursor-pointer accent-primary"
          />
          <ZoomIn className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive-strong">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving || !area}>
            {saving ? 'Saving…' : 'Use this photo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
