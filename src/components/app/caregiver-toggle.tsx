'use client';

import { useActionState } from 'react';
import { HeartHandshake } from 'lucide-react';
import { setCaregiver, type FamilyState } from '@/app/actions/family';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { FormError, FormNotice } from '@/components/ui/field';

export function CaregiverToggle({ enabled, name }: { enabled: boolean; name: string }) {
  const [state, formAction, pending] = useActionState<FamilyState, FormData>(setCaregiver, {});

  return (
    <Panel className="space-y-5 p-5">
      <PanelHeader
        title="Alerts for the whole household"
        description="Turn this on for whoever actually hands out the medication."
      />

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="enabled" value={enabled ? 'off' : 'on'} />

        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-panel-soft px-3.5 py-3">
          <HeartHandshake className={enabled ? 'size-5 text-accent' : 'size-5 text-ink-muted'} />
          <p className="min-w-0 flex-1 text-sm">
            {enabled
              ? `${name} is alerted for every member's doses and can mark them taken.`
              : `${name} is only alerted for their own doses.`}
          </p>
          <Button type="submit" size="sm" variant={enabled ? 'secondary' : 'primary'} disabled={pending}>
            {pending ? 'Saving…' : enabled ? 'Turn off' : 'Alert me for everyone'}
          </Button>
        </div>

        <FormError>{state.error}</FormError>
        <FormNotice>{state.notice}</FormNotice>
      </form>
    </Panel>
  );
}
