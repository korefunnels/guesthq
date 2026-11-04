-- GuestHQ initial schema
create extension if not exists pgcrypto;

-- ───────────── Tables ─────────────
create table public.planners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  business_name text not null default '',
  logo_url text,
  brand_colour text not null default '#0f766e',
  whatsapp_number text,
  created_at timestamptz not null default now()
);

create table public.weddings (
  id uuid primary key default gen_random_uuid(),
  planner_id uuid not null references public.planners(id) on delete cascade,
  couple_names text not null,
  slug text not null unique,
  start_date date,
  end_date date,
  location text,
  phase text not null default 'rsvp' check (phase in ('invite','rsvp','travel','live')),
  rsvp_deadline date,
  consent_text text not null default 'I consent to the planner storing dietary and allergy information for my household so that the caterer can prepare safe meals. It will only be shared with suppliers for this wedding and deleted afterwards.',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  starts_at timestamptz,
  venue text,
  dress_code text,
  sort_order int not null default 0
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  whatsapp_number text,
  token text not null unique default encode(gen_random_bytes(16), 'hex') check (length(token) >= 24),
  language text not null default 'en' check (language in ('en','af')),
  last_reminded_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  full_name text not null,
  is_child boolean not null default false,
  age int,
  is_plus_one boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.invitations (
  guest_id uuid not null references public.guests(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  primary key (guest_id, event_id)
);

create table public.rsvps (
  guest_id uuid not null references public.guests(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','yes','no')),
  source text not null default 'self' check (source in ('self','assisted')),
  updated_at timestamptz not null default now(),
  primary key (guest_id, event_id)
);

create table public.dietary (
  guest_id uuid primary key references public.guests(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  preference text not null default 'none' check (preference in ('none','vegetarian','vegan','halal','kosher','other')),
  allergies text,
  allergy_severity text not null default 'none' check (allergy_severity in ('none','mild','severe')),
  notes text,
  updated_at timestamptz not null default now()
);

create table public.accommodation_blocks (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  name text not null,
  rooms_total int not null default 0,
  deadline date
);

create table public.travel (
  household_id uuid primary key references public.households(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  arrival_at timestamptz,
  arrival_flight text,
  departure_at timestamptz,
  departure_flight text,
  needs_transfer boolean not null default false,
  accommodation_block_id uuid references public.accommodation_blocks(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.consents (
  household_id uuid primary key references public.households(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  consented_at timestamptz not null default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  household_id uuid references public.households(id) on delete set null,
  storage_path text not null,
  caption text,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- ───────────── Indexes ─────────────
create index on public.weddings (planner_id);
create index on public.events (wedding_id);
create index on public.households (wedding_id);
create index on public.guests (wedding_id);
create index on public.guests (household_id);
create index on public.invitations (wedding_id);
create index on public.invitations (event_id);
create index on public.rsvps (wedding_id);
create index on public.rsvps (event_id);
create index on public.dietary (wedding_id);
create index on public.accommodation_blocks (wedding_id);
create index on public.travel (wedding_id);
create index on public.travel (accommodation_block_id);
create index on public.consents (wedding_id);
create index on public.photos (wedding_id, created_at desc);
create index on public.photos (household_id);
-- households.token: unique constraint above creates the index.
-- rsvps(guest_id, event_id): primary key above creates the index.

-- ───────────── RLS ─────────────
create or replace function public.owns_wedding(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.weddings w
    join public.planners p on p.id = w.planner_id
    where w.id = wid and p.user_id = (select auth.uid())
  );
$$;
revoke execute on function public.owns_wedding(uuid) from public, anon;
grant execute on function public.owns_wedding(uuid) to authenticated;

alter table public.planners enable row level security;
alter table public.weddings enable row level security;
alter table public.events enable row level security;
alter table public.households enable row level security;
alter table public.guests enable row level security;
alter table public.invitations enable row level security;
alter table public.rsvps enable row level security;
alter table public.dietary enable row level security;
alter table public.accommodation_blocks enable row level security;
alter table public.travel enable row level security;
alter table public.consents enable row level security;
alter table public.photos enable row level security;

create policy planners_own on public.planners for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy weddings_own on public.weddings for all to authenticated
  using (planner_id in (select id from public.planners where user_id = (select auth.uid())))
  with check (planner_id in (select id from public.planners where user_id = (select auth.uid())));

do $$
declare t text;
begin
  foreach t in array array['events','households','guests','invitations','rsvps','dietary',
                           'accommodation_blocks','travel','consents','photos']
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.owns_wedding(wedding_id)) with check (public.owns_wedding(wedding_id))',
      t || '_own', t);
  end loop;
end $$;

-- Guests never hit the database directly: /g/[token] uses the service role server-side.

-- ───────────── Storage ─────────────
-- Private bucket; app serves photos via short-lived signed URLs. Path: {wedding_id}/{uuid}.jpg
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Planner logos: public bucket (logos appear on printed supplier documents). Path: {planner_id}/logo.*
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do nothing;
