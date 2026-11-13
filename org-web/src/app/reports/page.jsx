'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { Button, Stars, cx, useToast } from '@/components/ui';
import { ReportsSkeleton } from '@/components/Skeletons';
import { Download } from '@/components/icons';
import { BarChart, HBars, HourBars, LineChart } from '@/components/charts';
import { api } from '@/lib/api';
import { addDaysStr, money, shortDate } from '@/lib/format';

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

function Card({ title, children, sub }) {
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

function Reports() {
  const toast = useToast();
  const [preset, setPreset] = useState('7');
  const [range, setRange] = useState(rangeFor('7'));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (r) => {
    setData(null);
    setError('');
    try {
      setData(await api(`/org/reports?from=${r.from}&to=${r.to}`));
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

  function csv() {
    const rows = [['date', 'bookings', 'served', 'no_show', 'cancelled', 'new_customers', 'walk_ins', 'revenue']];
    for (const d of data.daily) rows.push([d.date, d.total, d.served, d.noShow, d.cancelled, d.newCustomers, d.walkins, d.revenue]);
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `qline-report-${range.from}-to-${range.to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.show('Report downloaded');
  }

  const t = data?.totals;
  return (
    <div className="stack-lg">
      <div className="row between wrap enter">
        <h1>Reports</h1>
        <Button variant="secondary" size="sm" onClick={csv} disabled={!data}><Download width="16" height="16" /> CSV</Button>
      </div>

      <div className="stack-sm">
        <div className="hscroll">
          {PRESETS.map((p) => <button key={p.id} className={cx('chip', preset === p.id && 'on')} onClick={() => pick(p.id)}>{p.label}</button>)}
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

      {!data && !error && <ReportsSkeleton />}

      {data && (
        <>
          <div className="grid four enter">
            <div className="kpi stat"><b>{t.served}</b><span>Customers served</span></div>
            <div className="kpi stat"><b>{t.newCustomers}</b><span>New customers</span></div>
            <div className="kpi stat"><b>{t.returningCustomers}</b><span>Returning</span></div>
            <div className="kpi stat"><b>{t.noShowRate}%</b><span>No-show rate</span></div>
            <div className="kpi stat"><b>{money(t.revenue).replace('Free', '₹0')}</b><span>Revenue</span></div>
            <div className="kpi stat"><b>{t.avgServiceMin} min</b><span>Avg service time</span></div>
            <div className="kpi stat"><b>{t.walkins}</b><span>Walk-ins</span></div>
            <div className="kpi stat"><b>{data.ratings.count ? data.ratings.avg : '-'}</b><span>Avg rating ({data.ratings.count})</span></div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
            <Card title="Bookings per day" sub="Served vs no-show"><BarChart data={data.daily} /></Card>
            <Card title="New customers per day" sub="First time at your shop"><LineChart data={data.daily} /></Card>
            <Card title="Busiest hours" sub="When people book or join"><HourBars data={data.hourly} /></Card>
            <Card title="Top services">
              {data.topServices.length ? (
                <HBars label="Top services by visits" rows={data.topServices.map((s) => ({ name: s.name, value: s.count }))} valueLabel={(v) => `${v} visits`} />
              ) : <p className="muted small">No completed services in this range yet.</p>}
            </Card>
            <Card title="Ratings" sub={data.ratings.count ? `${data.ratings.count} review${data.ratings.count === 1 ? '' : 's'}` : undefined}>
              {data.ratings.count ? (
                <div className="stack">
                  <div className="row" style={{ gap: 10 }}><b style={{ fontSize: 34 }}>{data.ratings.avg}</b><Stars value={data.ratings.avg} size={20} /></div>
                  <HBars label="Rating distribution" rows={[5, 4, 3, 2, 1].map((s) => ({ name: `${s} star${s > 1 ? 's' : ''}`, value: data.ratings.distribution[s - 1] }))} />
                </div>
              ) : <p className="muted small">No ratings in this range yet.</p>}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Shell>
      <Reports />
    </Shell>
  );
}
