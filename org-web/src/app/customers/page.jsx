'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Shell from '@/components/Shell';
import { Button, Empty, Segmented, Sheet, Stars, useToast } from '@/components/ui';
import { CustomerListSkeleton, ReviewListSkeleton } from '@/components/Skeletons';
import { Phone, Search, Star, Users } from '@/components/icons';
import { api } from '@/lib/api';
import { ago, longDate, money, shortDate } from '@/lib/format';

const LIMIT = 20;

function Customers() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async (query, p) => {
    const id = ++seq.current;
    if (p === 1) setRows(null);
    else setMore(true);
    try {
      const params = new URLSearchParams({ page: p, limit: LIMIT });
      if (query.trim()) params.set('q', query.trim());
      const r = await api(`/org/customers?${params}`);
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
    const t = setTimeout(() => load(q, 1), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  return (
    <div className="stack">
      <div style={{ position: 'relative' }}>
        <Search width="20" height="20" style={{ position: 'absolute', left: 16, top: 15, color: 'var(--fg-3)' }} />
        <input className="input" style={{ paddingLeft: 46 }} type="search" placeholder="Search name, email or phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" maxLength={60} />
      </div>
      {error && <p className="err-text">{error}</p>}
      {!rows && !error && <CustomerListSkeleton count={4} />}
      {rows && rows.length === 0 && (
        <div className="list"><Empty icon={<Users />} title={q ? 'No matches' : 'No customers yet'}>{q ? 'Try a different name or number.' : 'Customers who book through Qline will appear here.'}</Empty></div>
      )}
      {rows && rows.length > 0 && (
        <>
          <div className="section-title">{total} customer{total === 1 ? '' : 's'}</div>
          <div className="list enter">
            {rows.map((c) => (
              <button key={c.id} className="item" onClick={() => setOpen(c)}>
                <div className="token soft" style={{ width: 42, height: 42, fontSize: 16 }}>{c.name.trim()[0]?.toUpperCase()}</div>
                <div className="grow">
                  <b>{c.name}</b>
                  <div className="small muted">{c.visits} visit{c.visits === 1 ? '' : 's'} · last {shortDate(c.lastDate)}</div>
                </div>
                {c.noShows > 0 && <span className="tag warn">{c.noShows} no-show{c.noShows === 1 ? '' : 's'}</span>}
              </button>
            ))}
          </div>
          {rows.length < total && <Button variant="secondary" block loading={more} onClick={() => load(q, page + 1)}>Load more</Button>}
        </>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name || ''}>
        {open && (
          <div className="stack">
            <div className="grid three keep">
              <div className="kpi stat"><b>{open.visits}</b><span>Visits</span></div>
              <div className="kpi stat"><b>{open.noShows}</b><span>No-shows</span></div>
              <div className="kpi stat"><b>{money(open.spent).replace('Free', '₹0')}</b><span>Spent</span></div>
            </div>
            <div className="list">
              <div className="item"><span className="muted grow">First visit</span><b>{longDate(open.firstDate)}</b></div>
              <div className="item"><span className="muted grow">Last visit</span><b>{longDate(open.lastDate)}</b></div>
              <div className="item"><span className="muted grow">Email</span><b style={{ wordBreak: 'break-all' }}>{open.email || '-'}</b></div>
            </div>
            {open.phone && <a className="btn secondary block" href={`tel:${open.phone}`}><Phone width="18" height="18" /> Call {open.phone}</a>}
            {open.noShows > 0 && (
              <Button
                variant="secondary"
                block
                onClick={async () => {
                  try {
                    await api(`/org/customers/${open.id}/reset-no-shows`, { method: 'POST' });
                    setOpen((prev) => ({ ...prev, noShows: 0 }));
                    setRows((prev) => (prev || []).map((r) => r.id === open.id ? { ...r, noShows: 0 } : r));
                    toast.show(`Reset no-shows for ${open.name}`);
                  } catch (e) {
                    toast.error(e.message);
                  }
                }}
              >
                Reset No-Shows
              </Button>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Reviews() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api('/org/reviews').then((r) => setRows(r.reviews)).catch((e) => setError(e.message));
  }, []);
  if (error) return <p className="err-text">{error}</p>;
  if (!rows) return <ReviewListSkeleton count={3} />;
  if (!rows.length) return <div className="list"><Empty icon={<Star />} title="No reviews yet">Customers can rate their visit after you mark it Done.</Empty></div>;
  return (
    <div className="stack">
      {rows.map((v) => (
        <div key={v.id} className="card stack-sm enter">
          <div className="row between">
            <Stars value={v.stars} size={18} />
            <span className="small muted">{ago(v.createdAt)}</span>
          </div>
          {v.comment ? <p>{v.comment}</p> : <p className="muted small">No comment</p>}
          <div className="row small muted" style={{ gap: 8 }}>
            <span>{v.name}</span>
            {!v.isPublic && <span className="tag">Private</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Page2() {
  const [tab, setTab] = useState('customers');
  return (
    <div className="stack-lg" style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1 className="enter">Customers</h1>
      <Segmented value={tab} onChange={setTab} options={[{ value: 'customers', label: 'Customers' }, { value: 'reviews', label: 'Reviews' }]} />
      {tab === 'customers' ? <Customers /> : <Reviews />}
    </div>
  );
}

export default function Page() {
  return (
    <Shell>
      <Page2 />
    </Shell>
  );
}
