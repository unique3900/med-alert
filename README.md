# Med Alert

A progressive web app that rings a family's phones when a dose is due. Each person has their own
account and their own devices; one admin manages the household, the medications and the schedules.

- **Next.js 16** (App Router, React 19, TypeScript, Tailwind v4) on **Vercel**
- **Supabase** for auth, Postgres, row-level security, and the every-minute scheduler
- **Firebase Cloud Messaging** for web push to each registered device

---

## How it works

```
Supabase pg_cron (every minute)
        │  pg_net http_post
        ▼
POST /api/cron/dispatch          ← guarded by CRON_SECRET
        │
        ├─ materialise dose rows for the next 2 hours from each active schedule
        ├─ mark unresolved doses older than 45 minutes as missed
        └─ for every dose now due and still open:
              send an FCM data message to all of that person's devices
              re-send every 2 minutes, up to 10 times, until it is resolved
        ▼
public/sw.js  → notification (requireInteraction + vibration + Taken / Snooze actions)
app open      → full-screen alarm overlay with a looping Web Audio siren
```

Vercel's free plan only runs cron jobs once a day, so Postgres owns the minute-level schedule and
calls the app over HTTP. Nothing else about the deployment leaves the free tier.

### Times and time zones

Every schedule is stored as a local wall-clock time plus the household's IANA time zone. Occurrences
are resolved through `Intl` at dispatch time, so a 20:00 dose stays at 20:00 across a DST change
rather than drifting by an hour. That logic lives in `src/lib/domain/occurrences.ts` and is covered
by `tests/occurrences.test.ts`.

### Scheduling shapes

| Kind | Example | Stored as |
|---|---|---|
| Fixed times | 08:00 and 20:30 every day | `kind='fixed'`, `times[]` |
| Repeating | every 6 hours between 08:00 and 22:00 | `kind='interval'`, `interval_minutes`, `window_start`, `window_end` |

Both respect a weekday mask and an optional start/end date for finite courses.

---

## Setup

### 1. Supabase

Create a project, then from **Project settings → API** copy the project URL, the `anon` key and the
`service_role` key. From **Project settings → Database** copy the connection string.

```bash
cp .env.example .env.local
```

Fill in the Supabase block. The password in `SUPABASE_DB_URL` must be URL-encoded (`@` → `%40`,
`!` → `%21`).

```bash
npm run db:migrate
```

This applies `supabase/migrations/*.sql` in order and records them in `public.schema_migrations`:
schema, row-level security, then the `pg_cron` job.

### 2. Firebase Cloud Messaging

Create a Firebase project and add a **Web** app.

- **Project settings → General** gives the `NEXT_PUBLIC_FIREBASE_*` values.
- **Project settings → Cloud Messaging → Web Push certificates** → *Generate key pair* gives
  `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
- **Project settings → Service accounts → Generate new private key** gives `FIREBASE_PROJECT_ID`,
  `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` (keep the `\n` escapes and wrap it in quotes).

### 3. The admin account

Public sign-up is closed. Create the first account, which also creates the household:

```bash
npm run db:bootstrap
```

Everyone else is added from **Family** inside the app, which issues a one-time password to hand over.

### 4. Run it

```bash
npm run dev
```

Sign in, open **Settings**, and allow notifications on each phone that should ring.

---

## Deploying

1. Push to GitHub and import the repository on Vercel.
2. Add every variable from `.env.example` to the Vercel project (`SUPABASE_DB_URL` is only needed
   locally). Generate a fresh `CRON_SECRET` for production.
3. Deploy, then point the scheduler at the deployment. In the Supabase SQL editor:

```sql
insert into private.app_config (key, value) values
  ('app_url', 'https://your-app.vercel.app'),
  ('cron_secret', 'the CRON_SECRET from Vercel')
on conflict (key) do update set value = excluded.value;
```

Check it is firing:

```sql
select * from cron.job_run_details order by start_time desc limit 10;
```

To exercise the dispatcher by hand against any environment:

```bash
npm run dispatch:now -- https://your-app.vercel.app
```

---

## How hard the alarm rings

A web app cannot take over the ringer the way a native alarm clock can. Med Alert gets as close as
the platform allows:

- the notification is posted with `requireInteraction`, so it stays on screen until it is answered;
- a long vibration pattern fires with every alert;
- the dispatcher repeats the alert every 2 minutes, up to 10 times, until someone taps **Taken** or
  **Snooze** — an unanswered dose keeps buzzing for twenty minutes;
- when the app is in the foreground, a full-screen overlay plays a looping siren through Web Audio.

Platform notes:

- **Android / desktop Chrome, Edge, Firefox** — works once notifications are allowed.
- **iOS 16.4+** — web push only works after the app is added to the Home Screen. Install it first,
  then allow notifications from inside the installed app.
- The notification sound is chosen by the operating system. Put the phone on a loud profile and, on
  Android, set the Med Alert notification channel to an alarm-style sound.

---

## Project layout

```
src/
  app/
    (auth)/login         sign-in
    (app)/today          the day's doses, next-dose card, adherence
    (app)/meds           medications and their schedules
    (app)/family         admin: members, roles, device status
    (app)/settings       profile, password, household, registered devices
    api/cron/dispatch    the every-minute dispatcher
    api/devices          register / revoke an FCM token
    api/doses/[id]       taken · skipped · snooze
    actions/             server actions for every mutation
  lib/
    domain/occurrences   schedule -> instants (DST-correct)
    domain/dispatch      materialise, expire, alert
    domain/doses         day queries and dose resolution
    time/zone            Intl-based zoned time helpers
    push/                FCM client and admin
    supabase/            browser, server, service-role and session clients
  components/ui          buttons, fields, panels
  components/app         shell, alarm overlay, forms
supabase/migrations      schema, RLS, cron
public/sw.js             push handling and the offline shell
```

## Commands

```bash
npm run dev           # local development
npm run build         # production build
npm run typecheck     # route typegen + tsc
npm run lint          # eslint
npm run test          # vitest
npm run icons         # regenerate the PWA icon set
npm run db:migrate    # apply pending SQL migrations
npm run db:bootstrap  # create the first admin and household
npm run dispatch:now  # trigger the dispatcher manually
```

## Security notes

- Row-level security scopes every table to the signed-in user's household; the `service_role` key is
  used only by the dispatcher and by admin-guarded server actions.
- Devices are readable and writable only by their owner.
- The dispatcher endpoint compares `CRON_SECRET` in constant time and is excluded from the auth proxy.
- No secrets are committed. `.env.local` is ignored; `NEXT_PUBLIC_*` holds only values that are safe
  in the browser bundle.
