import Link from 'next/link';
import { monthDayKeys, weekdayOfDayKey } from '@/lib/time/calendar';
import type { DoseOutcome } from '@/lib/domain/doses';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DOT: Record<DoseOutcome, string> = {
  taken: 'bg-success',
  late: 'bg-warn',
  missed: 'bg-danger',
  overdue: 'bg-danger',
  skipped: 'bg-line-strong',
  upcoming: 'bg-line-strong',
};

/** Monday-first column index. */
function column(dayKey: string) {
  return (weekdayOfDayKey(dayKey) + 6) % 7;
}

export type DayOutcomes = Map<string, DoseOutcome[]>;

export function MonthCalendar({
  monthKey,
  outcomes,
  selectedDay,
  todayKey,
  hrefFor,
}: {
  monthKey: string;
  outcomes: DayOutcomes;
  selectedDay: string | null;
  todayKey: string;
  hrefFor: (dayKey: string) => string;
}) {
  const days = monthDayKeys(monthKey);
  const leading = column(days[0]!);

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-[10px] font-medium tracking-wide text-ink-muted uppercase">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: leading }, (_, index) => (
          <div key={`pad-${index}`} aria-hidden />
        ))}

        {days.map((dayKey) => {
          const dayOutcomes = outcomes.get(dayKey) ?? [];
          const isSelected = dayKey === selectedDay;
          const isToday = dayKey === todayKey;
          const visible = dayOutcomes.slice(0, 4);

          return (
            <Link
              key={dayKey}
              href={hrefFor(dayKey)}
              scroll={false}
              aria-current={isSelected ? 'date' : undefined}
              className={cn(
                'flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border transition-colors',
                isSelected
                  ? 'border-accent bg-accent-soft'
                  : 'border-transparent bg-panel-soft hover:border-line-strong',
                dayOutcomes.length === 0 && 'opacity-55',
              )}
            >
              <span
                className={cn(
                  'font-mono text-sm leading-none tabular-nums',
                  isToday && 'font-bold text-accent',
                  isSelected && 'text-accent',
                )}
              >
                {Number(dayKey.slice(8))}
              </span>

              <span className="flex h-2 items-center gap-0.5">
                {visible.map((outcome, index) => (
                  <span key={index} className={cn('size-1.5 rounded-full', DOT[outcome])} aria-hidden />
                ))}
                {dayOutcomes.length > visible.length ? (
                  <span className="text-[9px] leading-none text-ink-muted">+{dayOutcomes.length - visible.length}</span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
