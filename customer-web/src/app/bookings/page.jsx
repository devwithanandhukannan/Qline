'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Shell, { LoginGate } from '@/components/Shell';
import { Empty, Segmented } from '@/components/ui';
import { Ticket } from '@/components/icons';
import TicketCard from '@/components/TicketCard';
import { TicketCardSkeleton } from '@/components/Skeletons';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function List() {
  const { user } = useAuth();
  const [scope, setScope] = useState('active');
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);

  const getGuestIds = useCallback(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('qline_guest_bookings') || '[]');
    } catch {
      return [];
    }
  }, []);

  const fetchBookings = useCallback((p = 1) => {
    const guestIds = !user ? getGuestIds() : [];
    if (!user && !guestIds.length) {
      setRows([]);
      setTotal(0);
      return Promise.resolve({ bookings: [], total: 0 });
    }
    const q = new URLSearchParams({
      scope,
      page: String(p),
      limit: '20',
      ...(!user && guestIds.length ? { ids: guestIds.join(',') } : {}),
    });
    return api(`/bookings/mine?${q.toString()}`);
  }, [user, scope, getGuestIds]);

  useEffect(() => {
    setRows(null);
    setPage(1);
    fetchBookings(1).then((r) => {
      setRows(r.bookings);
      setTotal(r.total);
    }).catch(() => {
      setRows([]);
    });

    if (scope !== 'active') return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchBookings(1).then((r) => setRows(r.bookings)).catch(() => {});
      }
    }, 10000);
    return () => clearInterval(t);
  }, [scope, fetchBookings]);

  async function loadMore() {
    setMore(true);
    const r = await fetchBookings(page + 1);
    setRows((x) => [...x, ...r.bookings]);
    setPage(page + 1);
    setMore(false);
  }

  const isGuestMode = !user && getGuestIds().length > 0;

  return (
    <div className="stack">
      <div className="row between">
        <h1 className="enter" style={{ margin: 0 }}>Bookings</h1>
        {isGuestMode && (
          <Link href="/login" className="small tag" style={{ textDecoration: 'none' }}>
            Sign in to sync
          </Link>
        )}
      </div>
      <Segmented value={scope} onChange={setScope} options={[{ value: 'active', label: 'Upcoming' }, { value: 'past', label: 'History' }]} />
      {!rows && <TicketCardSkeleton count={3} />}
      {rows && rows.length === 0 && (
        <Empty icon={<Ticket />} title={scope === 'active' ? 'Nothing booked' : 'No history yet'} action={scope === 'active' ? <Link href="/explore" className="btn">Find a shop</Link> : null}>
          {scope === 'active' ? 'Join a queue or book a slot and it will show up here.' : 'Completed visits appear here.'}
        </Empty>
      )}
      {rows && rows.length > 0 && (
        <div className="stack enter" style={{ gap: 14 }}>
          {rows.map((b) => (
            <TicketCard key={b.id} booking={b} />
          ))}
        </div>
      )}
      {more && <TicketCardSkeleton count={1} />}
      {rows && rows.length < total && !more && <button className="btn secondary block" onClick={loadMore}>Load more</button>}
    </div>
  );
}

export default function Bookings() {
  const { user, ready } = useAuth();
  const [hasGuestBookings, setHasGuestBookings] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const ids = JSON.parse(localStorage.getItem('qline_guest_bookings') || '[]');
        if (ids.length > 0) setHasGuestBookings(true);
      } catch {}
    }
  }, []);

  return (
    <Shell>
      {user || hasGuestBookings ? (
        <List />
      ) : (
        <LoginGate
          reason="Sign in to see your bookings"
          fallback={
            <div className="stack">
              <div style={{ height: 34, width: '40%' }} className="skeleton" />
              <div style={{ height: 40, width: 200, borderRadius: 999 }} className="skeleton" />
              <TicketCardSkeleton count={3} />
            </div>
          }
        >
          <List />
        </LoginGate>
      )}
    </Shell>
  );
}
