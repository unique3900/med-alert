'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlarmClock, BellOff, Check } from 'lucide-react';
import { onForegroundMessage, registerServiceWorker } from '@/lib/push/client';
import { startAlarm, stopAlarm } from '@/lib/alarm';
import { Button } from '@/components/ui/button';

type ActiveAlert = {
  doseId: string;
  medication: string;
  detail: string;
  person: string;
};

export function AlarmCenter() {
  const router = useRouter();
  const [queue, setQueue] = useState<ActiveAlert[]>([]);
  const [busy, setBusy] = useState(false);
  const current = queue[0];

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      void registerServiceWorker();
    }
  }, []);

  useEffect(() => {
    let dispose: (() => void) | undefined;

    void onForegroundMessage((payload) => {
      const data = payload.data;
      if (!data || data.kind !== 'dose-alert' || !data.doseId) return;

      setQueue((previous) =>
        previous.some((item) => item.doseId === data.doseId)
          ? previous
          : [
              ...previous,
              {
                doseId: data.doseId!,
                medication: data.medication ?? 'Medication',
                detail: data.detail ?? '',
                person: data.person ?? '',
              },
            ],
      );
    }).then((unsubscribe) => {
      dispose = unsubscribe;
    });

    return () => dispose?.();
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.kind === 'dose-alert-open') router.refresh();
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [router]);

  useEffect(() => {
    if (current) startAlarm();
    else stopAlarm();
    return () => stopAlarm();
  }, [current]);

  const resolve = useCallback(
    async (action: 'taken' | 'snooze') => {
      if (!current) return;
      setBusy(true);
      stopAlarm();

      await fetch(`/api/doses/${current.doseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).catch(() => {});

      setQueue((previous) => previous.slice(1));
      setBusy(false);
      router.refresh();
    },
    [current, router],
  );

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-surface/95 px-6 backdrop-blur-lg">
      <div className="animate-ring flex size-24 items-center justify-center rounded-full bg-accent text-accent-ink">
        <AlarmClock className="size-11" />
      </div>

      <div className="space-y-2 text-center">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">Dose due now</p>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{current.medication}</h1>
        <p className="text-sm text-ink-muted">{current.detail || current.person}</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button size="lg" disabled={busy} onClick={() => resolve('taken')} className="w-full">
          <Check className="size-5" />
          Mark as taken
        </Button>
        <Button size="lg" variant="secondary" disabled={busy} onClick={() => resolve('snooze')} className="w-full">
          <BellOff className="size-5" />
          Snooze 10 minutes
        </Button>
      </div>

      {queue.length > 1 ? (
        <p className="text-xs text-ink-muted">{queue.length - 1} more waiting</p>
      ) : null}
    </div>
  );
}
