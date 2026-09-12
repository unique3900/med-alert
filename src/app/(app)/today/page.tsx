import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, CircleCheckBig } from 'lucide-react';
import { requireSession } from '@/lib/domain/session';
import { supabaseServer } from '@/lib/supabase/server';
import { dosesForDay, doseOutcome, outstandingBefore, recentAdherence, summarize } from '@/lib/domain/doses';
import { toDoseView } from '@/lib/domain/views';
import { formatDayLong, formatTime } from '@/lib/time/format';
import { PushGate } from '@/components/app/push-gate';
import { Countdown } from '@/components/app/next-dose';
import { DoseList } from '@/components/app/dose-list';
import { DoseGroups, type MemberGroup } from '@/components/app/dose-groups';
import { MemberTabs } from '@/components/app/member-tabs';
import { Panel } from '@/components/ui/panel';
import { buttonClass } from '@/components/ui/button';
import type { DoseWithMedication, Profile } from '@/lib/db/types';

export const metadata: Metadata = { title: 'Today' };
export const dynamic = 'force-dynamic';

type Member = Pick<Profile, 'id' | 'full_name' | 'accent'>;

function groupByMember(doses: DoseWithMedication[], members: Member[], timezone: string, now: Date): MemberGroup[] {
  const order = new Map(members.map((member, index) => [member.id, index]));

  const groups = new Map<string, MemberGroup>();
  for (const dose of doses) {
    const id = dose.profiles.id;
    const group = groups.get(id) ?? {
      id,
      name: dose.profiles.full_name,
      accent: dose.profiles.accent,
      doses: [],
    };
    group.doses.push(toDoseView(dose, timezone, now));
    groups.set(id, group);
  }

  return [...groups.values()].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
}

export default async function TodayPage({ searchParams }: PageProps<'/today'>) {
  const session = await requireSession();
  const supabase = await supabaseServer();
  const now = new Date();

  const params = await searchParams;
  const requested = typeof params.person === 'string' ? params.person : undefined;

  const [allDoses, owed, adherence, { data: members }, { count: deviceCount }] = await Promise.all([
    dosesForDay(supabase, { timezone: session.timezone, reference: now }),
    outstandingBefore(supabase, { timezone: session.timezone, reference: now }),
    recentAdherence(supabase, { days: 7 }),
    supabase.from('profiles').select('id, full_name, accent').order('created_at').returns<Member[]>(),
    supabase.from('devices').select('id', { count: 'exact', head: true }).is('revoked_at', null),
  ]);

  const people = members ?? [];
  const person = people.some((member) => member.id === requested) ? requested : undefined;

  const doses = person ? allDoses.filter((dose) => dose.profiles.id === person) : allDoses;
  const owedShown = person ? owed.filter((dose) => dose.profiles.id === person) : owed;

  const today = summarize(doses, now);
  const upcoming = doses.find((dose) => doseOutcome(dose, now) === 'upcoming');
  const consumed = today.taken + today.late;

  const multiple = people.length > 1;
  const ownDoses = allDoses.filter((dose) => dose.profile_id === session.userId).length;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-ink-muted">{formatDayLong(now, session.timezone)}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hello, {session.profile.full_name.split(' ')[0]}
        </h1>
      </header>

      <PushGate
        deviceLabel={session.profile.full_name}
        armed={(deviceCount ?? 0) > 0}
        scheduledDoses={session.profile.receives_all_alerts ? allDoses.length : ownDoses}
      />

      <MemberTabs members={people} selected={person ?? null} />

      {owedShown.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-danger">
            <AlertTriangle className="size-4" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">Still owed from earlier</h2>
          </div>
          <p className="text-sm text-ink-muted">
            These keep alerting until they are marked. Mark one as taken even if it is late — the log records how late.
          </p>
          <DoseList
            doses={owedShown.map((dose) => toDoseView(dose, session.timezone, now))}
            showPerson={multiple && !person}
          />
        </section>
      ) : null}

      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          {upcoming ? (
            <div className="min-w-0 space-y-1.5">
              <p className="text-xs font-medium tracking-wide text-accent uppercase">Next dose</p>
              <p className="truncate text-2xl font-semibold tracking-tight">
                {upcoming.medications.name}
                <span className="ml-2 font-mono text-lg text-ink-muted tabular-nums">
                  {formatTime(upcoming.due_at, session.timezone)}
                </span>
              </p>
              <p className="truncate text-sm text-ink-muted">
                {multiple ? `${upcoming.profiles.full_name} · ` : ''}
                <Countdown dueAt={upcoming.due_at} />
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <CircleCheckBig className="size-8 shrink-0 text-success" />
              <div className="min-w-0">
                <p className="text-lg font-semibold tracking-tight">Nothing left today</p>
                <p className="text-sm text-ink-muted">Every scheduled dose has been handled.</p>
              </div>
            </div>
          )}

          <dl className="flex shrink-0 gap-6 sm:gap-8">
            <div>
              <dt className="text-xs tracking-wide text-ink-muted uppercase">Taken today</dt>
              <dd className="font-mono text-xl font-semibold tabular-nums">
                {consumed}
                <span className="text-ink-muted">/{today.total}</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs tracking-wide text-ink-muted uppercase">7-day rate</dt>
              <dd className="font-mono text-xl font-semibold tabular-nums">
                {adherence.adherence === null ? '—' : `${Math.round(adherence.adherence * 100)}%`}
              </dd>
            </div>
          </dl>
        </div>
      </Panel>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">Schedule</h2>
          <Link href="/meds" className={buttonClass('ghost', 'sm')}>
            Manage
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <DoseGroups
          groups={groupByMember(doses, people, session.timezone, now)}
          emptyTitle="Nothing scheduled"
          emptyDescription="Doses appear here as soon as a medication has a schedule."
        />
      </section>
    </div>
  );
}
