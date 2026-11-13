/**
 * The one switch between mock and real services.
 *
 *   VITE_SERVICES=mock   (default) data lives in the browser
 *   VITE_SERVICES=real   calls the real backend, once it exists
 */
export type ServiceMode = 'mock' | 'real'

export const SERVICE_MODE: ServiceMode = import.meta.env.VITE_SERVICES === 'real' ? 'real' : 'mock'

/** Artificial latency for the mock services, so loading states are visible. */
export const MOCK_DELAY_MS = (() => {
  const raw = Number(import.meta.env.VITE_MOCK_DELAY_MS)
  return Number.isFinite(raw) && raw >= 0 && import.meta.env.VITE_MOCK_DELAY_MS !== undefined ? raw : 450
})()
