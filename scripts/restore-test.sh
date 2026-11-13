#!/usr/bin/env bash
# Proves a backup can be restored: dump -> encrypt (like the nightly job) -> decrypt -> restore into a SCRATCH database ->
# compare every table's row count with the source -> drop the scratch database. Nothing is ever restored over the source.
#
# Local (default): uses the local Supabase database container (`npm run db:start` must be running).
#   bash scripts/restore-test.sh
# Real backup file from R2 (decrypt + restore into a scratch database on the local container, then compare to nothing but print counts):
#   BACKUP_FILE=kollide-2026-11-14T203000Z.dump.enc BACKUP_PASSPHRASE=... bash scripts/restore-test.sh
# Against a remote source (needs pg_dump/pg_restore 17 and psql on this machine; the scratch database is on the LOCAL container):
#   SOURCE_URL='postgresql://...' bash scripts/restore-test.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB="supabase_db_$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' supabase/config.toml)"
SCRATCH="restore_test_$(date +%s)"
WORK="$(mktemp -d)"
PASS="${BACKUP_PASSPHRASE:-restore-test-passphrase}"
ENC="$WORK/test.dump.enc"
trap 'docker exec -i "$DB" psql -U postgres -d postgres -q -c "drop database if exists \"'"$SCRATCH"'\" with (force)" >/dev/null 2>&1 || true; rm -rf "$WORK"' EXIT

psql_local() { docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -q -At "$@"; }

if [ -n "${BACKUP_FILE:-}" ]; then
  echo "[restore] using the downloaded backup $BACKUP_FILE"
  cp "$BACKUP_FILE" "$ENC"
else
  echo "[restore] 1/5 dumping the source database (custom format) and encrypting it like the nightly job"
  if [ -n "${SOURCE_URL:-}" ]; then
    pg_dump --format=custom --no-owner --no-privileges "$SOURCE_URL" | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:PASS > "$ENC"
  else
    docker exec -i "$DB" pg_dump -U postgres -d postgres --format=custom --no-owner --no-privileges \
      | PASS="$PASS" openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:PASS > "$ENC"
  fi
fi
test -s "$ENC"
echo "[restore]   encrypted file: $(wc -c < "$ENC") bytes"

echo "[restore] 2/5 decrypting and checking the archive can be read"
PASS="$PASS" openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:PASS -in "$ENC" -out "$WORK/test.dump"
docker exec -i "$DB" pg_restore --list < "$WORK/test.dump" > "$WORK/toc.txt"
echo "[restore]   $(grep -c . "$WORK/toc.txt") entries in the archive"

echo "[restore] 3/5 restoring over a COPY of the database ($SCRATCH): objects are dropped and recreated from the archive"
# A Supabase database has schemas, roles and extensions (auth, extensions, vault, cron) that a blank database lacks, exactly like a
# new Supabase project. Starting from a copy gives the same starting point; --clean --if-exists then replaces everything from the archive.
# (A database can only be copied while nobody else is connected, so other sessions on the LOCAL stack are dropped for a moment;
#  the Supabase services reconnect by themselves.)
docker exec -i "$DB" psql -U supabase_admin -d template1 -q -At \
  -c "alter database postgres with allow_connections false" \
  -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = 'postgres' and pid <> pg_backend_pid()" \
  -c "create database \"$SCRATCH\" template postgres" \
  -c "alter database postgres with allow_connections true" >/dev/null
# Empty the copy first, so the data and functions can only come from the archive (a copy that already holds everything would pass anyway).
docker exec -i "$DB" psql -U supabase_admin -d "$SCRATCH" -q -At -c "drop schema if exists private cascade" -c "drop schema if exists public cascade" -c "create schema public" >/dev/null
EMPTY="$(psql_local -d "$SCRATCH" -c "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public','private') and c.relkind = 'r'")"
[ "$EMPTY" = "0" ] || { echo "FAIL: the scratch copy was not emptied ($EMPTY tables left)" >&2; exit 1; }
echo "[restore]   scratch copy emptied: 0 tables in public and private before the restore"
docker exec -i "$DB" pg_restore -U supabase_admin -d "$SCRATCH" --clean --if-exists --no-owner --no-privileges < "$WORK/test.dump" 2> "$WORK/restore.log" || true
echo "[restore]   $(grep -c 'error:' "$WORK/restore.log" || true) messages in the restore log (the most common are shown)"
grep 'error:' "$WORK/restore.log" | sed 's/^pg_restore: error: //' | cut -c1-160 | sort | uniq -c | sort -rn | head -6 || true

echo "[restore] 4/5 comparing every table in public"
TABLES="$(psql_local -d postgres -c "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1")"
BAD=0
COUNT=0
for t in $TABLES; do
  a="$(psql_local -d postgres -c "select count(*) from public.\"$t\"")"
  b="$(psql_local -d "$SCRATCH" -c "select count(*) from public.\"$t\"" 2>/dev/null || echo MISSING)"
  COUNT=$((COUNT + 1))
  if [ -n "${BACKUP_FILE:-}${SOURCE_URL:-}" ]; then echo "  $t: restored $b rows"; continue; fi
  if [ "$a" != "$b" ]; then echo "  MISMATCH $t: source $a, restored $b"; BAD=$((BAD + 1)); fi
done
FUNCS_A="$(psql_local -d postgres -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')")"
FUNCS_B="$(psql_local -d "$SCRATCH" -c "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')")"
echo "[restore]   functions in public+private: restored $FUNCS_B"
if [ -z "${BACKUP_FILE:-}${SOURCE_URL:-}" ]; then
  [ "$FUNCS_A" = "$FUNCS_B" ] || { echo "  MISMATCH functions: source $FUNCS_A, restored $FUNCS_B"; BAD=$((BAD + 1)); }
fi

echo "[restore] 5/5 dropping the scratch database"
if [ "$BAD" -ne 0 ]; then echo "FAIL: $BAD difference(s) after restoring." >&2; exit 1; fi
echo "OK: $COUNT tables and the functions restored from an encrypted dump into $SCRATCH, and the scratch database is dropped."
