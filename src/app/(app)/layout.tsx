import { requireSession } from '@/lib/domain/session';
import { AppShell } from '@/components/app/app-shell';
import { AlarmCenter } from '@/components/app/alarm-center';

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const session = await requireSession();

  return (
    <AppShell
      name={session.profile.full_name}
      accent={session.profile.accent}
      householdName={session.household.name}
      isAdmin={session.isAdmin}
    >
      {children}
      <AlarmCenter />
    </AppShell>
  );
}
