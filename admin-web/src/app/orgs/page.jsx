'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import OrgToggleModal from '@/components/OrgToggleModal';
import { Button, Empty, Segmented, Switch, cx } from '@/components/ui';
import { OrgsListSkeleton } from '@/components/Skeletons';
import { Chevron, Search, Store } from '@/components/icons';
import { api } from '@/lib/api';
import { ago, money, shortDate } from '@/lib/format';

const LIMIT = 20;

function Orgs() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('bookings');
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [toggleTarget, setToggleTarget] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async (opts, p = 1) => {
    const id = ++seq.current;
    if (p === 1) setRows(null);
    else setMore(true);
    try {
      const params = new URLSearchParams({
        status: opts.status,
        sort: opts.sort,
        page: p,
        limit: LIMIT,
      });
      if (opts.q.trim()) params.set('q', opts.q.trim());
      if (opts.category) params.set('category', opts.category);
      const r = await api(`/admin/orgs?${params}`);
      if (id !== seq.current) return;
      setTotal(r.total);
      setRows((prev) => (p === 1 ? r.orgs : [...(prev || []), ...r.orgs]));
      setPage(p);
      setError('');
    } catch (e) {
      if (id === seq.current) setError(e.message);
    } finally {
      setMore(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load({ q, status, category, sort }, 1), q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, status, category, sort, load]);

  return (
    <div className="stack-lg">
      <div className="row between wrap enter">
        <div>
          <h1>Organizations</h1>
          <p className="small muted">Monitor every registered shop, customer volume, and turn orgs ON or OFF.</p>
        </div>
      </div>

      <div className="stack-sm">
        <div className="row wrap">
          <div className="grow" style={{ position: 'relative', minWidth: 220 }}>
            <Search width="19" height="19" style={{ position: 'absolute', left: 15, top: 13, color: 'var(--fg-3)' }} />
            <input
              className="input"
              style={{ paddingLeft: 44 }}
              type="search"
              placeholder="Search shop name, city, owner name or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={60}
            />
          </div>
          <select className="select mob-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category filter">
            <option value="">All types</option>
            <option value="barber">Barber</option>
            <option value="salon">Salon</option>
            <option value="cafe">Cafe</option>
            <option value="clinic">Clinic</option>
            <option value="other">Other</option>
          </select>
          <select className="select mob-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort order">
            <option value="bookings">Most bookings</option>
            <option value="recent">Newest first</option>
            <option value="name">Name (A-Z)</option>
          </select>
        </div>

        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All orgs' },
            { value: 'active', label: 'Active (ON)' },
            { value: 'disabled', label: 'Turned OFF' },
          ]}
        />
      </div>

      {error && <p className="err-text">{error}</p>}
      {!rows && !error && <OrgsListSkeleton count={3} />}

      {rows && rows.length === 0 && (
        <div className="list">
          <Empty icon={<Store />} title="No organizations found">Try clearing your search or status filter.</Empty>
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="section-title">{total} organization{total === 1 ? '' : 's'}</div>
          <div className="stack">
            {rows.map((o) => (
              <div key={o.id} className="card stack-sm enter" style={!o.isActive ? { border: '1px solid color-mix(in srgb, var(--bad) 35%, transparent)' } : undefined}>
                <div className="row between wrap">
                  <Link href={`/orgs/${o.id}`} className="grow row" style={{ gap: 12, minWidth: 200 }}>
                    <div className={cx('token', !o.isActive && 'soft')}>
                      {o.name.trim()[0]?.toUpperCase() || 'S'}
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row wrap" style={{ gap: 8 }}>
                        <b style={{ fontSize: 17 }}>{o.name}</b>
                        <span className="tag" style={{ textTransform: 'capitalize' }}>{o.category}</span>
                        {o.isActive ? <span className="tag ok">ON</span> : <span className="tag bad">OFF</span>}
                        {!o.isListed && <span className="tag warn">Unlisted by owner</span>}
                      </div>
                      <div className="small muted" style={{ marginTop: 2 }}>
                        {[o.area, o.city].filter(Boolean).join(', ') || 'No location'} · Owner: {o.owner?.name || '-'} ({o.owner?.email || '-'})
                      </div>
                    </div>
                  </Link>

                  <div className="org-actions">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="tiny muted">{o.isActive ? 'Enabled' : 'Disabled'}</span>
                      <Switch
                        checked={o.isActive}
                        onChange={() => setToggleTarget(o)}
                        label={`Toggle ${o.name} status`}
                      />
                    </div>
                    <Link href={`/orgs/${o.id}`} className="btn secondary sm">
                      Details <Chevron width="14" height="14" />
                    </Link>
                  </div>
                </div>

                {!o.isActive && o.disabledReason && (
                  <div className="tiny" style={{ color: 'var(--bad)' }}>Reason: {o.disabledReason}</div>
                )}

                <div className="grid four" style={{ gap: 8, marginTop: 4 }}>
                  <div className="kpi" style={{ padding: '10px 12px', background: 'var(--bg)' }}>
                    <div className="tiny muted">Unique Customers</div>
                    <b className="num" style={{ fontSize: 18 }}>{o.stats.uniqueCustomers}</b>
                  </div>
                  <div className="kpi" style={{ padding: '10px 12px', background: 'var(--bg)' }}>
                    <div className="tiny muted">Total Bookings</div>
                    <b className="num" style={{ fontSize: 18 }}>{o.stats.totalBookings}</b>
                    <span className="tiny muted"> ({o.stats.todayBookings} today)</span>
                  </div>
                  <div className="kpi" style={{ padding: '10px 12px', background: 'var(--bg)' }}>
                    <div className="tiny muted">Revenue</div>
                    <b className="num" style={{ fontSize: 18 }}>{money(o.stats.revenue)}</b>
                  </div>
                  <div className="kpi" style={{ padding: '10px 12px', background: 'var(--bg)' }}>
                    <div className="tiny muted">Last Booking / Login</div>
                    <div className="small"><b>{o.stats.lastBookingDate ? shortDate(o.stats.lastBookingDate) : 'None'}</b> · <span className="muted">{ago(o.owner?.lastLoginAt)}</span></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {more && <OrgsListSkeleton count={1} />}
          {rows.length < total && !more && (
            <Button variant="secondary" block onClick={() => load({ q, status, category, sort }, page + 1)}>
              Load more
            </Button>
          )}
        </>
      )}

      <OrgToggleModal
        target={toggleTarget}
        onClose={() => setToggleTarget(null)}
        onDone={(res) => {
          setRows((prev) =>
            (prev || []).map((item) =>
              item.id === res.org.id
                ? { ...item, isActive: res.org.isActive, disabledReason: res.org.disabledReason, disabledAt: res.org.disabledAt }
                : item
            )
          );
        }}
      />
    </div>
  );
}

export default function OrgsPage() {
  return (
    <Shell>
      <Orgs />
    </Shell>
  );
}

