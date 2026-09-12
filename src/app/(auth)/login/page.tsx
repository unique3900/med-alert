import type { Metadata } from 'next';
import Image from 'next/image';
import { LoginForm } from '@/components/app/login-form';
import { Panel } from '@/components/ui/panel';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams;
  const raw = typeof params.next === 'string' ? params.next : '/today';
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/today';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-5 py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <Image src="/icons/icon-192.png" alt="" width={60} height={60} className="rounded-[18px]" priority />
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Med Alert</h1>
          <p className="text-sm text-ink-muted">
            Medication reminders for the whole family, on every phone that matters.
          </p>
        </div>
      </div>

      <Panel className="animate-rise p-6">
        <LoginForm next={next} />
      </Panel>

      <p className="text-center text-xs text-ink-muted">
        Accounts are created by your household admin. Ask them for an invite.
      </p>
    </main>
  );
}
