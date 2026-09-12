'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarCheck, History, LogOut, Pill, Settings, Users } from 'lucide-react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { primeAlarm } from '@/lib/alarm';
import { Avatar } from '@/components/ui/panel';
import { cn } from '@/lib/utils';

type NavItem = { href: string; label: string; short: string; icon: typeof Pill; adminOnly?: boolean };

const NAV: NavItem[] = [
  { href: '/today', label: 'Today', short: 'Today', icon: CalendarCheck },
  { href: '/meds', label: 'Medications', short: 'Meds', icon: Pill },
  { href: '/history', label: 'History', short: 'Log', icon: History },
  { href: '/family', label: 'Family', short: 'Family', icon: Users, adminOnly: true },
  { href: '/settings', label: 'Settings', short: 'Settings', icon: Settings },
];

export function AppShell({
  children,
  name,
  accent,
  householdName,
  isAdmin,
}: {
  children: React.ReactNode;
  name: string;
  accent: string;
  householdName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const items = NAV.filter((item) => !item.adminOnly || isAdmin);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <div className="min-h-dvh" onPointerDown={primeAlarm}>
      <header className="sticky top-0 z-30 border-b border-line bg-surface-veil/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-5">
          <Link href="/today" className="flex items-center gap-2.5">
            <Image src="/icons/icon-192.png" alt="" width={30} height={30} className="rounded-[9px]" />
            <span className="text-sm font-semibold tracking-tight">Med Alert</span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive(item.href) ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm leading-tight font-medium">{name}</p>
              <p className="text-xs leading-tight text-ink-muted">{householdName}</p>
            </div>
            <Avatar name={name} accent={accent} />
            <button
              onClick={signOut}
              className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-panel-soft hover:text-ink"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 pt-6 pb-28 md:pb-14">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-veil/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-5xl">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 py-3 text-[11px] transition-colors',
                  active ? 'text-accent' : 'text-ink-muted',
                )}
              >
                <Icon className={cn('size-5', active && 'drop-shadow-[0_0_10px_var(--ring)]')} />
                {item.short}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
