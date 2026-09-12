import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { requireSession } from '@/lib/domain/session';
import { supabaseServer } from '@/lib/supabase/server';
import { dayKeyInZone } from '@/lib/time/zone';
import { MedicationForm } from '@/components/app/medication-form';
import type { Profile } from '@/lib/db/types';

export const metadata: Metadata = { title: 'New medication' };
export const dynamic = 'force-dynamic';

export default async function NewMedicationPage({ searchParams }: PageProps<'/meds/new'>) {
  const session = await requireSession();
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('full_name')
    .returns<Pick<Profile, 'id' | 'full_name'>[]>();

  const people = session.isAdmin
    ? (data ?? [])
    : (data ?? []).filter((person) => person.id === session.userId);

  // Carried over from the member filter on /meds, so "Add" while viewing one
  // person starts on that person rather than resetting to yourself.
  const params = await searchParams;
  const requested = typeof params.person === 'string' ? params.person : undefined;
  const preselected = people.some((person) => person.id === requested) ? requested! : session.userId;

  return (
    <div className="space-y-6">
      <Link href="/meds" className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ChevronLeft className="size-4" />
        Medications
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">New medication</h1>

      <MedicationForm
        canReassign={session.isAdmin}
        people={people}
        values={{
          profileId: preselected,
          name: '',
          strength: '',
          form: '',
          instructions: '',
          accent: 'violet',
          isActive: true,
          kind: 'fixed',
          times: [],
          intervalMinutes: 360,
          windowStart: '08:00',
          windowEnd: '22:00',
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          startsOn: dayKeyInZone(new Date(), session.timezone),
          endsOn: '',
        }}
      />
    </div>
  );
}
