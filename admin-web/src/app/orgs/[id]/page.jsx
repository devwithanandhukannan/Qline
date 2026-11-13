'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import OrgToggleModal from '@/components/OrgToggleModal';
import { BarChart } from '@/components/charts';
import { ChevronLeft, Phone } from '@/components/icons';
import { Empty, Stars, Switch, cx } from '@/components/ui';
import { OrgDetailSkeleton } from '@/components/Skeletons';
import { api } from '@/lib/api';
import { ago, longDate, money, shortDate, time12 } from '@/lib/format';

function OrgDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toggleOpen, setToggleOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api(`/admin/orgs/${id}`));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Empty title="Could not load organization">{error}</Empty>;
  if (!data) return <OrgDetailSkeleton />;

  const { org, stats, daily, recentBookings, reviews, logs } = data;

  return (
    <div className="stack-lg">
      <div className="row between wrap enter">
        <div className="row" style={{ gap: 12 }}>
          <button className="btn icon secondary" onClick={() => router.push('/orgs')} aria-label="Back to orgs">
            <ChevronLeft width="18" height="18" />
          </button>
          <div>
            <div className="row wrap" style={{ gap: 8 }}>
              <h1>{org.name}</h1>
              <span className="tag" style={{ textTransform: 'capitalize' }}>{org.category}</span>
              <span className={cx('tag', org.isActive ? 'ok' : 'bad')}>{org.isActive ? 'Active (ON)' : 'Turned OFF'}</span>
              {!org.isListed && <span className="tag warn">Unlisted by owner</span>}
            </div>
            <p className="small muted">{[org.address, org.area, org.city].filter(Boolean).join(', ') || 'No address'} · slug: /{org.slug}</p>
          </div>
        </div>

        <div className="card row" style={{ padding: '10px 16px', gap: 12 }}>
          <div>
            <div className="small"><b>Org Status</b></div>
            <div className="tiny muted">{org.isActive ? 'Live for customers' : 'Blocked by admin'}</div>
          </div>
          <Switch checked={org.isActive} onChange={() => setToggleOpen(true)} label="Toggle organization status" />
        </div>
      </div>

      {!org.isActive && (
        <div className="card" style={{ border: '1px solid color-mix(in srgb, var(--bad) 45%, transparent)', background: 'color-mix(in srgb, var(--bad) 10%, var(--bg-2))' }}>
          <b style={{ color: 'var(--bad)' }}>Organization is Turned OFF</b>
          <p className="small muted" style={{ marginTop: 4 }}>
            Reason: {org.disabledReason || 'Disabled by administrator'} · Disabled {ago(org.disabledAt)}
          </p>
        </div>
      )}

      <div className="grid four enter">
        <div className="kpi stat"><b>{stats.uniqueCustomers}</b><span>Unique customers</span></div>
        <div className="kpi stat"><b>{stats.totalBookings}</b><span>Total bookings ({stats.served} served)</span></div>
        <div className="kpi stat"><b>{money(stats.revenue)}</b><span>Total revenue</span></div>
        <div className="kpi stat"><b>{org.rating.count ? `${org.rating.avg} ★` : '-'}</b><span>Rating ({org.rating.count} reviews)</span></div>
      </div>

      <div className="grid two">
        <section className="card stack-sm">
          <h3>Owner & Contact</h3>
          <div className="list" style={{ background: 'var(--bg)' }}>
            <div className="item"><span className="muted grow">Owner</span><b>{org.owner?.name || '-'}</b></div>
            <div className="item"><span className="muted grow">Email</span><b style={{ wordBreak: 'break-all' }}>{org.owner?.email || '-'}</b></div>
            <div className="item"><span className="muted grow">Last Login</span><b>{ago(org.owner?.lastLoginAt)}</b></div>
            <div className="item"><span className="muted grow">Created</span><b>{longDate(org.createdAt?.slice(0, 10))}</b></div>
          </div>
          {(org.phone || org.owner?.phone) && (
            <a className="btn secondary sm" style={{ width: 'fit-content' }} href={`tel:${org.phone || org.owner?.phone}`}>
              <Phone width="15" height="15" /> {org.phone || org.owner?.phone}
            </a>
          )}
        </section>

        <section className="card stack-sm">
          <h3>Services ({org.services.length}) · Staff ({org.staffCount})</h3>
          {org.services.length ? (
            <div className="list" style={{ background: 'var(--bg)' }}>
              {org.services.map((s) => (
                <div key={s.id} className="item">
                  <div className="grow">
                    <b>{s.name}</b>
                    <div className="tiny muted">{s.durationMin} min {!s.active && '· inactive'}</div>
                  </div>
                  <b className="num">{money(s.price)}</b>
                </div>
              ))}
            </div>
          ) : (
            <p className="small muted">No services added yet.</p>
          )}
        </section>
      </div>

      <section className="card stack enter">
        <div className="stack-sm" style={{ gap: 2 }}>
          <h3>30-Day Activity</h3>
          <span className="small muted">Bookings served vs no-show</span>
        </div>
        <BarChart data={daily} />
      </section>

      <div className="grid two">
        <section className="card stack-sm">
          <h3>Recent Bookings ({recentBookings.length})</h3>
          {recentBookings.length ? (
            <div className="list" style={{ background: 'var(--bg)' }}>
              {recentBookings.slice(0, 10).map((b) => (
                <div key={b.id} className="item">
                  <div className="token soft" style={{ width: 34, height: 34, fontSize: 13 }}>#{b.token}</div>
                  <div className="grow">
                    <b>{b.customerName}</b>
                    <div className="tiny muted">
                      {shortDate(b.date)} {b.slotTime ? `· ${time12(b.slotTime)}` : '· Queue'} · {b.services.join(', ')}
                    </div>
                  </div>
                  <div className="stack-sm" style={{ alignItems: 'flex-end', gap: 2 }}>
                    <span className={cx('tag', b.status === 'done' ? 'ok' : b.status === 'no_show' || b.status === 'cancelled' ? 'bad' : '')}>{b.status}</span>
                    <span className="tiny num muted">{money(b.price)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="small muted">No bookings in the last 30 days.</p>
          )}
        </section>

        <section className="card stack-sm">
          <h3>Reviews & Admin Audit History</h3>
          {logs.length > 0 && (
            <div className="list" style={{ background: 'var(--bg)' }}>
              {logs.map((l) => (
                <div key={l.id} className="item">
                  <div className="grow">
                    <b>{l.action === 'org_enable' ? 'Turned ON' : 'Turned OFF'}</b>
                    <div className="tiny muted">{l.reason || l.adminEmail}</div>
                  </div>
                  <span className="tiny muted">{ago(l.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
          {reviews.length ? (
            <div className="list" style={{ background: 'var(--bg)' }}>
              {reviews.slice(0, 5).map((r) => (
                <div key={r.id} className="item" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <div className="row between">
                      <Stars value={r.stars} size={14} />
                      <span className="tiny muted">{ago(r.createdAt)}</span>
                    </div>
                    <div className="small" style={{ marginTop: 4 }}>{r.comment || 'No comment'}</div>
                    <div className="tiny muted">{r.name} {!r.isPublic && '(Private)'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="small muted">No reviews yet.</p>
          )}
        </section>
      </div>

      <OrgToggleModal
        target={toggleOpen ? org : null}
        onClose={() => setToggleOpen(false)}
        onDone={() => load()}
      />
    </div>
  );
}

export default function OrgDetailPage() {
  return (
    <Shell>
      <OrgDetail />
    </Shell>
  );
}

