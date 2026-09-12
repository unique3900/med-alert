'use client';

import { useActionState, useState } from 'react';
import { Copy, UserPlus } from 'lucide-react';
import { addMember, removeMember, setMemberRole, type FamilyState } from '@/app/actions/family';
import { Button } from '@/components/ui/button';
import { Field, FormError, FormNotice, Input, Select } from '@/components/ui/field';
import { ACCENT_OPTIONS, AccentDot, Panel, PanelHeader } from '@/components/ui/panel';
import { cn } from '@/lib/utils';

export function AddMemberForm() {
  const [state, formAction, pending] = useActionState<FamilyState, FormData>(addMember, {});
  const [accent, setAccent] = useState('sky');
  const [copied, setCopied] = useState(false);

  const credentials = state.credentials;

  async function copyCredentials() {
    if (!credentials) return;
    await navigator.clipboard.writeText(`Email: ${credentials.email}\nPassword: ${credentials.password}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Panel className="space-y-5 p-5">
      <PanelHeader title="Add a family member" description="They get their own login, phone and alarms." />

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="accent" value={accent} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="fullName">
            <Input id="fullName" name="fullName" required placeholder="Ram Parashar" />
          </Field>

          <Field label="Email" htmlFor="email">
            <Input id="email" name="email" type="email" required placeholder="father@example.com" />
          </Field>

          <Field label="Role" htmlFor="role">
            <Select id="role" name="role" defaultValue="member">
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>

          <Field label="Colour">
            <div className="flex h-11 items-center gap-2">
              {ACCENT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAccent(option)}
                  aria-label={option}
                  aria-pressed={accent === option}
                  className={cn(
                    'grid size-8 place-items-center rounded-full border-2 transition-colors',
                    accent === option ? 'border-accent' : 'border-transparent',
                  )}
                >
                  <AccentDot accent={option} className="size-4" />
                </button>
              ))}
            </div>
          </Field>
        </div>

        <FormError>{state.error}</FormError>
        <FormNotice>{state.notice}</FormNotice>

        {credentials ? (
          <div className="space-y-3 rounded-xl border border-accent/40 bg-accent-soft p-4">
            <dl className="space-y-1 font-mono text-sm">
              <div className="flex gap-2">
                <dt className="text-ink-muted">Email</dt>
                <dd>{credentials.email}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-ink-muted">Password</dt>
                <dd>{credentials.password}</dd>
              </div>
            </dl>
            <Button type="button" size="sm" variant="secondary" onClick={copyCredentials}>
              <Copy className="size-4" />
              {copied ? 'Copied' : 'Copy details'}
            </Button>
          </div>
        ) : null}

        <Button type="submit" disabled={pending}>
          <UserPlus className="size-4" />
          {pending ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </Panel>
  );
}

export function MemberActions({
  profileId,
  role,
  isSelf,
}: {
  profileId: string;
  role: 'admin' | 'member';
  isSelf: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState<FamilyState, FormData>(setMemberRole, {});
  const [removeState, removeAction, removePending] = useActionState<FamilyState, FormData>(removeMember, {});
  const [confirming, setConfirming] = useState(false);

  const error = roleState.error ?? removeState.error;

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <form action={roleAction}>
          <input type="hidden" name="profileId" value={profileId} />
          <Select
            name="role"
            defaultValue={role}
            disabled={rolePending || isSelf}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="h-9 w-28 text-xs"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </Select>
        </form>

        {isSelf ? null : confirming ? (
          <form action={removeAction} className="flex items-center gap-1.5">
            <input type="hidden" name="profileId" value={profileId} />
            <Button type="submit" size="sm" variant="danger" disabled={removePending}>
              {removePending ? 'Removing…' : 'Confirm'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </form>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Remove
          </Button>
        )}
      </div>

      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
