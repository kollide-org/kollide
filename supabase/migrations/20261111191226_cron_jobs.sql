-- Scheduled jobs (pg_cron). The Worker address and the shared secret live in Supabase Vault, never in the repo.
-- Set them once per project (see docs/backend/EMAIL_JOBS_SETUP.md):
--   select vault.create_secret('https://<worker address>', 'worker_url');
--   select vault.create_secret('<JOB_SHARED_SECRET>', 'job_shared_secret');
-- Until they exist the flush job records "skipped" instead of failing, so local and CI stay quiet.

create function private.cron_flush_email() returns void
language plpgsql security definer set search_path = '' as $$
declare
  url text;
  secret text;
begin
  select decrypted_secret into url from vault.decrypted_secrets where name = 'worker_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'job_shared_secret';
  if url is null or secret is null then
    perform private.record_job_run('flush-email', 'skipped', jsonb_build_object('reason', 'worker_url or job_shared_secret is not set in Vault'), null);
    return;
  end if;
  -- Asynchronous: the Worker records its own result in job_runs when it finishes.
  perform net.http_post(
    url := rtrim(url, '/') || '/jobs/flush-email',
    headers := jsonb_build_object('content-type', 'application/json', 'x-job-secret', secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
exception when others then
  perform private.record_job_run('flush-email', 'error', null, sqlerrm);
end
$$;
revoke all on function private.cron_flush_email() from public;
grant execute on function private.cron_flush_email() to service_role;

-- cron.schedule with an existing name updates that job, so this migration is safe to re-run.
select cron.schedule('flush-email', '* * * * *', 'select private.cron_flush_email()');
select cron.schedule('reconfirmation', '*/15 * * * *', 'select private.job_reconfirmation()');
select cron.schedule('reminders', '*/30 * * * *', 'select private.job_reminders()');
select cron.schedule('housekeeping', '15 21 * * *', 'select private.job_housekeeping()'); -- 02:45 India time
