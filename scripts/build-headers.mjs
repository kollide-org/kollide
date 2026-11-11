// Writes dist/_headers for Cloudflare Pages after `vite build`.
// The Content-Security-Policy names the real hosts, so it is built from the same VITE_* values as the app.
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadEnv } from 'vite'

const env = loadEnv('production', process.cwd(), 'VITE_')

function origin(name, { required }) {
  const value = env[name]
  if (!value) {
    if (required) console.warn(`[headers] ${name} is not set: the policy will be looser or incomplete. Set it in Cloudflare Pages.`)
    return null
  }
  try {
    return new URL(value).origin
  } catch {
    console.warn(`[headers] ${name} is not a valid URL: ${value}`)
    return null
  }
}

// Without a Supabase URL (local builds, CI) allow any Supabase project so the build still works.
const supabase = origin('VITE_SUPABASE_URL', { required: true }) ?? 'https://*.supabase.co'
const api = origin('VITE_API_URL', { required: true })
const media = origin('VITE_MEDIA_URL', { required: true })

const posthog = ['https://eu.i.posthog.com', 'https://eu-assets.i.posthog.com'] // PostHog EU cloud and its asset host
const google = 'https://accounts.google.com'

const join = (...parts) => parts.filter(Boolean).join(' ')

const csp = [
  "default-src 'self'",
  join("script-src 'self'", posthog[1]),
  "style-src 'self' 'unsafe-inline'", // React and Motion set inline style attributes
  join("img-src 'self' data: blob:", media),
  "font-src 'self'",
  join("connect-src 'self'", supabase, api, ...posthog, google),
  join('frame-src', google),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const headers = `/*
  Content-Security-Policy: ${csp}
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(), geolocation=()
`

mkdirSync('dist', { recursive: true })
writeFileSync('dist/_headers', headers)
console.log('[headers] wrote dist/_headers')
