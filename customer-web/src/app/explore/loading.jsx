import Shell from '@/components/Shell';
import { ShopCardSkeleton } from '@/components/Skeletons';
import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <Shell>
      <div className="stack-lg">
        <div className="stack">
          <div className="row between"><Skeleton h={32} w="42%" r={8} /><Skeleton h={40} w={40} r={999} /></div>
          <Skeleton h={48} r={12} />
          <div className="row"><Skeleton h={34} w={84} r={999} /><Skeleton h={34} w={64} r={999} /><Skeleton h={34} w={74} r={999} /></div>
          <ShopCardSkeleton count={3} />
        </div>
      </div>
    </Shell>
  );
}

