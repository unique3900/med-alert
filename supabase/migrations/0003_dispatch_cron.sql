-- The dispatcher has to run every minute. Vercel's free plan only runs cron jobs
-- once a day, so Postgres owns the schedule and calls the app over HTTP.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table if not exists private.app_config (
  key text primary key,
  value text not null
);

create or replace function private.dispatch_due_doses()
returns void
language plpgsql
security definer
set search_path = private, extensions
as $$
declare
  base_url text;
  secret text;
begin
  select value into base_url from private.app_config where key = 'app_url';
  select value into secret from private.app_config where key = 'cron_secret';

  if base_url is null or secret is null then
    raise notice 'med-alert: app_url / cron_secret not configured, skipping';
    return;
  end if;

  perform net.http_post(
    url := base_url || '/api/cron/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

select cron.unschedule('med-alert-dispatch')
where exists (select 1 from cron.job where jobname = 'med-alert-dispatch');

select cron.schedule('med-alert-dispatch', '* * * * *', $$select private.dispatch_due_doses()$$);
