import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

const { rows: [t] } = await c.query(`
  select to_char((now() + interval '2 minutes') at time zone 'Asia/Kathmandu', 'HH24:MI') as fire_local,
         to_char(now() at time zone 'Asia/Kathmandu', 'HH24:MI:SS') as now_local`);

const { rows: [med] } = await c.query(`select id, name from medications where name = 'test' limit 1`);
await c.query(`update schedules set times = ARRAY[$1::time], kind='fixed', is_active=true,
               starts_on = (now() at time zone 'Asia/Kathmandu')::date where medication_id = $2`, [t.fire_local, med.id]);
console.log(`local ${t.now_local} -> "test" will fire at ${t.fire_local}. Leave it alone.\n`);

for (let i = 0; i < 30; i += 1) {
  const { rows: [d] } = await c.query(`
    select d.status, d.alert_count, to_char(d.due_at at time zone 'Asia/Kathmandu','HH24:MI') as due_local,
           d.last_alert_at::text
    from doses d join medications m on m.id=d.medication_id
    where m.name='test' order by d.due_at desc limit 1`);
  const { rows: [net] } = await c.query(`select to_char(created,'HH24:MI:SS') as at, status_code, left(content,95) as body from net._http_response order by created desc limit 1`);

  if (d) console.log(`  dose due ${d.due_local} status=${d.status} alerts=${d.alert_count} | dispatcher ${net?.at} ${net?.status_code} ${net?.body}`);
  if (d?.alert_count > 0) { console.log('\n>>> ALERT SENT - check the phone'); break; }
  await new Promise((r) => setTimeout(r, 20000));
}
await c.end();
