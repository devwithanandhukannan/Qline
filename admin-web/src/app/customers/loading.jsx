import Shell from '@/components/Shell';
import { ListRowsSkeleton } from '@/components/Skeletons';
import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <Shell>
      <div className="stack-lg">
        <Skeleton h={32} w={160} r={8} />
        <Skeleton h={44} r={12} />
        <ListRowsSkeleton count={5} />
      </div>
    </Shell>
  );
}

