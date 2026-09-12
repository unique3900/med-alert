import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
for (let i = 0; i < 10; i += 1) {
  const { rows: [d] } = await c.query(`select status, alert_count, last_alert_at::text from doses where id = 'a2cef165-28b7-4f2e-8efc-d12f04cdb5e7'`);
  const { rows: [n] } = await c.query(`select to_char(created,'HH24:MI:SS') as at, status_code, left(content,90) as body from net._http_response order by created desc limit 1`);
  console.log(`${new Date().toISOString().slice(11,19)} dose=${d.status}/${d.alert_count} | cron ${n?.at} ${n?.status_code} ${n?.body}`);
  if (d.alert_count > 0) { console.log('>>> ALERT SENT'); break; }
  await new Promise(r => setTimeout(r, 25000));
}
await c.end();
