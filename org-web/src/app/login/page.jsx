'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OtpLogin from '@/components/OtpLogin';
import { PwaInstallCard } from '@/components/Pwa';
import { Logo } from '@/components/icons';
import { useAuth } from '@/lib/auth';

export default function Login() {
  const router = useRouter();
  const { user, ready } = useAuth();
  useEffect(() => {
    if (ready && user) router.replace('/dashboard');
  }, [ready, user, router]);
  return (
    <main className="page" style={{ maxWidth: 440, paddingTop: 64 }}>
      <div className="stack-lg">
        <Link href="/" className="brand" style={{ justifyContent: 'center' }}><Logo size={26} /> Qline <span className="muted" style={{ fontWeight: 500 }}>Business</span></Link>
        <div className="card enter" style={{ padding: 24 }}>
          <OtpLogin title="Shop sign in" subtitle="Enter your email and we will send a 6 digit code. New here? We will create your shop account." onDone={() => router.replace('/dashboard')} />
        </div>
        <PwaInstallCard />
        <p className="center muted small">Customer? <a href={process.env.NEXT_PUBLIC_CUSTOMER_URL || 'http://localhost:3000'} style={{ textDecoration: 'underline' }}>Open the customer app</a></p>
      </div>
    </main>
  );
}
