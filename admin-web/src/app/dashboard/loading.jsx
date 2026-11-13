import Shell from '@/components/Shell';
import { OverviewSkeleton } from '@/components/Skeletons';
import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <Shell>
      <div className="stack-lg">
        <div className="row between"><Skeleton h={32} w={210} r={8} /><Skeleton h={34} w={110} r={999} /></div>
        <OverviewSkeleton />
      </div>
    </Shell>
  );
}

