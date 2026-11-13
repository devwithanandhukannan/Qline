import Shell from '@/components/Shell';
import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <Shell>
      <div className="stack-lg" style={{ maxWidth: 720, margin: '0 auto' }}>
        <Skeleton h={32} w={130} r={8} />
        <Skeleton h={40} r={999} />
        <div className="card stack">
          <Skeleton h={48} r={12} />
          <Skeleton h={96} r={12} />
          <Skeleton h={48} r={12} />
        </div>
      </div>
    </Shell>
  );
}

