import Shell from '@/components/Shell';
import { OrgsListSkeleton } from '@/components/Skeletons';
import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <Shell>
      <div className="stack-lg">
        <Skeleton h={32} w={180} r={8} />
        <Skeleton h={44} r={12} />
        <OrgsListSkeleton count={3} />
      </div>
    </Shell>
  );
}

