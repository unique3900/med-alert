'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone, Trash2 } from 'lucide-react';
import {
  changePassword,
  updateHousehold,
  updateOwnProfile,
  type FamilyState,
} from '@/app/actions/family';
import { Button } from '@/components/ui/button';
import { Field, FormError, FormNotice, Input, Select } from '@/components/ui/field';
import { ACCENT_OPTIONS, AccentDot, Panel, PanelHeader } from '@/components/ui/panel';
import { cn } from '@/lib/utils';

export function ProfileForm({ fullName, accent }: { fullName: string; accent: string }) {
  const [state, formAction, pending] = useActionState<FamilyState, FormData>(updateOwnProfile, {});
  const [selected, setSelected] = useState(accent);

  return (
    <Panel className="space-y-5 p-5">
      <PanelHeader title="Your profile" description="How you appear to the rest of the household." />

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="accent" value={selected} />

        <Field label="Full name" htmlFor="fullName">
          <Input id="fullName" name="fullName" defaultValue={fullName} required />
        </Field>

        <Field label="Colour">
          <div className="flex h-11 items-center gap-2">
            {ACCENT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSelected(option)}
                aria-label={option}
                aria-pressed={selected === option}
                className={cn(
                  'grid size-8 place-items-center rounded-full border-2 transition-colors',
                  selected === option ? 'border-accent' : 'border-transparent',
                )}
              >
                <AccentDot accent={option} className="size-4" />
              </button>
            ))}
          </div>
        </Field>

        <FormError>{state.error}</FormError>
        <FormNotice>{state.notice}</FormNotice>

        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save profile'}
        </Button>
      </form>
    </Panel>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<FamilyState, FormData>(changePassword, {});

  return (
    <Panel className="space-y-5 p-5">
      <PanelHeader title="Password" description="Change the password you use to sign in." />

      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
          <Field label="Confirm" htmlFor="confirm">
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
          </Field>
        </div>

        <FormError>{state.error}</FormError>
        <FormNotice>{state.notice}</FormNotice>

        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </Panel>
  );
}

export function HouseholdForm({
  name,
  timezone,
  timezones,
}: {
  name: string;
  timezone: string;
  timezones: string[];
}) {
  const [state, formAction, pending] = useActionState<FamilyState, FormData>(updateHousehold, {});

  return (
    <Panel className="space-y-5 p-5">
      <PanelHeader
        title="Household"
        description="Every schedule is read in this time zone, so dose times never drift."
      />

      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Household name" htmlFor="name">
            <Input id="name" name="name" defaultValue={name} required />
          </Field>

          <Field label="Time zone" htmlFor="timezone">
            <Select id="timezone" name="timezone" defaultValue={timezone}>
              {timezones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <FormError>{state.error}</FormError>
        <FormNotice>{state.notice}</FormNotice>

        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save household'}
        </Button>
      </form>
    </Panel>
  );
}

export type DeviceView = { id: string; label: string; addedOn: string };

export function DeviceList({ devices }: { devices: DeviceView[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function revoke(id: string) {
    setBusyId(id);
    await fetch(`/api/devices?id=${id}`, { method: 'DELETE' }).catch(() => {});
    setBusyId(null);
    router.refresh();
  }

  if (devices.length === 0) {
    return <p className="text-sm text-ink-muted">No phone is armed for your account yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {devices.map((device) => (
        <li key={device.id} className="flex items-center gap-3 rounded-xl bg-panel-soft px-3.5 py-3">
          <Smartphone className="size-4 shrink-0 text-ink-muted" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{device.label}</p>
            <p className="text-xs text-ink-muted">Armed {device.addedOn}</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Remove device"
            disabled={busyId === device.id}
            onClick={() => revoke(device.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
