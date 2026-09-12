import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
for (let i = 0; i < 40; i += 1) {
  const { rows: [n] } = await c.query(`select to_char(created,'HH24:MI:SS') as at, status_code, content::text as body from net._http_response order by created desc limit 1`);
  const { rows } = await c.query(`
    select to_char(d.due_at at time zone 'Asia/Kathmandu','HH24:MI') as due_local, m.name, p.full_name, d.status, d.alert_count
    from doses d join medications m on m.id=d.medication_id join profiles p on p.id=d.profile_id
    where d.due_at between now() - interval '20 minutes' and now() + interval '20 minutes' order by d.due_at`);
  const local = (await c.query(`select to_char(now() at time zone 'Asia/Kathmandu','HH24:MI:SS') as t`)).rows[0].t;
  console.log(`${local} | cron ${n?.at} ${n?.status_code} ${String(n?.body).slice(0,80)}`);
  for (const r of rows) console.log(`        ${r.due_local} ${r.name.padEnd(16)} ${r.full_name.split(' ')[0].padEnd(10)} ${r.status}/${r.alert_count}`);
  if (String(n?.body).match(/"delivered":[1-9]/)) { console.log('\n>>> DELIVERED'); break; }
  await new Promise(r => setTimeout(r, 30000));
}
await c.end();
