create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.medications enable row level security;
alter table public.schedules enable row level security;
alter table public.doses enable row level security;

-- households
create policy households_read on public.households
  for select using (id = public.current_household_id());
create policy households_admin_write on public.households
  for update using (id = public.current_household_id() and public.is_admin())
  with check (id = public.current_household_id());

-- profiles
create policy profiles_read on public.profiles
  for select using (household_id = public.current_household_id());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles p where p.id = auth.uid()));
create policy profiles_admin_update on public.profiles
  for update using (household_id = public.current_household_id() and public.is_admin())
  with check (household_id = public.current_household_id());

-- devices: a device belongs to exactly one person and only they touch it
create policy devices_owner_all on public.devices
  for all using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- medications
create policy medications_read on public.medications
  for select using (household_id = public.current_household_id());
create policy medications_write on public.medications
  for all using (
    household_id = public.current_household_id()
    and (public.is_admin() or profile_id = auth.uid())
  )
  with check (
    household_id = public.current_household_id()
    and (public.is_admin() or profile_id = auth.uid())
  );

-- schedules follow their medication
create policy schedules_read on public.schedules
  for select using (
    exists (
      select 1 from public.medications m
      where m.id = schedules.medication_id
        and m.household_id = public.current_household_id()
    )
  );
create policy schedules_write on public.schedules
  for all using (
    exists (
      select 1 from public.medications m
      where m.id = schedules.medication_id
        and m.household_id = public.current_household_id()
        and (public.is_admin() or m.profile_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.medications m
      where m.id = schedules.medication_id
        and m.household_id = public.current_household_id()
        and (public.is_admin() or m.profile_id = auth.uid())
    )
  );

-- doses are written by the dispatcher (service role); users read theirs and resolve them
create policy doses_read on public.doses
  for select using (household_id = public.current_household_id());
create policy doses_resolve on public.doses
  for update using (
    household_id = public.current_household_id()
    and (public.is_admin() or profile_id = auth.uid())
  )
  with check (household_id = public.current_household_id());
