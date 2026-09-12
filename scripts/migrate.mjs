import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('SUPABASE_DB_URL is not set. Add it to .env.local (password must be URL-encoded).');
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

await client.query(`
  create table if not exists public.schema_migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  );
`);

const { rows } = await client.query('select name from public.schema_migrations');
const applied = new Set(rows.map((row) => row.name));

const pending = readdirSync(MIGRATIONS)
  .filter((file) => file.endsWith('.sql'))
  .sort()
  .filter((file) => !applied.has(file));

if (pending.length === 0) {
  console.log('Database is up to date.');
} else {
  for (const file of pending) {
    process.stdout.write(`applying ${file} … `);
    try {
      await client.query('begin');
      await client.query(readFileSync(join(MIGRATIONS, file), 'utf8'));
      await client.query('insert into public.schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log('done');
    } catch (error) {
      await client.query('rollback');
      console.log('failed');
      console.error(error.message);
      await client.end();
      process.exit(1);
    }
  }
}

await client.end();
