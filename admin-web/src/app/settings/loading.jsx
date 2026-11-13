import Shell from '@/components/Shell';
import { Skeleton } from '@/components/ui';

export default function Loading() {
  return (
    <Shell>
      <div className="stack-lg" style={{ maxWidth: 680, margin: '0 auto' }}>
        <Skeleton h={32} w={140} r={8} />
        <Skeleton h={76} r={18} />
        <div className="list">
          <div className="item"><Skeleton h={18} w="60%" r={6} /></div>
          <div className="item"><Skeleton h={18} w="50%" r={6} /></div>
        </div>
      </div>
    </Shell>
  );
}

