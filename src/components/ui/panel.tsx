import { cn } from '@/lib/utils';
import { initials } from '@/lib/utils';

export function Panel({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('panel', className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? <p className="text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

const TONES = {
  neutral: 'bg-panel-soft text-ink-muted',
  accent: 'bg-accent-soft text-accent',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
} as const;

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.ComponentProps<'span'> & { tone?: keyof typeof TONES }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

const ACCENTS: Record<string, string> = {
  violet: 'bg-[#8b5cf6]',
  rose: 'bg-[#f43f5e]',
  amber: 'bg-[#f59e0b]',
  emerald: 'bg-[#10b981]',
  sky: 'bg-[#0ea5e9]',
  slate: 'bg-[#64748b]',
};

export const ACCENT_OPTIONS = Object.keys(ACCENTS);

export function Avatar({ name, accent = 'violet', className }: { name: string; accent?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
        ACCENTS[accent] ?? ACCENTS.violet,
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function AccentDot({ accent = 'violet', className }: { accent?: string; className?: string }) {
  return <span className={cn('size-2.5 shrink-0 rounded-full', ACCENTS[accent] ?? ACCENTS.violet, className)} aria-hidden />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-panel border border-dashed border-line px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-ink-muted">{description}</p> : null}
      {action}
    </div>
  );
}
