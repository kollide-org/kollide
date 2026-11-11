-- Events and hubs (B4). Payments are OFF in v1: see docs/backend/PAYMENTS_LATER.md.
-- Everything is written through functions; the browser only reads.

-- ---------------------------------------------------------------- events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id),
  type public.event_type not null,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  category_id smallint references public.categories (id),
  area_id smallint not null references public.areas (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer check (capacity between 2 and 500),
  overbook_pct smallint not null default 0 check (overbook_pct between 0 and 50),
  approval_mode public.approval_mode not null default 'host_approval',
  women_only boolean not null default false,
  min_age smallint not null default 18 check (min_age between 18 and 99),
  max_age smallint check (max_age between 18 and 99),
  house_rules text check (char_length(house_rules) <= 1000),
  pricing_mode public.pricing_mode not null default 'free',
  -- Reserved for P1. While payments are off the trigger below refuses any value above 0.
  price_paise integer not null default 0 check (price_paise >= 0),
  -- What people are shown, for example "₹300 at the venue". No money moves through Kollide in v1.
  price_label text check (char_length(price_label) between 1 and 80),
  house_party boolean not null default false,
  cover_key text,
  status public.event_status not null default 'draft',
  review_note text check (char_length(review_note) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  published_at timestamptz,
  partner_url text check (partner_url ~ '^https://[^[:space:]]+$' and char_length(partner_url) <= 500),
  referral_code text check (referral_code ~ '^[A-Za-z0-9_-]{1,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (max_age is null or max_age >= min_age),
  check (type = 'partner' or capacity is not null),
  check (not house_party or (type = 'community' and capacity <= 25 and approval_mode = 'host_approval')),
  check (type <> 'partner' or partner_url is not null),
  check (type = 'partner' or (partner_url is null and referral_code is null)),
  check (type <> 'partner' or pricing_mode in ('free', 'pay_at_venue')),
  check (pricing_mode not in ('pay_at_venue', 'cost_split') or price_label is not null)
);
create index events_published_start_idx on public.events (starts_at) where status = 'published';
create index events_area_start_idx on public.events (area_id, starts_at) where status = 'published';
create index events_category_idx on public.events (category_id) where status = 'published';
create index events_women_only_idx on public.events (starts_at) where status = 'published' and women_only;
create index events_host_idx on public.events (host_id, starts_at desc);
create index events_status_idx on public.events (status, submitted_at);

-- The exact address and notes. Only the host and admins read the table; attendees get the address
-- from get_event_address(), which applies the same rule plus booking access (B5).
create table public.event_private (
  event_id uuid primary key references public.events (id) on delete cascade,
  address text check (char_length(btrim(address)) between 5 and 300),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  directions_note text check (char_length(directions_note) <= 500),
  host_notes text check (char_length(host_notes) <= 1000),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- hubs
create table public.hubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) between 3 and 80),
  subtitle text check (char_length(subtitle) <= 160),
  art_key text,
  accent_color text not null default '#A63A50' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  starts_on date,
  ends_on date,
  sort_order integer not null default 0,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create table public.hub_events (
  hub_id uuid not null references public.hubs (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (hub_id, event_id)
);
create index hub_events_event_idx on public.hub_events (event_id);

create table public.featured_slots (
  event_id uuid primary key references public.events (id) on delete cascade,
  position smallint not null unique check (position between 1 and 6),
  featured_until timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- helpers
create function private.is_event_host(p_event uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events where id = p_event and host_id = (select auth.uid()))
$$;
revoke all on function private.is_event_host(uuid) from public;
grant execute on function private.is_event_host(uuid) to authenticated;

-- ---------------------------------------------------------------- rules enforced on every write
create function private.enforce_event_rules() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Payments are off in v1. Paid pricing (and any price above 0) is refused until app_config
  -- payments_enabled is true, and even then only for Kollide-run events (P1).
  if new.pricing_mode = 'paid' or new.price_paise > 0 then
    if not private.payments_enabled() or new.type <> 'kollide' then
      raise exception 'payments_off' using errcode = 'check_violation';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status <> old.status then
    if not (
      (old.status = 'draft' and new.status in ('pending_review', 'cancelled'))
      or (old.status = 'pending_review' and new.status in ('published', 'draft', 'cancelled'))
      or (old.status = 'published' and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'invalid_status_change' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end
$$;
create trigger events_rules before insert or update on public.events
  for each row execute function private.enforce_event_rules();

create trigger events_touch before update on public.events for each row execute function private.touch_updated_at();
create trigger event_private_touch before update on public.event_private for each row execute function private.touch_updated_at();
create trigger hubs_touch before update on public.hubs for each row execute function private.touch_updated_at();

create trigger audit_events after insert or update or delete on public.events
  for each row execute function private.audit_change('host_id', 'type', 'title', 'status', 'pricing_mode', 'review_note');
create trigger audit_hubs after insert or update or delete on public.hubs
  for each row execute function private.audit_change();
create trigger audit_featured after insert or update or delete on public.featured_slots
  for each row execute function private.audit_change();

-- ---------------------------------------------------------------- RLS and privileges (read only for the browser)
alter table public.events enable row level security;
alter table public.event_private enable row level security;
alter table public.hubs enable row level security;
alter table public.hub_events enable row level security;
alter table public.featured_slots enable row level security;
revoke all on table public.events, public.event_private, public.hubs, public.hub_events, public.featured_slots
  from anon, authenticated;

-- Columns the browser may read. partner_url, referral_code, review_note, reviewed_by and reviewed_at are
-- not granted: they come through functions (host or admin) or the Worker (service role).
grant select (id, host_id, type, title, description, category_id, area_id, starts_at, ends_at, capacity, overbook_pct,
  approval_mode, women_only, min_age, max_age, house_rules, pricing_mode, price_paise, price_label, house_party,
  cover_key, status, submitted_at, published_at, created_at, updated_at)
  on public.events to anon, authenticated;

create policy events_read_public on public.events for select to anon using (status = 'published');
create policy events_read_members on public.events for select to authenticated
  using (status = 'published' or host_id = (select auth.uid()) or (select private.is_admin()));

grant select on public.event_private to authenticated;
create policy event_private_read on public.event_private for select to authenticated
  using ((select private.is_event_host(event_id)) or (select private.is_admin()));

grant select on public.hubs, public.hub_events, public.featured_slots to anon, authenticated;
create policy hubs_read_public on public.hubs for select to anon using (published);
create policy hubs_read_members on public.hubs for select to authenticated using (published or (select private.is_admin()));
create policy hub_events_read_public on public.hub_events for select to anon
  using (exists (select 1 from public.hubs h where h.id = hub_id and h.published)
     and exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));
create policy hub_events_read_members on public.hub_events for select to authenticated
  using ((select private.is_admin())
     or (exists (select 1 from public.hubs h where h.id = hub_id and h.published)
         and exists (select 1 from public.events e where e.id = event_id and e.status = 'published')));
create policy featured_read_public on public.featured_slots for select to anon
  using ((featured_until is null or featured_until > now())
     and exists (select 1 from public.events e where e.id = event_id and e.status = 'published'));
create policy featured_read_members on public.featured_slots for select to authenticated
  using ((select private.is_admin())
     or ((featured_until is null or featured_until > now())
         and exists (select 1 from public.events e where e.id = event_id and e.status = 'published')));
