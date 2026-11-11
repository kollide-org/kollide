-- Fails if any table in the public schema has Row Level Security switched off.
do $$
declare
  missing text;
begin
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ' order by c.relname)
    into missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity;

  if missing is not null then
    raise exception 'RLS is disabled on: %', missing;
  end if;
end
$$;
