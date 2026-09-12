'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Avatar } from '@/components/ui/panel';
import { cn } from '@/lib/utils';

export type Member = { id: string; full_name: string; accent: string };

/** Horizontal, scrollable on a phone so long names never wrap or collide. */
export function MemberTabs({ members, selected }: { members: Member[]; selected: string | null }) {
  const pathname = usePathname();
  const params = useSearchParams();

  const hrefFor = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('person', id);
    else next.delete('person');
    const query = next.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  if (members.length < 2) return null;

  return (
    <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex w-max gap-2">
        <Link
          href={hrefFor(null)}
          scroll={false}
          className={cn(
            'rounded-full border px-4 py-2 text-sm whitespace-nowrap transition-colors',
            selected === null ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-panel-soft text-ink-muted',
          )}
        >
          Everyone
        </Link>

        {members.map((member) => (
          <Link
            key={member.id}
            href={hrefFor(member.id)}
            scroll={false}
            className={cn(
              'flex items-center gap-2 rounded-full border py-1.5 pr-4 pl-1.5 text-sm whitespace-nowrap transition-colors',
              selected === member.id
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line bg-panel-soft text-ink-muted',
            )}
          >
            <Avatar name={member.full_name} accent={member.accent} className="size-7 text-[10px]" />
            {member.full_name.split(' ')[0]}
          </Link>
        ))}
      </div>
    </div>
  );
}
