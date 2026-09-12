-- A household usually has one person who actually hands out the medication. They
-- need every alarm, not only their own, and they need to be able to record the
-- dose they just administered.

alter table public.profiles
  add column if not exists receives_all_alerts boolean not null default false;

comment on column public.profiles.receives_all_alerts is
  'Also alerted for every other member''s doses, and allowed to resolve them.';

create index if not exists profiles_caregiver_idx
  on public.profiles (household_id) where receives_all_alerts;

create or replace function public.is_caregiver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and receives_all_alerts
  );
$$;

drop policy if exists doses_resolve on public.doses;

create policy doses_resolve on public.doses
  for update using (
    household_id = public.current_household_id()
    and (public.is_admin() or public.is_caregiver() or profile_id = auth.uid())
  )
  with check (household_id = public.current_household_id());
