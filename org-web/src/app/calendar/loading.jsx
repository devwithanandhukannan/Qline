import Shell from '@/components/Shell';
import { CalendarGridSkeleton } from '@/components/Skeletons';
import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <Shell>
      <div className="stack-lg">
        <div className="row between"><Skeleton h={32} w={130} r={8} /><Skeleton h={34} w={140} r={999} /></div>
        <Skeleton h={24} w={160} r={6} />
        <CalendarGridSkeleton />
      </div>
    </Shell>
  );
}

