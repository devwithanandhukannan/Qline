'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Shell from '@/components/Shell';
import { Button, cx, useToast } from '@/components/ui';
import { OverviewSkeleton } from '@/components/Skeletons';
import { Download, Chevron } from '@/components/icons';
import { BarChart, HBars, LineChart } from '@/components/charts';
import { api } from '@/lib/api';
import { addDaysStr, ago, money, shortDate } from '@/lib/format';

const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

const PRESETS = [
  { id: '7', label: '7 days' },
  { id: '30', label: '30 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
];

function rangeFor(id) {
  const t = todayIST();
  if (id === '7') return { from: addDaysStr(t, -6), to: t };
  if (id === '30') return { from: addDaysStr(t, -29), to: t };
  return { from: `${t.slice(0, 7)}-01`, to: t };
}

function Card({ title, sub, children }) {
  return (
    <section className="card stack enter">
      <div className="stack-sm" style={{ gap: 2 }}>
        <h3>{title}</h3>
        {sub && <span className="small muted">{sub}</span>}
      </div>
      {children}
    </section>
  );
}

function Overview() {
  const toast = useToast();
  const [preset, setPreset] = useState('30');
  const [range, setRange] = useState(rangeFor('30'));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (r) => {
    setData(null);
    setError('');
    try {
      setData(await api(`/admin/overview?from=${r.from}&to=${r.to}`));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  function pick(id) {
    setPreset(id);
    if (id !== 'custom') setRange(rangeFor(id));
  }

  function exportCsv() {
    if (!data) return;
    const rows = [['date', 'total_bookings', 'served', 'no_show', 'cancelled', 'walkins', 'new_customers', 'new_orgs', 'revenue']];
    for (const d of data.daily) {
      rows.push([d.date, d.total, d.served, d.noShow, d.cancelled, d.walkins, d.newCustomers, d.newOrgs, d.revenue]);
    }
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qline-admin-report-${data.from}-to-${data.to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.show('Platform report downloaded');
  }

  const p = data?.platform;
  const t = data?.totals;

  return (
    <div className="stack-lg">
      <div className="row between wrap enter">
        <div className="stack-sm" style={{ gap: 4 }}>
          <h1>Platform Overview</h1>
          {data && (
            <div className="row wrap" style={{ gap: 8, marginTop: 4 }}>
              <span className="pill"><span className="dot ok pulse" /> {data.live.waiting + data.live.serving} live in queues today</span>
              <span className="pill">{data.live.activeShopsToday} active org{data.live.activeShopsToday === 1 ? '' : 's'} today</span>
              {p.orgs.disabled > 0 && <span className="pill" style={{ color: 'var(--bad)' }}><span className="dot bad" /> {p.orgs.disabled} turned off</span>}
            </div>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!data}>
          <Download width="16" height="16" /> Export CSV
        </Button>
      </div>

      <div className="stack-sm">
        <div className="hscroll">
          {PRESETS.map((x) => (
            <button key={x.id} className={cx('chip', preset === x.id && 'on')} onClick={() => pick(x.id)}>{x.label}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="timepair">
            <input className="input" type="date" aria-label="From" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} />
            <span className="muted">to</span>
            <input className="input" type="date" aria-label="To" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} />
          </div>
        )}
        <span className="small muted" style={{ paddingLeft: 4 }}>{shortDate(range.from)} to {shortDate(range.to)}</span>
      </div>

      {error && <div className="card center"><p className="err-text">{error}</p></div>}

      {!data && !error && <OverviewSkeleton />}

      {data && (
        <>
          <section className="stack-sm">
            <div className="section-title">All-time platform footprint</div>
            <div className="grid four enter">
              <Link href="/orgs" className="kpi stat">
                <b>{p.orgs.total}</b>
                <span>Orgs ({p.orgs.active} on · {p.orgs.disabled} off)</span>
              </Link>
              <Link href="/customers" className="kpi stat">
                <b>{p.customers.total}</b>
                <span>Registered customers</span>
              </Link>
              <div className="kpi stat">
                <b>{p.allTime.bookings}</b>
                <span>All-time bookings ({p.allTime.served} served)</span>
              </div>
              <div className="kpi stat">
                <b>{money(p.allTime.revenue)}</b>
                <span>All-time GMV</span>
              </div>
            </div>
          </section>

          <section className="stack-sm">
            <div className="section-title">Selected period ({shortDate(data.from)} – {shortDate(data.to)})</div>
            <div className="grid four enter">
              <div className="kpi stat"><b>{t.bookings}</b><span>Bookings ({t.served} served)</span></div>
              <div className="kpi stat"><b>{t.activeCustomers}</b><span>Active customers ({t.newCustomers} new)</span></div>
              <div className="kpi stat"><b>{money(t.revenue)}</b><span>Period revenue</span></div>
              <div className="kpi stat"><b>{t.completionRate}%</b><span>Completion · {t.noShowRate}% no-show</span></div>
            </div>
          </section>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
            <Card title="Bookings per day" sub="Served vs no-show across all orgs">
              <BarChart data={data.daily} />
            </Card>
            <Card title="New customers per day" sub={`${t.newCustomers} new signups in range`}>
              <LineChart data={data.daily} keyName="newCustomers" label="New customers per day" />
            </Card>
            <Card title="New orgs per day" sub={`${t.newOrgs} new shops onboarded in range`}>
              <LineChart data={data.daily} keyName="newOrgs" label="New orgs per day" />
            </Card>
            <Card title="Categories" sub="Shops & bookings by business type">
              {data.categories.length ? (
                <HBars
                  label="Bookings by category"
                  rows={data.categories.map((c) => ({ name: c.category, value: c.bookings || c.shops, extra: c }))}
                  valueLabel={(_, r) => `${r.extra.shops} org${r.extra.shops === 1 ? '' : 's'} · ${r.extra.bookings} bookings`}
                />
              ) : (
                <p className="muted small">No category data yet.</p>
              )}
            </Card>
            <Card title="Top cities" sub="Where Qline shops are located">
              {data.cities.length ? (
                <HBars label="Top cities" rows={data.cities.map((c) => ({ name: c.city, value: c.shops }))} valueLabel={(v) => `${v} org${v === 1 ? '' : 's'}`} />
              ) : (
                <p className="muted small">No city data yet.</p>
              )}
            </Card>
            <Card title="Recent admin actions" sub="Org ON/OFF audit history">
              {data.recentLogs.length ? (
                <div className="stack-sm">
                  {data.recentLogs.slice(0, 6).map((l) => (
                    <Link key={l.id} href={`/orgs/${l.targetId}`} className="row between small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <b>{l.targetName}</b>
                        <div className="tiny muted">{l.reason || l.adminEmail}</div>
                      </div>
                      <div className="row" style={{ gap: 6, flex: 'none' }}>
                        <span className={cx('tag', l.action === 'org_enable' ? 'ok' : 'bad')}>
                          {l.action === 'org_enable' ? 'Turned ON' : 'Turned OFF'}
                        </span>
                        <span className="tiny muted">{ago(l.createdAt)}</span>
                        <Chevron width="14" height="14" className="faint" />
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="muted small">No admin status changes logged yet.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Shell>
      <Overview />
    </Shell>
  );
}

