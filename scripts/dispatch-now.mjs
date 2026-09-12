const target = process.argv[2] ?? 'http://localhost:3000';
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error('CRON_SECRET is not set.');
  process.exit(1);
}

const response = await fetch(`${target}/api/cron/dispatch`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
  body: '{}',
});

console.log(response.status, await response.text());
