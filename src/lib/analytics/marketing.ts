import { GOOGLE_ADS_ID, META_PIXEL_ID } from './env'

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; callMethod?: unknown }
    _fbq?: unknown
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let loaded = false

function addScript(src: string): void {
  const script = document.createElement('script')
  script.async = true
  script.src = src
  document.head.appendChild(script)
}

/**
 * Advertising pixels (Meta, Google Ads). They load only when Marketing is allowed AND an id is configured; with no ids this does
 * nothing at all. Scripts are external files (the security policy has no inline scripts).
 */
export function loadMarketingPixels(marketingAllowed: boolean): void {
  if (!marketingAllowed || loaded || (META_PIXEL_ID === '' && GOOGLE_ADS_ID === '')) return
  loaded = true

  if (META_PIXEL_ID) {
    const queue: unknown[] = []
    const fbq = ((...args: unknown[]) => void queue.push(args)) as NonNullable<Window['fbq']>
    fbq.queue = queue
    fbq.loaded = true
    window.fbq = fbq
    window._fbq = fbq
    addScript('https://connect.facebook.net/en_US/fbevents.js')
    window.fbq('init', META_PIXEL_ID)
    window.fbq('track', 'PageView')
  }

  if (GOOGLE_ADS_ID) {
    window.dataLayer = window.dataLayer ?? []
    window.gtag = (...args: unknown[]) => void window.dataLayer?.push(args)
    window.gtag('js', new Date())
    window.gtag('config', GOOGLE_ADS_ID)
    addScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GOOGLE_ADS_ID)}`)
  }
}

/** Whether pixels were started in this page view: withdrawing then needs a reload, because a loaded third-party script cannot be unloaded. */
export function marketingPixelsLoaded(): boolean {
  return loaded
}

/** Removes the cookies the pixels set. */
export function clearMarketingCookies(): void {
  for (const part of document.cookie.split('; ')) {
    const name = part.split('=')[0] ?? ''
    if (/^(_fbp|_fbc|_ga|_gid|_gcl_|_gac_|IDE|test_cookie)/.test(name)) {
      document.cookie = `${name}=; Max-Age=0; Path=/`
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${window.location.hostname}`
    }
  }
}
