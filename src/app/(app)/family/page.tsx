import type { Metadata } from 'next';
import { BellOff, BellRing } from 'lucide-react';
import { requireAdmin } from '@/lib/domain/session';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AddMemberForm, MemberActions } from '@/components/app/member-admin';
import { Avatar, Badge, Panel } from '@/components/ui/panel';
import type { Profile } from '@/lib/db/types';

export const metadata: Metadata = { title: 'Family' };
export const dynamic = 'force-dynamic';

export default async function FamilyPage() {
  const session = await requireAdmin();
  const admin = supabaseAdmin();

  const [{ data: members }, { data: devices }, { data: medications }, { data: accounts }] = await Promise.all([
    admin
      .from('profiles')
      .select('*')
      .eq('household_id', session.household.id)
      .order('created_at')
      .returns<Profile[]>(),
    admin
      .from('devices')
      .select('profile_id')
      .is('revoked_at', null)
      .returns<{ profile_id: string }[]>(),
    admin
      .from('medications')
      .select('profile_id')
      .eq('household_id', session.household.id)
      .eq('is_active', true)
      .returns<{ profile_id: string }[]>(),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);

  const emailById = new Map((accounts?.users ?? []).map((user) => [user.id, user.email ?? '']));

  const count = (rows: { profile_id: string }[] | null, id: string) =>
    (rows ?? []).filter((row) => row.profile_id === id).length;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Family</h1>
        <p className="text-sm text-ink-muted">
          Everyone in {session.household.name}. Each person signs in on their own phone so alarms reach them.
        </p>
      </header>

      <ul className="space-y-2">
        {(members ?? []).map((member) => {
          const phones = count(devices, member.id);
          const isSelf = member.id === session.userId;

          return (
            <li key={member.id}>
              <Panel className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={member.full_name} accent={member.accent} className="size-11" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="min-w-0 truncate font-medium">{member.full_name}</p>
                      {member.role === 'admin' ? <Badge tone="accent">Admin</Badge> : null}
                      {member.receives_all_alerts ? <Badge tone="success">Feeder</Badge> : null}
                      {isSelf ? <Badge>You</Badge> : null}
                    </div>

                    <p className="mt-1 truncate text-xs text-ink-muted">{emailById.get(member.id)}</p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                      <span className="inline-flex items-center gap-1.5">
                        {phones > 0 ? (
                          <>
                            <BellRing className="size-3.5 shrink-0 text-success" />
                            {phones} {phones === 1 ? 'device' : 'devices'} armed
                          </>
                        ) : (
                          <>
                            <BellOff className="size-3.5 shrink-0 text-warn" />
                            No device yet
                          </>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        {count(medications, member.id)} active meds
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 border-t border-line pt-3">
                  <MemberActions
                    profileId={member.id}
                    role={member.role}
                    isSelf={isSelf}
                    receivesAllAlerts={member.receives_all_alerts}
                  />
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>

      <AddMemberForm />
    </div>
  );
}
