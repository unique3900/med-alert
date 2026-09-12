import { createInterface } from 'node:readline/promises';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

const email = (await rl.question('Admin email: ')).trim();
const password = (await rl.question('Admin password (min 8 chars): ')).trim();
const fullName = (await rl.question('Full name: ')).trim() || email.split('@')[0];
const householdName = (await rl.question('Household name: ')).trim() || `${fullName}'s household`;
const timezone = (await rl.question('Time zone [Asia/Kathmandu]: ')).trim() || 'Asia/Kathmandu';

rl.close();

if (!email || password.length < 8) {
  console.error('An email and a password of at least 8 characters are required.');
  process.exit(1);
}

try {
  new Intl.DateTimeFormat('en-US', { timeZone: timezone });
} catch {
  console.error(`Unknown time zone: ${timezone}`);
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName, household_name: householdName, timezone, role: 'admin' },
});

if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`\nAdmin created: ${email}`);
console.log(`Household: ${householdName} (${timezone})`);
console.log(`User id: ${data.user.id}`);
