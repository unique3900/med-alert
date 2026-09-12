'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccentDot, Avatar, Badge, EmptyState } from '@/components/ui/panel';
import type { DoseOutcome } from '@/lib/domain/doses';
import type { DoseView } from '@/lib/domain/views';
import { humanizeMinutes } from '@/lib/time/format';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger';

const OUTCOME: Record<DoseOutcome, { label: string; tone: Tone }> = {
  upcoming: { label: 'Scheduled', tone: 'neutral' },
  overdue: { label: 'Overdue', tone: 'danger' },
  taken: { label: 'Taken', tone: 'success' },
  late: { label: 'Taken late', tone: 'warn' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  missed: { label: 'Missed', tone: 'danger' },
};

export function DoseList({
  doses,
  showPerson,
  emptyTitle = 'Nothing scheduled',
  emptyDescription = 'Doses appear here as soon as a medication has a schedule.',
}: {
  doses: DoseView[];
  showPerson: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Record<string, DoseOutcome>>({});
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);
  const [rendered, setRendered] = useState(doses);
  const [, startTransition] = useTransition();

  // Server data is the truth; drop the optimistic layer as soon as fresh data lands.
  if (doses !== rendered) {
    setRendered(doses);
    setPending({});
  }

  async function act(id: string, action: 'taken' | 'skipped') {
    setFailure(null);
    setPending((current) => ({ ...current, [id]: action }));

    const revert = () =>
      setPending((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });

    try {
      const response = await fetch(`/api/doses/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        revert();
        setFailure({ id, message: body.error ?? 'Could not update this dose.' });
        return;
      }

      startTransition(() => router.refresh());
    } catch {
      revert();
      setFailure({ id, message: 'No connection. The dose has not been recorded.' });
    }
  }

  if (doses.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ol className="space-y-2">
      {doses.map((dose) => {
        const shown = pending[dose.id] ?? dose.outcome;
        const outcome = OUTCOME[shown];
        const open = shown === 'upcoming' || shown === 'overdue';
        const settled = shown === 'taken' || shown === 'skipped';

        return (
          <li
            key={dose.id}
            className={cn(
              'panel flex flex-wrap items-center gap-3.5 p-3.5 transition-opacity',
              settled && 'opacity-65',
              shown === 'overdue' && 'border-danger/40',
            )}
          >
            <div className="flex w-14 shrink-0 flex-col items-center">
              <span className="font-mono text-base leading-none font-semibold tabular-nums">{dose.timeLabel}</span>
              <span
                className={cn(
                  'mt-1 text-[10px] tracking-wide uppercase',
                  shown === 'overdue' ? 'text-danger' : 'text-ink-muted',
                )}
              >
                {outcome.label}
              </span>
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
                {shown === 'late' ? ` · ${humanizeMinutes(dose.minutesLate)} late` : ''}
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
                  onClick={() => act(dose.id, 'taken')}
                >
                  <Check className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Skip this dose"
                  onClick={() => act(dose.id, 'skipped')}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <Badge tone={outcome.tone} className="shrink-0">
                {shown === 'taken' || shown === 'late' ? (
                  <Check className="size-3" />
                ) : (
                  <Clock className="size-3" />
                )}
                {outcome.label}
              </Badge>
            )}

            {failure?.id === dose.id ? (
              <p className="basis-full text-xs text-danger" role="alert">
                {failure.message}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
