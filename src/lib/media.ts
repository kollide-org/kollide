/** Pictures chosen in mock mode only (there is no server to hold them). Maps a fake key to a browser URL. */
const localImages = new Map<string, string>()

export function registerLocalImage(key: string, blob: Blob): void {
  localImages.set(key, URL.createObjectURL(blob))
}

/** Where a stored picture can be loaded from. Public pictures come from the image host (img.<domain>). */
export function mediaUrl(key: string): string {
  const local = localImages.get(key)
  if (local) return local
  const base = import.meta.env.VITE_MEDIA_URL
  return base ? `${base.replace(/\/$/, '')}/${key}` : ''
}
