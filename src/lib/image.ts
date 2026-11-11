/**
 * Prepares a picked image for upload: decodes it, draws it on a canvas and encodes WebP at about 150 KB.
 * Drawing on a canvas throws away everything that is not pixels: GPS location, camera model, timestamps
 * and every other hidden (EXIF) field never reach our servers. The picture's orientation is applied first.
 */
export const TARGET_BYTES = 150 * 1024
const MAX_SIDE = 1600
const MIN_SIDE = 480

export class ImageError extends Error {
  code: 'not_an_image' | 'webp_unsupported' | 'too_big_to_shrink'

  constructor(code: ImageError['code'], message: string) {
    super(message)
    this.name = 'ImageError'
    this.code = code
  }
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
}

export async function compressToWebp(file: File | Blob, maxBytes = TARGET_BYTES): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImageError('not_an_image', 'That file is not a picture we can read.')
  }

  try {
    let side = Math.min(MAX_SIDE, Math.max(bitmap.width, bitmap.height))
    while (side >= MIN_SIDE) {
      const scale = side / Math.max(bitmap.width, bitmap.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

      for (const quality of [0.85, 0.75, 0.65, 0.55, 0.45]) {
        const blob = await toBlob(canvas, quality)
        // Browsers that cannot encode WebP silently return PNG.
        if (!blob || blob.type !== 'image/webp') {
          throw new ImageError('webp_unsupported', 'Your browser cannot prepare photos. Please update it and try again.')
        }
        if (blob.size <= maxBytes) return blob
      }
      side = Math.floor(side * 0.8)
    }
  } finally {
    bitmap.close()
  }
  throw new ImageError('too_big_to_shrink', 'We could not make that picture small enough. Try a different one.')
}
