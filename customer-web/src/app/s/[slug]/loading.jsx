import { ShopDetailSkeleton } from '@/components/Skeletons';

export default function Loading() {
  return (
    <main className="page" style={{ paddingTop: 72 }}>
      <ShopDetailSkeleton />
    </main>
  );
}

