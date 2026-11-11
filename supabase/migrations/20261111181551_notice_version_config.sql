-- Current version of the notices (code of conduct and privacy notice). The server only accepts
-- consent for this version, so publishing a new notice means bumping this value and asking everyone again.
insert into public.app_config (key, value) values ('notice_version', '"v1"'::jsonb)
on conflict (key) do nothing;

alter table public.app_config
  add constraint app_config_notice_version_is_text
  check (key <> 'notice_version' or jsonb_typeof(value) = 'string');
