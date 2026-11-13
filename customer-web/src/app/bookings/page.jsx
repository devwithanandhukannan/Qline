'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Shell, { LoginGate } from '@/components/Shell';
import { Empty, Segmented } from '@/components/ui';
import { Ticket } from '@/components/icons';
import TicketCard from '@/components/TicketCard';
import { TicketCardSkeleton } from '@/components/Skeletons';
import { api } from '@/lib/api';

function List() {
  const [scope, setScope] = useState('active');
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);

  useEffect(() => {
    setRows(null);
    setPage(1);
    api(`/bookings/mine?scope=${scope}&page=1&limit=20`).then((r) => {
      setRows(r.bookings);
      setTotal(r.total);
    });
    if (scope !== 'active') return;
    const t = setInterval(() => document.visibilityState === 'visible' && api('/bookings/mine?scope=active&limit=20').then((r) => setRows(r.bookings)).catch(() => {}), 10000);
    return () => clearInterval(t);
  }, [scope]);

  async function loadMore() {
    setMore(true);
    const r = await api(`/bookings/mine?scope=${scope}&page=${page + 1}&limit=20`);
    setRows((x) => [...x, ...r.bookings]);
    setPage(page + 1);
    setMore(false);
  }

  return (
    <div className="stack">
      <h1 className="enter">Bookings</h1>
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
  return (
    <Shell>
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
    </Shell>
  );
}
