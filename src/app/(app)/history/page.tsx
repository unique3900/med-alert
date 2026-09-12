import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requireSession } from '@/lib/domain/session';
import { supabaseServer } from '@/lib/supabase/server';
import { dosesForMonth, doseOutcome, summarize } from '@/lib/domain/doses';
import { toDoseView } from '@/lib/domain/views';
import {
  addMonthsToKey,
  formatDayLabel,
  formatMonthLabel,
  isMonthKey,
  monthKeyInZone,
} from '@/lib/time/calendar';
import { dayKeyInZone } from '@/lib/time/zone';
import { DoseList } from '@/components/app/dose-list';
import { MonthCalendar, type DayOutcomes } from '@/components/app/month-calendar';
import { PersonFilter } from '@/components/app/person-filter';
import { Panel } from '@/components/ui/panel';
import { cn } from '@/lib/utils';
import type { Profile } from '@/lib/db/types';

export const metadata: Metadata = { title: 'History' };
export const dynamic = 'force-dynamic';

const TILES = [
  { key: 'taken', label: 'On time', tone: 'text-success' },
  { key: 'late', label: 'Late', tone: 'text-warn' },
  { key: 'missed', label: 'Missed', tone: 'text-danger' },
  { key: 'skipped', label: 'Skipped', tone: 'text-ink-muted' },
] as const;

function readParam(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined;
}

export default async function HistoryPage({ searchParams }: PageProps<'/history'>) {
  const session = await requireSession();
  const supabase = await supabaseServer();
  const params = await searchParams;
  const now = new Date();

  const todayKey = dayKeyInZone(now, session.timezone);
  const requestedMonth = readParam(params.month);
  const monthKey = requestedMonth && isMonthKey(requestedMonth) ? requestedMonth : monthKeyInZone(now, session.timezone);

  const person = readParam(params.person);

  const [doses, { data: people }] = await Promise.all([
    dosesForMonth(supabase, { timezone: session.timezone, monthKey, profileId: person }),
    supabase.from('profiles').select('id, full_name').order('full_name').returns<Pick<Profile, 'id' | 'full_name'>[]>(),
  ]);

  const summary = summarize(doses, now);

  const byDay = new Map<string, typeof doses>();
  const outcomes: DayOutcomes = new Map();

  for (const dose of doses) {
    const dayKey = dayKeyInZone(new Date(dose.due_at), session.timezone);
    byDay.set(dayKey, [...(byDay.get(dayKey) ?? []), dose]);
    outcomes.set(dayKey, [...(outcomes.get(dayKey) ?? []), doseOutcome(dose, now)]);
  }

  const requestedDay = readParam(params.day);
  const selectedDay =
    requestedDay && byDay.has(requestedDay)
      ? requestedDay
      : byDay.has(todayKey)
        ? todayKey
        : ([...byDay.keys()].sort().at(-1) ?? null);

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { month: monthKey, day: selectedDay ?? undefined, person, ...overrides };
    for (const [key, value] of Object.entries(merged)) if (value) next.set(key, value);
    return `/history?${next}`;
  };

  const showPerson = !person && (people ?? []).length > 1;
  const selectedDoses = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-ink-muted">Every dose, and whether it was taken on time, taken late or missed.</p>
      </header>

      <Panel className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Link
              href={buildHref({ month: addMonthsToKey(monthKey, -1), day: undefined })}
              scroll={false}
              aria-label="Previous month"
              className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-panel-soft hover:text-ink"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <h2 className="min-w-40 text-center text-base font-semibold">{formatMonthLabel(monthKey)}</h2>
            <Link
              href={buildHref({ month: addMonthsToKey(monthKey, 1), day: undefined })}
              scroll={false}
              aria-label="Next month"
              className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-panel-soft hover:text-ink"
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>

          <PersonFilter people={people ?? []} value={person ?? 'all'} />
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {TILES.map((tile) => (
            <div key={tile.key} className="rounded-xl bg-panel-soft px-3.5 py-3">
              <dt className="text-[10px] tracking-wide text-ink-muted uppercase">{tile.label}</dt>
              <dd className={cn('font-mono text-xl font-semibold tabular-nums', tile.tone)}>{summary[tile.key]}</dd>
            </div>
          ))}
          <div className="rounded-xl bg-accent-soft px-3.5 py-3">
            <dt className="text-[10px] tracking-wide text-accent uppercase">Adherence</dt>
            <dd className="font-mono text-xl font-semibold text-accent tabular-nums">
              {summary.adherence === null ? '—' : `${Math.round(summary.adherence * 100)}%`}
            </dd>
          </div>
        </dl>

        <MonthCalendar
          monthKey={monthKey}
          outcomes={outcomes}
          selectedDay={selectedDay}
          todayKey={todayKey}
          hrefFor={(dayKey) => buildHref({ day: dayKey })}
        />

        {summary.overdue > 0 ? (
          <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
            {summary.overdue} {summary.overdue === 1 ? 'dose is' : 'doses are'} still owed this month and will keep
            alerting until marked.
          </p>
        ) : null}
      </Panel>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
          {selectedDay ? formatDayLabel(selectedDay) : 'No activity'}
        </h2>
        <DoseList
          doses={selectedDoses.map((dose) => toDoseView(dose, session.timezone, now))}
          showPerson={showPerson}
          emptyTitle="Nothing logged this month"
          emptyDescription="Doses appear here once a medication with a schedule has come due."
        />
      </section>
    </div>
  );
}
