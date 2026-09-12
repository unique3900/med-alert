import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { requireSession } from '@/lib/domain/session';
import { supabaseServer } from '@/lib/supabase/server';
import { dayKeyInZone } from '@/lib/time/zone';
import { MedicationForm } from '@/components/app/medication-form';
import { DeleteMedication } from '@/components/app/delete-medication';
import { Panel } from '@/components/ui/panel';
import type { MedicationWithSchedules, Profile } from '@/lib/db/types';

export const metadata: Metadata = { title: 'Edit medication' };
export const dynamic = 'force-dynamic';

export default async function EditMedicationPage({ params }: PageProps<'/meds/[id]'>) {
  const { id } = await params;
  const session = await requireSession();
  const supabase = await supabaseServer();

  const [{ data: medication }, { data: profiles }] = await Promise.all([
    supabase.from('medications').select('*, schedules(*)').eq('id', id).maybeSingle<MedicationWithSchedules>(),
    supabase.from('profiles').select('id, full_name').order('full_name').returns<Pick<Profile, 'id' | 'full_name'>[]>(),
  ]);

  if (!medication) notFound();

  const editable = session.isAdmin || medication.profile_id === session.userId;
  if (!editable) notFound();

  const schedule = medication.schedules[0];
  const people = session.isAdmin ? (profiles ?? []) : (profiles ?? []).filter((p) => p.id === session.userId);

  return (
    <div className="space-y-6">
      <Link href="/meds" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" />
        Medications
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">{medication.name}</h1>

      <MedicationForm
        canReassign={session.isAdmin}
        people={people}
        values={{
          id: medication.id,
          profileId: medication.profile_id,
          name: medication.name,
          strength: medication.strength ?? '',
          form: medication.form ?? '',
          instructions: medication.instructions ?? '',
          accent: medication.accent,
          isActive: medication.is_active,
          kind: schedule?.kind ?? 'fixed',
          times: (schedule?.times ?? []).map((time) => time.slice(0, 5)),
          intervalMinutes: schedule?.interval_minutes ?? 360,
          windowStart: (schedule?.window_start ?? '08:00').slice(0, 5),
          windowEnd: (schedule?.window_end ?? '22:00').slice(0, 5),
          daysOfWeek: schedule?.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
          startsOn: schedule?.starts_on ?? dayKeyInZone(new Date(), session.timezone),
          endsOn: schedule?.ends_on ?? '',
        }}
      />

      <Panel className="border-danger/25 p-5">
        <DeleteMedication id={medication.id} name={medication.name} />
      </Panel>
    </div>
  );
}
