'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { Button, Empty, Segmented, cx } from '@/components/ui';
import { ListRowsSkeleton } from '@/components/Skeletons';
import { Activity, Shield } from '@/components/icons';
import { api } from '@/lib/api';
import { ago, money, shortDate, time12 } from '@/lib/format';

const LIMIT = 30;

function Feed() {
  const [type, setType] = useState('bookings');
  const [rows, setRows] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (tab, p = 1) => {
    if (p === 1) setRows(null);
    else setMore(true);
    try {
      const r = await api(`/admin/activity?type=${tab}&page=${p}&limit=${LIMIT}`);
      setTotal(r.total);
      setRows((prev) => (p === 1 ? r.items : [...(prev || []), ...r.items]));
      setPage(p);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setMore(false);
    }
  }, []);

  useEffect(() => {
    load(type, 1);
  }, [type, load]);

  return (
    <div className="stack-lg">
      <div className="enter">
        <h1>Platform Activity</h1>
        <p className="small muted">Real-time bookings across all organizations and admin audit logs.</p>
      </div>

      <Segmented
        value={type}
        onChange={setType}
        options={[
          { value: 'bookings', label: 'Recent bookings' },
          { value: 'logs', label: 'Admin audit log' },
        ]}
      />

      {error && <p className="err-text">{error}</p>}
      {!rows && !error && <ListRowsSkeleton count={5} />}

      {rows && rows.length === 0 && (
        <div className="list">
          <Empty icon={type === 'logs' ? <Shield /> : <Activity />} title="Nothing here yet">
            {type === 'logs' ? 'Admin ON/OFF actions will be recorded here.' : 'Bookings across shops will appear here.'}
          </Empty>
        </div>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="section-title">{total} event{total === 1 ? '' : 's'}</div>
          <div className="list enter">
            {type === 'bookings'
              ? rows.map((b) => (
                  <div key={b.id} className="item">
                    <div className="token soft" style={{ fontSize: 13 }}>#{b.token}</div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row wrap" style={{ gap: 6 }}>
                        <b>{b.customerName}</b>
                        <span className="muted">→</span>
                        {b.shop ? (
                          <Link href={`/orgs/${b.shop.id}`} style={{ textDecoration: 'underline', fontWeight: 600 }}>
                            {b.shop.name}
                          </Link>
                        ) : (
                          <span>Unknown shop</span>
                        )}
                        {b.isWalkin && <span className="tag">Walk-in</span>}
                      </div>
                      <div className="tiny muted">
                        {shortDate(b.date)} {b.slotTime ? `· ${time12(b.slotTime)}` : '· Queue'} · {b.services.join(', ')} · {ago(b.createdAt)}
                      </div>
                    </div>
                    <div className="stack-sm" style={{ alignItems: 'flex-end', gap: 2, flex: 'none' }}>
                      <span className={cx('tag', b.status === 'done' ? 'ok' : b.status === 'serving' ? 'warn' : b.status === 'no_show' || b.status === 'cancelled' ? 'bad' : '')}>
                        {b.status}
                      </span>
                      <span className="tiny num muted">{money(b.price)}</span>
                    </div>
                  </div>
                ))
              : rows.map((l) => (
                  <Link key={l.id} href={`/orgs/${l.targetId}`} className="item">
                    <div className="grow">
                      <div className="row wrap" style={{ gap: 8 }}>
                        <b>{l.targetName}</b>
                        <span className={cx('tag', l.action === 'org_enable' ? 'ok' : 'bad')}>
                          {l.action === 'org_enable' ? 'Turned ON' : 'Turned OFF'}
                        </span>
                      </div>
                      <div className="tiny muted">
                        By {l.adminEmail} {l.reason ? `· Reason: ${l.reason}` : ''}
                      </div>
                    </div>
                    <span className="tiny muted">{ago(l.createdAt)}</span>
                  </Link>
                ))}
          </div>
          {more && <ListRowsSkeleton count={2} />}
          {rows.length < total && !more && (
            <Button variant="secondary" block onClick={() => load(type, page + 1)}>
              Load more
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export default function ActivityPage() {
  return (
    <Shell>
      <Feed />
    </Shell>
  );
}

