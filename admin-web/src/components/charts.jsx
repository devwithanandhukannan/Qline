'use client';
import { useId, useState } from 'react';

const W = 480;
const PAD = { l: 34, r: 8, t: 10, b: 24 };

function niceMax(v) {
  const raw = Math.max(4, v) / 4;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * p).find((x) => x >= raw);
  return step * 4;
}

function Axes({ max, h, ticks = 4, labels, step }) {
  const iw = W - PAD.l - PAD.r;
  const ih = h - PAD.t - PAD.b;
  return (
    <>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const y = PAD.t + ih - (ih * i) / ticks;
        return (
          <g key={i}>
            <line className="grid-line" x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} />
            <text x={PAD.l - 6} y={y + 4} textAnchor="end">{Math.round((max * i) / ticks)}</text>
          </g>
        );
      })}
      {labels.map((l, i) => (i % step === 0 ? <text key={i} x={PAD.l + (iw / labels.length) * (i + 0.5)} y={h - 6} textAnchor="middle">{l}</text> : null))}
    </>
  );
}

const dlabel = (d) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`;

export function BarChart({ data, label = 'Bookings per day' }) {
  const [hover, setHover] = useState(null);
  if (!data?.length) return null;
  const H = 200;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const max = niceMax(Math.max(1, ...data.map((d) => d.served + d.noShow)));
  const bw = Math.min(28, (iw / data.length) * 0.66);
  const sel = hover != null ? data[hover] : null;
  return (
    <figure style={{ margin: 0 }} className="stack-sm">
      <div className="legend"><span><i />Served</span><span><i className="soft" />No-show</span></div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        <Axes max={max} h={H} labels={data.map((d) => dlabel(d.date))} step={Math.max(1, Math.ceil(data.length / 8))} />
        {data.map((d, i) => {
          const x = PAD.l + (iw / data.length) * (i + 0.5) - bw / 2;
          const hs = (ih * d.served) / max;
          const hn = (ih * d.noShow) / max;
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
              <rect x={PAD.l + (iw / data.length) * i} y={PAD.t} width={iw / data.length} height={ih} fill="transparent" />
              <rect className="bar soft" x={x} y={PAD.t + ih - hs - hn} width={bw} height={hn} rx={3} opacity={hover == null || hover === i ? 1 : 0.4} />
              <rect className="bar" x={x} y={PAD.t + ih - hs} width={bw} height={hs} rx={3} opacity={hover == null || hover === i ? 1 : 0.4} />
            </g>
          );
        })}
      </svg>
      <div className="chart-tip" aria-live="polite">{sel ? `${sel.date}: ${sel.served} served, ${sel.noShow} no-show, ${sel.total} total` : 'Tap or hover a bar for details'}</div>
    </figure>
  );
}

export function LineChart({ data, keyName = 'newCustomers', label = 'New customers per day' }) {
  const [hover, setHover] = useState(null);
  const id = useId();
  if (!data?.length) return null;
  const H = 180;
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const max = niceMax(Math.max(1, ...data.map((d) => d[keyName] || 0)));
  const x = (i) => PAD.l + (data.length === 1 ? iw / 2 : (iw * i) / (data.length - 1));
  const y = (v) => PAD.t + ih - (ih * (v || 0)) / max;
  const pts = data.map((d, i) => `${x(i)},${y(d[keyName])}`);
  const area = `M${x(0)},${PAD.t + ih} L${pts.join(' L')} L${x(data.length - 1)},${PAD.t + ih} Z`;
  const sel = hover != null ? data[hover] : null;
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - PAD.l) / iw) * Math.max(1, data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  return (
    <figure style={{ margin: 0 }} className="stack-sm">
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} onMouseMove={onMove} onClick={onMove} onMouseLeave={() => setHover(null)} aria-describedby={id}>
        <Axes max={max} h={H} labels={data.map((d) => dlabel(d.date))} step={Math.max(1, Math.ceil(data.length / 8))} />
        <path className="area" d={area} />
        <polyline className="line" points={pts.join(' ')} />
        {data.length <= 40 && data.map((d, i) => <circle key={d.date} cx={x(i)} cy={y(d[keyName])} r={hover === i ? 5 : 3} fill="var(--fg)" />)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--fg-3)" strokeDasharray="3 3" />}
      </svg>
      <div className="chart-tip" id={id} aria-live="polite">{sel ? `${sel.date}: ${sel[keyName]}` : 'Tap or hover chart for details'}</div>
    </figure>
  );
}

export function HBars({ rows, label, valueLabel = (v) => v }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="stack-sm" role="img" aria-label={label}>
      {rows.map((r) => (
        <div key={r.name} className="stack-sm" style={{ gap: 4 }}>
          <div className="row between small"><span style={{ textTransform: 'capitalize' }}>{r.name}</span><b className="num">{valueLabel(r.value, r)}</b></div>
          <div className="bar-h"><i style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

