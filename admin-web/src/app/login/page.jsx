'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PasswordLogin from '@/components/PasswordLogin';
import { PwaInstallCard } from '@/components/Pwa';
import { Shield } from '@/components/icons';
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
        <Link href="/" className="brand" style={{ justifyContent: 'center' }}>
          <Shield width="22" height="22" /> qline. <span className="muted" style={{ fontWeight: 500, fontSize: 16 }}>Admin</span>
        </Link>
        <div className="card enter" style={{ padding: 24 }}>
          <PasswordLogin
            title="Platform Admin"
            subtitle="Sign in with your seeded administrator email and password."
            onDone={() => router.replace('/dashboard')}
          />
        </div>
        <PwaInstallCard />
      </div>
    </main>
  );
}

