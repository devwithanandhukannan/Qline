'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui';

export default function Home() {
  const { user, ready } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!ready) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [ready, user, router]);

  return (
    <main className="page" style={{ maxWidth: 440, paddingTop: 64 }}>
      <div className="stack-lg">
        <Skeleton h={28} w={140} r={8} />
        <div className="card stack">
          <Skeleton h={24} w="50%" r={6} />
          <Skeleton h={44} r={12} />
          <Skeleton h={44} r={12} />
          <Skeleton h={44} r={999} />
        </div>
      </div>
    </main>
  );
}

