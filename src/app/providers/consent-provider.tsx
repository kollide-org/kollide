import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { ConsentUi } from '@/components/shared/consent-ui'
import { useAppConfig } from '@/hooks/use-app-config'
import { clearMarketingCookies, identifyUser, loadMarketingPixels, marketingPixelsLoaded, purgeAnalyticsStorage, startAnalytics, stopAnalytics } from '@/lib/analytics'
import { newAnonymousId, readConsentCookie, writeConsentCookie, type ConsentChoice, type StoredConsent } from '@/lib/consent/cookie'
import { setPreferencesAllowed } from '@/lib/preferences'
import { services } from '@/services'

import { ConsentContext, type ConsentContextValue } from './consent-context'
import { useSession } from './session-context'

/**
 * Holds the cookie choice. It is stored in a first-party cookie and recorded in the database (with an anonymous id while logged out,
 * linked to the person once they sign in). A choice made for an older notice version counts as no choice, so the banner returns.
 * The choice switches the optional things on and off: Preferences (saving settings), Analytics (PostHog) and Marketing (pixels).
 */
export function ConsentProvider({ children }: { children: ReactNode }) {
  const config = useAppConfig()
  const { user } = useSession()
  const version = config.isError ? 'v1' : config.data?.noticeVersion
  const [stored, setStored] = useState<StoredConsent | null>(() => readConsentCookie())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [checkedUser, setCheckedUser] = useState<string | null>(null)
  const recordedFor = useRef<string | null>(null)

  const current = stored && version && stored.v === version ? stored : null
  const choice = useMemo<ConsentChoice | null>(
    () => (current ? { preferences: current.preferences, analytics: current.analytics, marketing: current.marketing } : null),
    [current],
  )
  const userId = user?.id ?? null

  const decide = useCallback(
    (next: ConsentChoice) => {
      if (!version) return
      const value: StoredConsent = { ...next, v: version, a: stored?.a ?? newAnonymousId(), t: Date.now() }
      writeConsentCookie(value)
      setStored(value)
      setSettingsOpen(false)
      recordedFor.current = userId
      services.consent.record(value.a, version, next).catch(() => {}) // best effort: the cookie is what the browser obeys
    },
    [version, stored, userId],
  )

  // Signing in: a choice already made on this device is recorded again with the user id (that links the two). A new device with no
  // choice adopts what the person chose before, instead of asking again.
  useEffect(() => {
    if (!userId || !version) return
    if (choice) {
      if (recordedFor.current !== userId && current) {
        recordedFor.current = userId
        // Only when the account does not already hold this exact choice for this notice version (otherwise every page load would add rows).
        services.consent
          .mine()
          .then((mine) => {
            const same = mine && mine.noticeVersion === version && mine.preferences === choice.preferences && mine.analytics === choice.analytics && mine.marketing === choice.marketing
            if (!same) return services.consent.record(current.a, version, choice)
          })
          .catch(() => {})
      }
      return
    }
    if (checkedUser === userId) return
    let cancelled = false
    services.consent
      .mine()
      .then((mine) => {
        if (cancelled) return
        if (mine && mine.noticeVersion === version) {
          const value: StoredConsent = { preferences: mine.preferences, analytics: mine.analytics, marketing: mine.marketing, v: version, a: newAnonymousId(), t: Date.now() }
          writeConsentCookie(value)
          setStored(value)
          recordedFor.current = userId
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setCheckedUser(userId))
    return () => {
      cancelled = true
    }
  }, [userId, version, choice, current, checkedUser])

  // ---- what the choice switches on and off
  const wasAnalytics = useRef(false)
  const analyticsOn = choice?.analytics === true
  useEffect(() => {
    if (analyticsOn) {
      wasAnalytics.current = true
      void startAnalytics()
    } else if (wasAnalytics.current) {
      wasAnalytics.current = false
      stopAnalytics()
    } else if (choice) {
      purgeAnalyticsStorage() // a choice without Analytics: make sure nothing from an earlier visit is left
    }
  }, [analyticsOn, choice])

  useEffect(() => identifyUser(userId), [userId])

  const preferencesOn = choice?.preferences === true
  useEffect(() => setPreferencesAllowed(preferencesOn), [preferencesOn])

  const marketingOn = choice?.marketing === true
  useEffect(() => {
    if (marketingOn) loadMarketingPixels(true)
    else if (marketingPixelsLoaded()) {
      // a third-party script cannot be unloaded: remove its cookies and start the page again without it
      clearMarketingCookies()
      window.location.reload()
    }
  }, [marketingOn])

  const ready = version !== undefined
  const waitingForAccount = userId !== null && choice === null && checkedUser !== userId
  const value = useMemo<ConsentContextValue>(
    () => ({
      ready,
      choice,
      bannerVisible: ready && choice === null && !waitingForAccount,
      settingsOpen,
      acceptAll: () => decide({ preferences: true, analytics: true, marketing: true }),
      rejectAll: () => decide({ preferences: false, analytics: false, marketing: false }),
      save: decide,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
    }),
    [ready, choice, waitingForAccount, settingsOpen, decide],
  )

  return (
    <ConsentContext value={value}>
      {children}
      <ConsentUi />
    </ConsentContext>
  )
}
