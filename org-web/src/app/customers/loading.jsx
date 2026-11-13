import Shell from '@/components/Shell';
import { CustomerListSkeleton } from '@/components/Skeletons';
import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <Shell>
      <div className="stack-lg" style={{ maxWidth: 720, margin: '0 auto' }}>
        <Skeleton h={32} w={150} r={8} />
        <Skeleton h={40} w={210} r={999} />
        <Skeleton h={48} r={12} />
        <CustomerListSkeleton count={4} />
      </div>
    </Shell>
  );
}

