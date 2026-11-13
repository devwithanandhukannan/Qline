'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo, Search, Ticket, User } from './icons';
import { Skeleton, cx, useScrolled } from './ui';
import { PwaInstallCard } from './Pwa';
import { useAuth } from '@/lib/auth';

const tabs = [
  { href: '/explore', label: 'Explore', Icon: Search },
  { href: '/bookings', label: 'Bookings', Icon: Ticket },
  { href: '/account', label: 'Account', Icon: User },
];

export function TopBar({ back, title, right }) {
  const scrolled = useScrolled();
  return (
    <header className={cx('topbar', scrolled && 'scrolled')}>
      <div className="topbar-in">
        {back ? back : (
          <Link href="/" className="brand" aria-label="Qline home">
            <Logo /> Qline
          </Link>
        )}
        <div className="grow center" style={{ fontWeight: 600 }}>{title}</div>
        <div style={{ minWidth: 40, display: 'flex', justifyContent: 'flex-end' }}>{right}</div>
      </div>
    </header>
  );
}

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-in">
        {tabs.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={cx('tab', path.startsWith(href) && 'on')} aria-current={path.startsWith(href) ? 'page' : undefined}>
            <Icon />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function Shell({ children, title, right, back, tabs: showTabs = true }) {
  return (
    <>
      <TopBar title={title} right={right} back={back} />
      <main className="page">{children}</main>
      {showTabs && <TabBar />}
    </>
  );
}

// Shows the login form in place when the page needs an account
export function LoginGate({ children, reason = 'Sign in to continue', fallback }) {
  const { user, ready } = useAuth();
  const OtpLogin = require('./OtpLogin').default;
  if (!ready) {
    return fallback || (
      <div className="stack" style={{ paddingTop: 8 }}>
        <Skeleton h={32} w="42%" r={8} />
        <Skeleton h={110} r={18} />
        <Skeleton h={110} r={18} />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="stack enter" style={{ marginTop: 16 }}>
        <div className="card">
          <OtpLogin title={reason} subtitle="Enter your email and we will send you a 6 digit code. No password needed." />
        </div>
        <PwaInstallCard />
      </div>
    );
  }
  return children;
}
