'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Logo, Home, Calendar, Chart, Users, Settings } from './icons';
import { cx, useScrolled } from './ui';
import { DashboardSkeleton } from './Skeletons';

const ShopCtx = createContext(null);
export const useShop = () => useContext(ShopCtx);

const TABS = [
  { href: '/dashboard', label: 'Today', Icon: Home },
  { href: '/calendar', label: 'Calendar', Icon: Calendar },
  { href: '/reports', label: 'Reports', Icon: Chart },
  { href: '/customers', label: 'Customers', Icon: Users },
  { href: '/settings', label: 'Settings', Icon: Settings },
];

export default function Shell({ children, wide = true, noShop = false }) {
  const { user, ready } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const scrolled = useScrolled();
  const [shop, setShop] = useState(undefined);

  const reload = useCallback(async () => {
    const r = await api('/org/shop');
    setShop(r.shop);
    return r.shop;
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    reload()
      .then((s) => {
        if (!s && !noShop) router.replace('/onboarding');
      })
      .catch(() => setShop(null));
  }, [ready, user, router, reload, noShop]);

  const loading = !ready || !user || shop === undefined || (!shop && !noShop);

  return (
    <ShopCtx.Provider value={{ shop, setShop, reload }}>
      <header className={cx('topbar no-print', scrolled && 'scrolled')}>
        <div className="topbar-in">
          <Link href={user ? '/dashboard' : '/'} className="brand">
            <Logo /> Qline <span className="muted" style={{ fontWeight: 500 }}>Business</span>
          </Link>
          <nav className="desk-nav" aria-label="Main">
            {!noShop &&
              TABS.map((t) => (
                <Link key={t.href} href={t.href} className={cx('desk-link', path === t.href && 'on')}>{t.label}</Link>
              ))}
          </nav>
          <span className="grow" />
          {shop && <span className="small muted shop-name">{shop.name}</span>}
        </div>
      </header>
      <main className={cx('page', wide && 'wide')}>
        {loading ? <DashboardSkeleton /> : children}
      </main>
      {!noShop && (
        <nav className="tabbar no-print" aria-label="Main">
          <div className="tabbar-in">
            {TABS.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className={cx('tab', path === href && 'on')}>
                <Icon />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </ShopCtx.Provider>
  );
}
