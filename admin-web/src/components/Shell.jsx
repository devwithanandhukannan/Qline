'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { Activity, Chart, LogOut, Settings, Store, Users } from './icons';
import { Skeleton, cx, useScrolled } from './ui';
import { OverviewSkeleton } from './Skeletons';

const TABS = [
  { href: '/dashboard', label: 'Overview', Icon: Chart },
  { href: '/orgs', label: 'Orgs', Icon: Store },
  { href: '/customers', label: 'Customers', Icon: Users },
  { href: '/activity', label: 'Activity', Icon: Activity },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export default function Shell({ children, wide = true }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const scrolled = useScrolled();

  useEffect(() => {
    if (ready && !user) router.replace('/login');
  }, [ready, user, router]);

  const loading = !ready || !user;

  return (
    <>
      <header className={cx('topbar', scrolled && 'scrolled')}>
        <div className="topbar-in">
          <Link href="/dashboard" className="brand">
            qline. <span className="muted" style={{ fontWeight: 500, fontSize: 16 }}>Admin</span>
          </Link>
          <nav className="desk-nav" aria-label="Admin navigation">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={cx('desk-link', (path === t.href || path.startsWith(`${t.href}/`)) && 'on')}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <span className="grow" />
          {user && (
            <div className="row" style={{ gap: 8 }}>
              <span className="small muted hide-sm" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
              <button
                className="btn icon secondary"
                onClick={async () => {
                  await logout();
                  router.replace('/login');
                }}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut width="17" height="17" />
              </button>
            </div>
          )}
        </div>
      </header>
      <main className={cx('page', wide && 'wide')}>
        {loading ? (
          <div className="stack-lg" style={{ paddingTop: 6 }}>
            <Skeleton h={34} w="36%" r={8} />
            <OverviewSkeleton />
          </div>
        ) : (
          children
        )}
      </main>
      <nav className="tabbar" aria-label="Admin mobile navigation">
        <div className="tabbar-in">
          {TABS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={cx('tab', (path === href || path.startsWith(`${href}/`)) && 'on')}
            >
              <Icon />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}

