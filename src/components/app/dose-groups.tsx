import { DoseList } from '@/components/app/dose-list';
import { Avatar, Badge } from '@/components/ui/panel';
import type { DoseView } from '@/lib/domain/views';

export type MemberGroup = {
  id: string;
  name: string;
  accent: string;
  doses: DoseView[];
};

/**
 * One block per person rather than a single mixed list — a household of three
 * on four medications each is unreadable interleaved by time alone.
 */
export function DoseGroups({ groups, emptyTitle, emptyDescription }: {
  groups: MemberGroup[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (groups.length <= 1) {
    return (
      <DoseList
        doses={groups[0]?.doses ?? []}
        showPerson={false}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const done = group.doses.filter((dose) => dose.outcome === 'taken' || dose.outcome === 'late').length;
        const owing = group.doses.filter((dose) => dose.outcome === 'overdue').length;

        return (
          <section key={group.id} className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar name={group.name} accent={group.accent} className="size-7 text-[10px]" />
              <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{group.name}</h3>
              {owing > 0 ? <Badge tone="danger">{owing} overdue</Badge> : null}
              <Badge>
                {done}/{group.doses.length}
              </Badge>
            </div>
            <DoseList doses={group.doses} showPerson={false} />
          </section>
        );
      })}
    </div>
  );
}
