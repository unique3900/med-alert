import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CircleCheckBig } from 'lucide-react';
import { requireSession } from '@/lib/domain/session';
import { supabaseServer } from '@/lib/supabase/server';
import { dosesForDay, recentAdherence } from '@/lib/domain/doses';
import { formatDayLong, formatTime } from '@/lib/time/format';
import { PushGate } from '@/components/app/push-gate';
import { Countdown } from '@/components/app/next-dose';
import { DoseList, type DoseView } from '@/components/app/dose-list';
import { Panel } from '@/components/ui/panel';
import { buttonClass } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Today' };
export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const session = await requireSession();
  const supabase = await supabaseServer();
  const now = new Date();

  const [doses, adherence, { count: memberCount }] = await Promise.all([
    dosesForDay(supabase, { timezone: session.timezone, reference: now }),
    recentAdherence(supabase, { days: 7 }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
  ]);

  const showPerson = (memberCount ?? 1) > 1;

  const views: DoseView[] = doses.map((dose) => ({
    id: dose.id,
    timeLabel: formatTime(dose.due_at, session.timezone),
    status: dose.status,
    medication: dose.medications.name,
    detail: [dose.medications.strength, dose.medications.form].filter(Boolean).join(' ') || 'Scheduled dose',
    instructions: dose.medications.instructions,
    accent: dose.medications.accent,
    personName: dose.profiles.full_name,
    personId: dose.profiles.id,
    isPast: Date.parse(dose.due_at) < now.getTime(),
  }));

  const upcoming = doses.find(
    (dose) => (dose.status === 'pending' || dose.status === 'notified') && Date.parse(dose.due_at) >= now.getTime(),
  );
  const takenToday = doses.filter((dose) => dose.status === 'taken').length;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-ink-muted">{formatDayLong(now, session.timezone)}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hello, {session.profile.full_name.split(' ')[0]}
        </h1>
      </header>

      <PushGate deviceLabel={session.profile.full_name} />

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          {upcoming ? (
            <div className="space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-accent uppercase">Next dose</p>
              <p className="text-2xl font-semibold tracking-tight">
                {upcoming.medications.name}
                <span className="ml-2 font-mono text-lg text-ink-muted tabular-nums">
                  {formatTime(upcoming.due_at, session.timezone)}
                </span>
              </p>
              <p className="text-sm text-ink-muted">
                {showPerson ? `${upcoming.profiles.full_name} · ` : ''}
                <Countdown dueAt={upcoming.due_at} />
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <CircleCheckBig className="size-8 text-success" />
              <div>
                <p className="text-lg font-semibold tracking-tight">Nothing left today</p>
                <p className="text-sm text-ink-muted">Every scheduled dose has been handled.</p>
              </div>
            </div>
          )}

          <dl className="flex gap-6 sm:gap-8">
            <div>
              <dt className="text-xs tracking-wide text-ink-muted uppercase">Taken today</dt>
              <dd className="font-mono text-xl font-semibold tabular-nums">
                {takenToday}
                <span className="text-ink-muted">/{doses.length}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-ink-muted uppercase">7-day rate</dt>
              <dd className="font-mono text-xl font-semibold tabular-nums">
                {adherence.rate === null ? '—' : `${Math.round(adherence.rate * 100)}%`}
              </dd>
            </div>
          </dl>
        </div>
      </Panel>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">Schedule</h2>
          <Link href="/meds" className={buttonClass('ghost', 'sm')}>
            Manage medications
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <DoseList doses={views} showPerson={showPerson} />
      </section>
    </div>
  );
}
