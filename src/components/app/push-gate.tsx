'use client';

import { useEffect, useState } from 'react';
import { BellRing, ShieldAlert } from 'lucide-react';
import { enablePush, pushState, type PushState } from '@/lib/push/client';
import { primeAlarm } from '@/lib/alarm';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COPY: Record<PushState, { title: string; body: string } | null> = {
  ready: null,
  idle: {
    title: 'Turn on dose alarms',
    body: 'Allow notifications so this phone rings when a dose is due, even with the app closed.',
  },
  denied: {
    title: 'Notifications are blocked',
    body: 'Enable notifications for this site in your browser settings, then reload.',
  },
  unsupported: {
    title: 'Alarms are unavailable here',
    body: 'This browser cannot receive push notifications. On iPhone, add Med Alert to your Home Screen first.',
  },
  unconfigured: {
    title: 'Push is not configured',
    body: 'The deployment is missing its Firebase Cloud Messaging keys.',
  },
};

export function PushGate({ deviceLabel, className }: { deviceLabel?: string; className?: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void pushState().then(async (next) => {
      if (cancelled) return;
      setState(next);
      // Keep the stored FCM token fresh whenever permission is already granted.
      if (next === 'ready') await enablePush(deviceLabel).catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [deviceLabel]);

  async function turnOn() {
    setBusy(true);
    setError(null);
    primeAlarm();

    try {
      await enablePush(deviceLabel);
      setState('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not enable alerts.');
      setState(await pushState());
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;

  const copy = COPY[state];
  if (!copy) return null;

  const blocking = state === 'denied' || state === 'unsupported' || state === 'unconfigured';

  return (
    <div
      className={cn(
        'panel flex items-start gap-3.5 p-4',
        blocking ? 'border-danger/30' : 'border-accent/40',
        className,
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-xl',
          blocking ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-accent',
        )}
      >
        {blocking ? <ShieldAlert className="size-5" /> : <BellRing className="size-5" />}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-medium">{copy.title}</p>
        <p className="text-sm text-ink-muted">{copy.body}</p>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>

      {state === 'idle' ? (
        <Button size="sm" onClick={turnOn} disabled={busy} className="shrink-0">
          {busy ? 'Enabling…' : 'Enable'}
        </Button>
      ) : null}
    </div>
  );
}
