#!/usr/bin/env bash
# Runs scripts/check-rls.sql against the local Supabase database (start it with `npm run db:start`).
set -euo pipefail
cd "$(dirname "$0")/.."

DB_CONTAINER="supabase_db_$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' supabase/config.toml)"
docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < scripts/check-rls.sql
echo "RLS check passed: every table in public has RLS enabled."
