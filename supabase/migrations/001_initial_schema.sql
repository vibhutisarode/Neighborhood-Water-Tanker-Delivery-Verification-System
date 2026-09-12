create type public.user_role as enum ('MANAGER', 'DRIVER');
create type public.delivery_status as enum ('PENDING', 'VERIFIED', 'DISPUTED');

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role public.user_role not null default 'DRIVER',
  created_at timestamptz not null default now()
);

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  daily_quota_liters integer not null check (daily_quota_liters > 0),
  scheduled_liters integer not null default 0,
  delivery_window_start time,
  delivery_window_end time,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tankers (
  id uuid primary key default gen_random_uuid(),
  tanker_number text not null unique,
  driver_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.deliveries (
  id uuid primary key default gen_random_uuid(),
  tanker_id uuid not null references public.tankers(id),
  driver_name text not null,
  block_id uuid not null references public.blocks(id),
  claimed_volume_liters integer not null check (claimed_volume_liters > 0),
  meter_reading integer not null check (meter_reading > 0),
  photo_url text not null,
  status public.delivery_status not null default 'PENDING',
  possible_duplicate boolean not null default false,
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  verified_by uuid references public.users(id),
  disputed_at timestamptz,
  disputed_by uuid references public.users(id),
  dispute_reason text,
  manager_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  actor_id uuid references public.users(id),
  action text not null,
  comment text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index deliveries_submitted_at_idx on public.deliveries(submitted_at desc);
create index deliveries_status_idx on public.deliveries(status);
create index deliveries_block_idx on public.deliveries(block_id);
create index deliveries_tanker_idx on public.deliveries(tanker_id);
create index audit_events_delivery_idx on public.audit_events(delivery_id, created_at);

alter table public.users enable row level security;
alter table public.blocks enable row level security;
alter table public.tankers enable row level security;
alter table public.deliveries enable row level security;
alter table public.audit_events enable row level security;

create policy "authenticated managers can read operational data" on public.deliveries for select to authenticated using (exists (select 1 from public.users where id = auth.uid() and role = 'MANAGER'));
create policy "authenticated managers can update delivery decisions" on public.deliveries for update to authenticated using (exists (select 1 from public.users where id = auth.uid() and role = 'MANAGER'));
create policy "authenticated drivers can submit deliveries" on public.deliveries for insert to authenticated with check (true);
create policy "public can read block summaries" on public.blocks for select to anon, authenticated using (active = true);
create policy "managers can read audit events" on public.audit_events for select to authenticated using (exists (select 1 from public.users where id = auth.uid() and role = 'MANAGER'));
