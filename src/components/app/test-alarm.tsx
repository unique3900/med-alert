'use client';

import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Result = { ok: true; delivered: number; devices: number } | { ok: false; message: string };

export function TestAlarm({ armed }: { armed: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function send() {
    setBusy(true);
    setResult(null);

    try {
      const response = await fetch('/api/devices/test', { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      setResult(
        response.ok
          ? { ok: true, delivered: body.delivered ?? 0, devices: body.devices ?? 0 }
          : { ok: false, message: body.error ?? `Request failed (HTTP ${response.status})` },
      );
    } catch {
      setResult({ ok: false, message: 'No connection.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" onClick={send} disabled={busy || !armed}>
        <BellRing className="size-4" />
        {busy ? 'Sending…' : 'Send a test alarm'}
      </Button>

      {result?.ok ? (
        <p className="rounded-xl bg-success-soft px-3.5 py-2.5 text-sm text-success" role="status">
          {result.delivered > 0
            ? `Sent to ${result.delivered} of ${result.devices} ${result.devices === 1 ? 'device' : 'devices'}. It should appear within a few seconds.`
            : 'Accepted, but no device took it. The registration may be stale — re-arm this phone.'}
        </p>
      ) : null}

      {result && !result.ok ? (
        <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 font-mono text-xs break-words text-danger" role="alert">
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
