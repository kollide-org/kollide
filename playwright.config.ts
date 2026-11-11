import { execSync } from 'node:child_process'

import { defineConfig, devices } from '@playwright/test'

/** Public keys of the local Supabase stack (`npm run db:start` must be running, with Mailpit). */
function localSupabase(): { url: string; key: string } {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const read = (name: string) => out.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, 'm'))?.[1]
  const key = read('PUBLISHABLE_KEY') ?? read('ANON_KEY')
  if (!key) throw new Error('Could not read the local Supabase key. Is `npm run db:start` running?')
  return { url: read('API_URL') ?? 'http://127.0.0.1:54321', key }
}

const supabase = localSupabase()

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_SERVICES: 'real',
      VITE_SUPABASE_URL: supabase.url,
      VITE_SUPABASE_ANON_KEY: supabase.key,
    },
  },
})
