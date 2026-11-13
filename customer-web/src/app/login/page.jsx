'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TopBar } from '@/components/Shell';
import OtpLogin from '@/components/OtpLogin';
import { PwaInstallCard } from '@/components/Pwa';
import { useAuth } from '@/lib/auth';

function Inner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { user, ready } = useAuth();
  const raw = sp.get('next') || '/explore';
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/explore'; // never redirect off-site
  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, next, router]);
  return (
    <main className="page stack" style={{ maxWidth: 420 }}>
      <div className="card enter" style={{ marginTop: 24 }}>
        <OtpLogin onDone={() => router.replace(next)} title="Welcome to Qline" />
      </div>
      <PwaInstallCard />
    </main>
  );
}

export default function Login() {
  return (
    <>
      <TopBar />
      <Suspense fallback={null}><Inner /></Suspense>
    </>
  );
}
