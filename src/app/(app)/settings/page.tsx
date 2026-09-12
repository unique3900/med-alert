import type { Metadata } from 'next';
import { requireSession } from '@/lib/domain/session';
import { supabaseServer } from '@/lib/supabase/server';
import { formatDateShort } from '@/lib/time/format';
import { PushGate } from '@/components/app/push-gate';
import { CaregiverToggle } from '@/components/app/caregiver-toggle';
import { TestAlarm } from '@/components/app/test-alarm';
import {
  DeviceList,
  HouseholdForm,
  PasswordForm,
  ProfileForm,
  type DeviceView,
} from '@/components/app/settings-forms';
import { Panel, PanelHeader } from '@/components/ui/panel';
import type { Device } from '@/lib/db/types';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

function timeZones(current: string) {
  const supported = Intl.supportedValuesOf?.('timeZone') ?? [];
  return supported.includes(current) ? supported : [current, ...supported];
}

export default async function SettingsPage() {
  const session = await requireSession();
  const supabase = await supabaseServer();

  const { data } = await supabase
    .from('devices')
    .select('id, label, user_agent, created_at')
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .returns<Pick<Device, 'id' | 'label' | 'user_agent' | 'created_at'>[]>();

  const devices: DeviceView[] = (data ?? []).map((device) => ({
    id: device.id,
    label: device.label ?? device.user_agent?.slice(0, 60) ?? 'Unnamed device',
    addedOn: formatDateShort(device.created_at, session.timezone),
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-ink-muted">{session.email}</p>
      </header>

      <Panel className="space-y-5 p-5">
        <PanelHeader
          title="Alarms on this device"
          description="Each phone has to be armed once. Install Med Alert to the Home Screen for the loudest, most reliable alerts."
        />
        <PushGate deviceLabel={session.profile.full_name} armed={devices.length > 0} />
        <DeviceList devices={devices} />
        <TestAlarm armed={devices.length > 0} />
      </Panel>

      <CaregiverToggle enabled={session.profile.receives_all_alerts} name={session.profile.full_name} />

      <ProfileForm fullName={session.profile.full_name} accent={session.profile.accent} />

      {session.isAdmin ? (
        <HouseholdForm
          name={session.household.name}
          timezone={session.timezone}
          timezones={timeZones(session.timezone)}
        />
      ) : null}

      <PasswordForm />
    </div>
  );
}
