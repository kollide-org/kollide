export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unavailable'

/**
 * Opens the device's own share sheet. Where there isn't one, the text is
 * copied to the clipboard instead.
 */
export async function shareOrCopy(data: { title: string; text: string; url: string }): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(data)
      return 'shared'
    } catch (error) {
      // Closing the share sheet is a choice, not a failure.
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    }
  }
  try {
    await navigator.clipboard.writeText(`${data.text}\n${data.url}`)
    return 'copied'
  } catch {
    return 'unavailable'
  }
}
