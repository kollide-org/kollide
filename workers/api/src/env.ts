/** Bindings of the Worker. Secrets are set with `wrangler secret put` (see README.md). */
export type Env = {
  ENVIRONMENT: 'local' | 'staging' | 'production'
  KOLLIDE_DOMAIN: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}
