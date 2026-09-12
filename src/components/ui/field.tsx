import { cn } from '@/lib/utils';

const CONTROL = cn(
  'w-full rounded-xl border border-line bg-panel-soft px-3.5 text-sm text-ink',
  'placeholder:text-ink-muted/70 transition-colors',
  'focus:border-accent focus:bg-panel disabled:opacity-60',
);

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('text-xs font-medium tracking-wide text-ink-muted uppercase', className)} {...props} />;
}

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(CONTROL, 'h-11', className)} {...props} />;
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'min-h-24 py-3 leading-relaxed', className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return <select className={cn(CONTROL, 'h-11 pr-9 appearance-none', className)} {...props} />;
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger" role="alert">
      {children}
    </p>
  );
}

export function FormNotice({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-xl bg-success-soft px-3.5 py-2.5 text-sm text-success" role="status">
      {children}
    </p>
  );
}
