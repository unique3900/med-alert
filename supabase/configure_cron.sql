-- Run once, after the first deploy. Not committed with real values - substitute
-- your deployment URL and the CRON_SECRET from your Vercel env, then run it in
-- the Supabase SQL editor.

insert into private.app_config (key, value) values
  ('app_url', 'https://your-app.vercel.app'),
  ('cron_secret', 'paste-CRON_SECRET-here')
on conflict (key) do update set value = excluded.value;

-- Verify:
--   select * from cron.job where jobname = 'med-alert-dispatch';
--   select * from cron.job_run_details order by start_time desc limit 10;
