import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('VITE_SERVICES=real needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).')
}

/**
 * The browser client. Sessions use Supabase's default: a 1-hour access token and a refresh token
 * in local storage, refreshed automatically. PKCE keeps the Google redirect safe.
 */
export const supabase = createClient<Database>(url, anonKey, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
