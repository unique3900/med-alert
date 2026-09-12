'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BellRing, Check, RotateCw, ShieldAlert } from 'lucide-react';
import { enablePush, pushState, type PushState } from '@/lib/push/client';
import { primeAlarm } from '@/lib/alarm';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const COPY: Record<Exclude<PushState, 'ready'>, { title: string; body: string }> = {
  idle: {
    title: 'Turn on dose alarms',
    body: 'Allow notifications so this phone rings when a dose is due, even with the app closed.',
  },
  denied: {
    title: 'Notifications are blocked',
    body: 'This browser is refusing notifications for the site. Allow them in the browser’s site settings, then reload the page.',
  },
  unsupported: {
    title: 'Alarms are unavailable here',
    body: 'This browser cannot receive push notifications. On iPhone, add Med Alert to the Home Screen and open it from there first.',
  },
  unconfigured: {
    title: 'Push is not configured',
    body: 'The deployment is missing its Firebase Cloud Messaging keys.',
  },
};

function describe(cause: unknown) {
  if (cause instanceof Error) return cause.message;
  if (cause && typeof cause === 'object') return JSON.stringify(cause);
  return String(cause);
}

export function PushGate({
  deviceLabel,
  armed,
  scheduledDoses = 0,
  className,
}: {
  deviceLabel?: string;
  /** Whether the server already has a device registered for this account. */
  armed: boolean;
  /** Doses due for this person today, used to spell out the consequence. */
  scheduledDoses?: number;
  className?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<PushState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const register = useCallback(
    async (interactive: boolean) => {
      setBusy(true);
      setError(null);
      if (interactive) primeAlarm();

      try {
        await enablePush(deviceLabel);
        setState('ready');
        setConfirmed(true);
        router.refresh();
      } catch (cause) {
        // Never swallow this. A silent failure here means the alarms simply
        // never ring, with nothing on screen to say so.
        setError(describe(cause));
        setState(await pushState());
      } finally {
        setBusy(false);
      }
    },
    [deviceLabel, router],
  );

  useEffect(() => {
    let cancelled = false;

    void pushState().then((next) => {
      if (cancelled) return;
      setState(next);
      // Permission is granted but this account has no device row: the token was
      // never stored, or was stored against a different account. Claim it.
      if (next === 'ready' && !armed) void register(false);
    });

    return () => {
      cancelled = true;
    };
  }, [armed, register]);

  if (!state) return null;

  const settled = state === 'ready' && armed && !error;
  if (settled && !confirmed) return null;

  if (settled) {
    return (
      <div className={cn('panel flex items-center gap-3.5 border-success/40 p-4', className)}>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
          <Check className="size-5" />
        </span>
        <p className="text-sm">
          This phone is armed. Dose alarms will ring here.
        </p>
      </div>
    );
  }

  const copy = COPY[state === 'ready' ? 'idle' : state];
  const retryable = state === 'idle' || state === 'ready' || Boolean(error);
  const blocking = state === 'denied' || state === 'unsupported' || state === 'unconfigured';

  return (
    <div
      className={cn('panel flex flex-wrap items-start gap-3.5 p-4', blocking ? 'border-danger/30' : 'border-accent/40', className)}
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
        <p className="text-sm font-medium">{error ? 'Could not arm this phone' : copy.title}</p>
        <p className="text-sm text-ink-muted">{copy.body}</p>
        {!armed && scheduledDoses > 0 ? (
          <p className="text-sm text-warn">
            {scheduledDoses === 1 ? 'One dose is' : `${scheduledDoses} doses are`} scheduled for this account today
            and will not ring until a phone is armed.
          </p>
        ) : null}
      </div>

      {retryable ? (
        <Button size="sm" onClick={() => register(true)} disabled={busy} className="shrink-0">
          {busy ? (
            'Arming…'
          ) : error ? (
            <>
              <RotateCw className="size-4" />
              Try again
            </>
          ) : (
            'Enable'
          )}
        </Button>
      ) : null}

      {error ? (
        <p
          className="basis-full rounded-xl bg-danger-soft px-3.5 py-2.5 font-mono text-xs break-words text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
