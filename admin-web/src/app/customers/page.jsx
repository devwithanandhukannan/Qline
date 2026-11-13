'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import { Button, Empty, Sheet } from '@/components/ui';
import { ListRowsSkeleton } from '@/components/Skeletons';
import { Phone, Search, Users } from '@/components/icons';
import { api } from '@/lib/api';
import { ago, longDate, money, shortDate } from '@/lib/format';

const LIMIT = 20;

function Customers() {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('recent');
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async (query, sortBy, p = 1) => {
    const id = ++seq.current;
    if (p === 1) setRows(null);
    else setMore(true);
    try {
      const params = new URLSearchParams({ sort: sortBy, page: p, limit: LIMIT });
      if (query.trim()) params.set('q', query.trim());
      const r = await api(`/admin/customers?${params}`);
      if (id !== seq.current) return;
      setTotal(r.total);
      setRows((prev) => (p === 1 ? r.customers : [...(prev || []), ...r.customers]));
      setPage(p);
      setError('');
    } catch (e) {
      if (id === seq.current) setError(e.message);
    } finally {
      setMore(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q, sort, 1), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, sort, load]);

  return (
    <div className="stack-lg">
      <div className="enter">
        <h1>Customers</h1>
        <p className="small muted">Platform-wide registered customers, visit activity, spend, and no-show history.</p>
      </div>

      <div className="row wrap">
        <div className="grow" style={{ position: 'relative', minWidth: 220 }}>
          <Search width="19" height="19" style={{ position: 'absolute', left: 15, top: 13, color: 'var(--fg-3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 44 }}
            type="search"
            placeholder="Search customer name, email or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={60}
          />
        </div>
        <select className="select" style={{ width: 'auto', minWidth: 165 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort customers">
          <option value="recent">Newest signups</option>
          <option value="bookings">Most bookings</option>
          <option value="noShows">Most no-shows</option>
        </select>
      </div>

      {error && <p className="err-text">{error}</p>}
      {!rows && !error && <ListRowsSkeleton count={5} />}

      {rows && rows.length === 0 && (
        <div className="list">
          <Empty icon={<Users />} title={q ? 'No matching customers' : 'No customers yet'}>
            {q ? 'Try a different name, email or phone number.' : 'Customers will appear here as they sign up.'}
          </Empty>
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="section-title">{total} customer{total === 1 ? '' : 's'}</div>
          <div className="list enter">
            {rows.map((c) => (
              <button key={c.id} className="item" onClick={() => setOpen(c)}>
                <div className="token soft">{c.name.trim()[0]?.toUpperCase() || 'C'}</div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row wrap" style={{ gap: 8 }}>
                    <b>{c.name}</b>
                    {c.noShows >= 2 && <span className="tag warn">{c.noShows} no-shows</span>}
                  </div>
                  <div className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.email} · {c.totalBookings} booking{c.totalBookings === 1 ? '' : 's'} across {c.shopsVisited} org{c.shopsVisited === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="stack-sm" style={{ alignItems: 'flex-end', gap: 2, flex: 'none' }}>
                  <b className="num small">{money(c.spent)}</b>
                  <span className="tiny muted">{c.lastBookingDate ? `last ${shortDate(c.lastBookingDate)}` : `joined ${ago(c.createdAt)}`}</span>
                </div>
              </button>
            ))}
          </div>
          {more && <ListRowsSkeleton count={2} />}
          {rows.length < total && !more && (
            <Button variant="secondary" block onClick={() => load(q, sort, page + 1)}>
              Load more
            </Button>
          )}
        </>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name || ''}>
        {open && (
          <div className="stack">
            <div className="grid three keep">
              <div className="kpi stat"><b>{open.completedVisits}</b><span>Completed</span></div>
              <div className="kpi stat"><b>{open.noShows}</b><span>No-shows</span></div>
              <div className="kpi stat"><b>{money(open.spent)}</b><span>Total spent</span></div>
            </div>
            <div className="list">
              <div className="item"><span className="muted grow">Email</span><b style={{ wordBreak: 'break-all' }}>{open.email}</b></div>
              <div className="item"><span className="muted grow">Total bookings</span><b>{open.totalBookings}</b></div>
              <div className="item"><span className="muted grow">Shops visited</span><b>{open.shopsVisited}</b></div>
              <div className="item"><span className="muted grow">Cancelled</span><b>{open.cancelledCount}</b></div>
              <div className="item"><span className="muted grow">Joined</span><b>{longDate(open.createdAt?.slice(0, 10))}</b></div>
              <div className="item"><span className="muted grow">Last login</span><b>{ago(open.lastLoginAt)}</b></div>
            </div>
            {open.phone && (
              <a className="btn secondary block" href={`tel:${open.phone}`}>
                <Phone width="17" height="17" /> Call {open.phone}
              </a>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Shell>
      <Customers />
    </Shell>
  );
}

