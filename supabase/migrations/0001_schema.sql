create extension if not exists pgcrypto;

create type public.member_role as enum ('admin', 'member');
create type public.schedule_kind as enum ('fixed', 'interval');
create type public.dose_status as enum ('pending', 'notified', 'taken', 'skipped', 'missed');

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  full_name text not null,
  role public.member_role not null default 'member',
  accent text not null default 'violet',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_household_idx on public.profiles (household_id);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  label text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index devices_profile_idx on public.devices (profile_id) where revoked_at is null;

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  strength text,
  form text,
  instructions text,
  accent text not null default 'violet',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medications_profile_idx on public.medications (profile_id) where is_active;

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references public.medications (id) on delete cascade,
  kind public.schedule_kind not null,
  times time[] not null default '{}',
  interval_minutes integer,
  window_start time not null default '08:00',
  window_end time not null default '22:00',
  days_of_week smallint[] not null default '{0,1,2,3,4,5,6}',
  starts_on date not null default current_date,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedules_shape check (
    (kind = 'fixed' and coalesce(array_length(times, 1), 0) > 0)
    or (kind = 'interval' and interval_minutes between 15 and 1440)
  ),
  constraint schedules_range check (ends_on is null or ends_on >= starts_on)
);

create index schedules_medication_idx on public.schedules (medication_id) where is_active;

create table public.doses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  medication_id uuid not null references public.medications (id) on delete cascade,
  schedule_id uuid not null references public.schedules (id) on delete cascade,
  origin_at timestamptz not null,
  due_at timestamptz not null,
  status public.dose_status not null default 'pending',
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  alert_count integer not null default 0,
  last_alert_at timestamptz,
  created_at timestamptz not null default now(),
  unique (schedule_id, origin_at)
);

create index doses_due_open_idx on public.doses (due_at) where status in ('pending', 'notified');
create index doses_profile_idx on public.doses (profile_id, due_at desc);
create index doses_household_idx on public.doses (household_id, due_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger medications_touch before update on public.medications
  for each row execute function public.touch_updated_at();
create trigger schedules_touch before update on public.schedules
  for each row execute function public.touch_updated_at();

-- A new auth user joins an existing household when invited (household_id in metadata),
-- otherwise bootstraps their own household as its admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  target_household uuid := nullif(meta ->> 'household_id', '')::uuid;
  display_name text := coalesce(nullif(meta ->> 'full_name', ''), split_part(new.email, '@', 1));
  member_role public.member_role := coalesce(nullif(meta ->> 'role', '')::public.member_role, 'member');
begin
  if target_household is null then
    insert into public.households (name, timezone)
    values (
      coalesce(nullif(meta ->> 'household_name', ''), display_name || '''s household'),
      coalesce(nullif(meta ->> 'timezone', ''), 'UTC')
    )
    returning id into target_household;
    member_role := 'admin';
  end if;

  insert into public.profiles (id, household_id, full_name, role, accent)
  values (
    new.id,
    target_household,
    display_name,
    member_role,
    coalesce(nullif(meta ->> 'accent', ''), 'violet')
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
