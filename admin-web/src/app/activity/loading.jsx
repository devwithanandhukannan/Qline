import Shell from '@/components/Shell';
import { ListRowsSkeleton } from '@/components/Skeletons';
import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <Shell>
      <div className="stack-lg">
        <Skeleton h={32} w={200} r={8} />
        <Skeleton h={40} w={240} r={999} />
        <ListRowsSkeleton count={5} />
      </div>
    </Shell>
  );
}

