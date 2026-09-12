import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireSession } from '@/lib/domain/session';
import { supabaseServer } from '@/lib/supabase/server';
import { describeSchedule, nextOccurrence } from '@/lib/domain/occurrences';
import { formatDateShort, formatTime } from '@/lib/time/format';
import { AccentDot, Badge, EmptyState, Panel } from '@/components/ui/panel';
import { MemberTabs } from '@/components/app/member-tabs';
import { buttonClass } from '@/components/ui/button';
import type { MedicationWithSchedules, Profile } from '@/lib/db/types';

export const metadata: Metadata = { title: 'Medications' };
export const dynamic = 'force-dynamic';

export default async function MedicationsPage({ searchParams }: PageProps<'/meds'>) {
  const session = await requireSession();
  const supabase = await supabaseServer();
  const now = new Date();

  const params = await searchParams;
  const requested = typeof params.person === 'string' ? params.person : undefined;

  const [{ data: medications }, { data: people }] = await Promise.all([
    supabase
      .from('medications')
      .select('*, schedules(*)')
      .order('is_active', { ascending: false })
      .order('name', { ascending: true })
      .returns<MedicationWithSchedules[]>(),
    supabase
      .from('profiles')
      .select('id, full_name, accent')
      .order('created_at')
      .returns<Pick<Profile, 'id' | 'full_name' | 'accent'>[]>(),
  ]);

  const members = people ?? [];
  const person = members.some((member) => member.id === requested) ? requested : undefined;
  const nameById = new Map(members.map((member) => [member.id, member.full_name]));
  const rows = (medications ?? []).filter((medication) => !person || medication.profile_id === person);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Medications</h1>
          <p className="text-sm text-ink-muted">Every course your household is on, and when it rings.</p>
        </div>
        <Link href="/meds/new" className={buttonClass('primary', 'md')}>
          <Plus className="size-4" />
          Add
        </Link>
      </header>

      <MemberTabs members={members} selected={person ?? null} />

      {rows.length === 0 ? (
        <EmptyState
          title={person ? "Nothing for this person yet" : "No medications yet"}
          description="Add the first one and Med Alert will start ringing at the times you set."
          action={
            <Link href="/meds/new" className={buttonClass('primary', 'sm')}>
              Add a medication
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((medication) => {
            const schedule = medication.schedules[0];
            const upcoming = schedule
              ? nextOccurrence(schedule, session.timezone, now)
              : null;

            return (
              <li key={medication.id}>
                <Link href={`/meds/${medication.id}`} className="block">
                  <Panel className="h-full space-y-3 p-4 transition-colors hover:border-line-strong">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <AccentDot accent={medication.accent} />
                          <p className="truncate font-medium">{medication.name}</p>
                        </div>
                        <p className="truncate text-sm text-ink-muted">
                          {[medication.strength, medication.form].filter(Boolean).join(' ') || 'No strength recorded'}
                        </p>
                      </div>
                      <Badge tone={medication.is_active ? 'accent' : 'neutral'}>
                        {medication.is_active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>

                    <div className="space-y-1 border-t border-line pt-3 text-sm">
                      <p className="text-ink-muted">
                        For <span className="text-ink">{nameById.get(medication.profile_id) ?? 'Unknown'}</span>
                      </p>
                      <p className="text-ink-muted">
                        {schedule ? describeSchedule(schedule) : 'No schedule yet'}
                      </p>
                      {upcoming ? (
                        <p className="font-mono text-xs text-accent tabular-nums">
                          Next {formatDateShort(upcoming, session.timezone)} ·{' '}
                          {formatTime(upcoming, session.timezone)}
                        </p>
                      ) : null}
                    </div>
                  </Panel>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
