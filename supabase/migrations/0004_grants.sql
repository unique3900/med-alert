-- Row-level security decides which rows a role may see. It does not grant access
-- to the table in the first place. Without these grants PostgREST leaves the
-- tables out of the schema cache for that role and every signed-in query fails
-- with PGRST205, even though the policies are correct.
--
-- `anon` is deliberately left with nothing: every route in the app requires a
-- session, so unauthenticated reads should not resolve at all.

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.households,
  public.profiles,
  public.devices,
  public.medications,
  public.schedules,
  public.doses
to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

notify pgrst, 'reload schema';
