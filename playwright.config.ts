import { execSync } from 'node:child_process'

import { defineConfig, devices } from '@playwright/test'

/** Keys of the local Supabase stack (`npm run db:start` must be running, with Mailpit). Local demo keys only. */
function localSupabase(): { url: string; anonKey: string; serviceKey: string } {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const read = (name: string) => out.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, 'm'))?.[1]
  const anonKey = read('PUBLISHABLE_KEY') ?? read('ANON_KEY')
  const serviceKey = read('SERVICE_ROLE_KEY')
  if (!anonKey || !serviceKey) throw new Error('Could not read the local Supabase keys. Is `npm run db:start` running?')
  return { url: read('API_URL') ?? 'http://127.0.0.1:54321', anonKey, serviceKey }
}

const supabase = localSupabase()
// Tests that need an admin promote a fresh user with the local service key (never a real project's).
process.env.E2E_SUPABASE_URL = supabase.url
process.env.E2E_SERVICE_KEY = supabase.serviceKey
const WORKER = 'http://localhost:8787'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  // Specs that are not about cookies start with optional cookies already rejected, so the banner never covers a button.
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    storageState: {
      cookies: [{
        name: 'kollide_consent',
        value: encodeURIComponent(JSON.stringify({ v: 'v1', a: '00000000-0000-4000-8000-0000000000e2', preferences: false, analytics: false, marketing: false, t: 1 })),
        domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax',
      }],
      origins: [],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // The API Worker with simulated R2 buckets (uploads and images stay on this machine).
      command: `npm --prefix workers/api run dev -- --port 8787 --var SUPABASE_URL:${supabase.url} --var SUPABASE_SERVICE_ROLE_KEY:${supabase.serviceKey} --var JOB_SHARED_SECRET:local-job-secret`,
      url: `${WORKER}/health`,
      reuseExistingServer: false,
      timeout: 90_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        VITE_SERVICES: 'real',
        VITE_SUPABASE_URL: supabase.url,
        VITE_SUPABASE_ANON_KEY: supabase.anonKey,
        VITE_API_URL: WORKER,
        VITE_MEDIA_URL: `${WORKER}/media`,
        // dummy ids: the consent spec proves nothing loads without permission (every host is intercepted there)
        VITE_APP_ENV: 'local',
        VITE_POSTHOG_KEY: 'phc_e2e_dummy',
        VITE_META_PIXEL_ID: '1234567890',
        VITE_GOOGLE_ADS_ID: 'AW-1234567890',
      },
    },
  ],
})
