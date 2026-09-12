'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/field';

export function PersonFilter({ people, value }: { people: { id: string; full_name: string }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function change(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('person');
    else params.set('person', next);
    router.push(`${pathname}?${params}`, { scroll: false });
  }

  return (
    <Select
      value={value}
      onChange={(event) => change(event.target.value)}
      aria-label="Filter by person"
      className="h-10 w-auto text-sm"
    >
      <option value="all">Everyone</option>
      {people.map((person) => (
        <option key={person.id} value={person.id}>
          {person.full_name}
        </option>
      ))}
    </Select>
  );
}
