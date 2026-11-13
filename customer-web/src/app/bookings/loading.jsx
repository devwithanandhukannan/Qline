import Shell from '@/components/Shell';
import { TicketCardSkeleton } from '@/components/Skeletons';
import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <Shell>
      <div className="stack">
        <Skeleton h={34} w="38%" r={8} />
        <Skeleton h={40} w={210} r={999} />
        <TicketCardSkeleton count={3} />
      </div>
    </Shell>
  );
}

