#!/usr/bin/env bash
# Proves the seat lock: two sessions ask for the LAST seat at the same moment. Session A holds the event row lock
# (it sleeps before committing); session B must wait for it and then see the seat taken, so B is waitlisted.
# Needs the local Supabase stack (`npm run db:start`). Creates and removes its own test rows.
set -euo pipefail
cd "$(dirname "$0")/.."
DB="supabase_db_$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' supabase/config.toml)"
psql_run() { docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -At "$@"; }

A=00000000-0000-4000-8000-0000000000f1
B=00000000-0000-4000-8000-0000000000f2
H=00000000-0000-4000-8000-0000000000f3
EVENT=00000000-0000-4000-8000-0000000000f4

cleanup() {
  psql_run <<SQL >/dev/null 2>&1 || true
delete from public.bookings where event_id = '$EVENT';
delete from public.events where id = '$EVENT';
delete from public.notifications where user_id in ('$A', '$B', '$H');
delete from public.email_outbox where user_id in ('$A', '$B', '$H');
delete from public.rate_limits where user_id in ('$A', '$B', '$H');
delete from auth.users where id in ('$A', '$B', '$H');
SQL
}
trap cleanup EXIT
cleanup

psql_run <<SQL
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', u, 'authenticated', 'authenticated', u || '@race.test', now(), '{}', '{}', now(), now(), '', '', '', ''
  from unnest(array['$A', '$B', '$H']::uuid[]) as u;
update public.profiles set onboarding_completed_at = now(), first_name = 'Racer' where id in ('$A', '$B', '$H');
update public.profile_private set date_of_birth = date '1990-01-01', gender = 'man' where id in ('$A', '$B', '$H');
insert into public.events (id, host_id, type, title, area_id, starts_at, ends_at, capacity, approval_mode, status, published_at)
values ('$EVENT', '$H', 'community', 'Race for the last seat', 1, now() + interval '5 days', now() + interval '5 days 2 hours', 2, 'instant', 'published', now());
-- One seat is already taken, so exactly one seat is left.
insert into public.bookings (event_id, user_id, status) values ('$EVENT', '$H', 'approved');
SQL

as_user() { # as_user <uuid> <sleep seconds before commit>
  psql_run <<SQL
begin;
select set_config('request.jwt.claims', '{"sub":"$1","role":"authenticated"}', true);
set local role authenticated;
select 'result=' || (public.request_to_join('$EVENT') ->> 'status');
reset role;
select pg_sleep($2);
commit;
SQL
}

# A takes the lock and holds it for 3 seconds. B starts one second later and has to wait for it.
RESULT_A="$(as_user "$A" 3)" &
PID_A=$!
sleep 1
START=$(date +%s)
RESULT_B="$(as_user "$B" 0)"
END=$(date +%s)
wait "$PID_A" || true
RESULT_A="$(psql_run -c "select status from public.bookings where event_id='$EVENT' and user_id='$A'")"
RESULT_B="$(psql_run -c "select status from public.bookings where event_id='$EVENT' and user_id='$B'")"

echo "A: $RESULT_A   B: $RESULT_B   (B waited $((END - START))s)"
if [ "$RESULT_A" = "approved" ] && [ "$RESULT_B" = "waitlisted" ]; then
  echo "OK: one person got the last seat and the other was waitlisted."
else
  echo "FAIL: expected A approved and B waitlisted." >&2
  exit 1
fi
if [ $((END - START)) -lt 2 ]; then
  echo "FAIL: B did not wait for A's lock, so the seat lock is not working." >&2
  exit 1
fi

# ---- Check-in (B6): the same person scanned twice at the same moment is checked in exactly once.
psql_run <<SQL >/dev/null
update public.events set starts_at = now() - interval '1 hour', ends_at = now() + interval '1 hour' where id = '$EVENT';
SQL
BOOKING_A="$(psql_run -c "select id from public.bookings where event_id='$EVENT' and user_id='$A'")"
scan() { # scan <label>: the host checks the same booking in; prints ok or the error code
  psql_run <<SQL 2>&1 | tr -d '\n' | sed 's/.*ERROR:  *\([a-z_]*\).*/\1/'
begin;
select set_config('request.jwt.claims', '{"sub":"$H","role":"authenticated"}', true);
set local role authenticated;
select 'ok' from (select public.check_in_manual('$BOOKING_A')) x;
commit;
SQL
}
SCAN_1="$(scan 1)" &
SCAN_2="$(scan 2)"
wait || true
CHECKINS="$(psql_run -c "select count(*) from public.checkins where booking_id='$BOOKING_A'")"
echo "check-ins for the double scan: $CHECKINS"
if [ "$CHECKINS" != "1" ]; then
  echo "FAIL: the double scan created $CHECKINS check-ins instead of 1." >&2
  exit 1
fi
echo "OK: a double scan checks the person in once."
