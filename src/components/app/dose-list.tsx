'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccentDot, Avatar, Badge, EmptyState } from '@/components/ui/panel';
import type { DoseStatus } from '@/lib/db/types';
import { cn } from '@/lib/utils';

export type DoseView = {
  id: string;
  timeLabel: string;
  status: DoseStatus;
  medication: string;
  detail: string;
  instructions: string | null;
  accent: string;
  personName: string;
  personId: string;
  isPast: boolean;
};

const STATUS: Record<DoseStatus, { label: string; tone: 'neutral' | 'accent' | 'success' | 'warn' | 'danger' }> = {
  pending: { label: 'Scheduled', tone: 'neutral' },
  notified: { label: 'Alerting', tone: 'warn' },
  taken: { label: 'Taken', tone: 'success' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  missed: { label: 'Missed', tone: 'danger' },
};

export function DoseList({ doses, showPerson }: { doses: DoseView[]; showPerson: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function act(id: string, action: 'taken' | 'skipped') {
    setBusyId(id);
    await fetch(`/api/doses/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    }).catch(() => {});
    setBusyId(null);
    startTransition(() => router.refresh());
  }

  if (doses.length === 0) {
    return <EmptyState title="Nothing scheduled" description="Doses appear here as soon as a medication has a schedule." />;
  }

  return (
    <ol className="space-y-2">
      {doses.map((dose) => {
        const status = STATUS[dose.status];
        const open = dose.status === 'pending' || dose.status === 'notified' || dose.status === 'missed';

        return (
          <li
            key={dose.id}
            className={cn(
              'panel flex items-center gap-3.5 p-3.5 transition-opacity',
              dose.isPast && !open && 'opacity-65',
              dose.status === 'notified' && 'border-warn/40',
            )}
          >
            <div className="flex w-14 shrink-0 flex-col items-center">
              <span className="font-mono text-base leading-none font-semibold tabular-nums">{dose.timeLabel}</span>
              <span className="mt-1 text-[10px] tracking-wide text-ink-muted uppercase">{status.label}</span>
            </div>

            <div className="h-10 w-px bg-line" aria-hidden />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <AccentDot accent={dose.accent} />
                <p className="truncate text-sm font-medium">{dose.medication}</p>
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-muted">
                {showPerson ? `${dose.personName} · ` : ''}
                {dose.detail}
              </p>
              {dose.instructions ? (
                <p className="mt-1 truncate text-xs text-ink-muted italic">{dose.instructions}</p>
              ) : null}
            </div>

            {showPerson ? <Avatar name={dose.personName} accent={dose.accent} className="hidden sm:flex" /> : null}

            {open ? (
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant="success"
                  aria-label="Mark as taken"
                  disabled={busyId === dose.id}
                  onClick={() => act(dose.id, 'taken')}
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Skip this dose"
                  disabled={busyId === dose.id}
                  onClick={() => act(dose.id, 'skipped')}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <Badge tone={status.tone} className="shrink-0">
                {dose.status === 'taken' ? <Check className="size-3" /> : <Clock className="size-3" />}
                {status.label}
              </Badge>
            )}
          </li>
        );
      })}
    </ol>
  );
}
