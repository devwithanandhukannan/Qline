'use client';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { PwaInstallCard } from '@/components/Pwa';
import TvAdsManager from '@/components/TvAdsManager';
import { Button } from '@/components/ui';
import { LogOut } from '@/components/icons';
import { useAuth } from '@/lib/auth';

function AdminSettings() {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function signOut() {
    await logout();
    router.replace('/login');
  }

  return (
    <div className="stack-lg" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="enter">
        <h1>Settings</h1>
        <p className="small muted">Manage Live TV video ads, administrator account, and Qline Admin PWA.</p>
      </div>

      <section className="stack-sm">
        <div className="section-title">Live TV Video Ads</div>
        <TvAdsManager />
      </section>

      <section className="stack-sm">
        <div className="section-title">Admin App (PWA)</div>
        <PwaInstallCard />
      </section>

      <section className="stack-sm">
        <div className="section-title">Account</div>
        <div className="list">
          <div className="item">
            <span className="muted grow">Name</span>
            <b>{user?.name || 'Admin'}</b>
          </div>
          <div className="item">
            <span className="muted grow">Email</span>
            <b style={{ wordBreak: 'break-all' }}>{user?.email || '-'}</b>
          </div>
          <div className="item">
            <span className="muted grow">Role</span>
            <span className="tag ok">Administrator</span>
          </div>
        </div>
      </section>

      <Button variant="danger" block onClick={signOut}>
        <LogOut width="16" height="16" /> Sign out
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Shell>
      <AdminSettings />
    </Shell>
  );
}

