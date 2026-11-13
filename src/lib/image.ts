export interface PixelArea {
  x: number
  y: number
  width: number
  height: number
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('That file could not be read as a photo.'))
    image.src = source
  })
}

/**
 * Cuts `area` out of an image and scales it to the given size.
 * The result is WebP where the browser can write it, and JPEG otherwise.
 */
export async function cropImage(source: string, area: PixelArea, width: number, height: number): Promise<string> {
  const image = await loadImage(source)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Your browser could not prepare the photo.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, width, height)
  const webp = canvas.toDataURL('image/webp', 0.86)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.86)
}

/** The largest centred square of an image, scaled down. Used for the selfie preview. */
export async function squareThumbnail(source: string, size: number): Promise<string> {
  const image = await loadImage(source)
  const side = Math.min(image.naturalWidth, image.naturalHeight)
  return cropImage(
    source,
    { x: (image.naturalWidth - side) / 2, y: (image.naturalHeight - side) / 2, width: side, height: side },
    size,
    size,
  )
}
