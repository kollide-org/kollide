-- Extensions. No scheduled jobs yet: pg_cron jobs arrive in B5, pg_net calls the Worker from them.
create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
