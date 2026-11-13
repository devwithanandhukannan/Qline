'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import ShopCard from '@/components/ShopCard';
import Scanner from '@/components/Scanner';
import { Button, Empty, Sheet, cx, useToast } from '@/components/ui';
import { ShopCardSkeleton } from '@/components/Skeletons';
import { Pin, Qr, Search } from '@/components/icons';
import { api } from '@/lib/api';

const CATS = [
  { v: '', l: 'All' },
  { v: 'barber', l: 'Barber' },
  { v: 'salon', l: 'Salon' },
  { v: 'cafe', l: 'Cafe' },
  { v: 'clinic', l: 'Clinic' },
];

export default function Explore() {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [geo, setGeo] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [scan, setScan] = useState(false);
  const [locating, setLocating] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const id = ++seq.current;
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (cat) p.set('category', cat);
    if (geo) {
      p.set('lat', geo.lat);
      p.set('lng', geo.lng);
    }
    try {
      const r = await api(`/shops?${p}`);
      if (id === seq.current) {
        setData(r);
        setError('');
      }
    } catch (e) {
      if (id === seq.current) setError(e.message);
    }
  }, [q, cat, geo]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // keep queue numbers fresh while the page is open
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 20000);
    return () => clearInterval(t);
  }, [load]);

  function nearMe() {
    if (geo) return setGeo(null);
    if (!navigator.geolocation) return toast.error('Location is not available on this device');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        toast.error('Allow location to sort shops by distance');
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }

  return (
    <Shell>
      <div className="stack">
        <div className="row between enter">
          <h1>Find a shop</h1>
          <Button variant="secondary" className="icon" onClick={() => setScan(true)} aria-label="Scan a shop QR code"><Qr /></Button>
        </div>

        <div className="enter" style={{ position: 'relative' }}>
          <Search width="20" height="20" style={{ position: 'absolute', left: 16, top: 15, color: 'var(--fg-3)' }} />
          <input className="input" style={{ paddingLeft: 46 }} placeholder="Shop name, area or city" value={q} onChange={(e) => setQ(e.target.value)} type="search" aria-label="Search shops" maxLength={60} />
        </div>

        <div className="chips enter">
          <button className={cx('chip', geo && 'on')} onClick={nearMe} disabled={locating}>
            <Pin width="16" height="16" /> {locating ? 'Locating…' : 'Near me'}
          </button>
          {CATS.map((c) => (
            <button key={c.v} className={cx('chip', cat === c.v && 'on')} onClick={() => setCat(c.v)}>{c.l}</button>
          ))}
        </div>

        {error && <div className="card center"><p className="muted">{error}</p><Button variant="secondary" size="sm" onClick={load} style={{ marginTop: 12 }}>Try again</Button></div>}

        {!data && !error && <ShopCardSkeleton count={3} />}

        {data && data.shops.length === 0 && (
          <Empty icon={<Search />} title="No shops found">
            {q || cat ? 'Try a different name, or clear the filters.' : 'No shops have joined yet. Ask your favourite shop to join Qline.'}
          </Empty>
        )}

        {data && (
          <div className="stack">
            {data.shops.map((s) => <ShopCard key={s.id} shop={s} />)}
          </div>
        )}
      </div>

      <Sheet open={scan} onClose={() => setScan(false)} title="Scan shop QR">
        {scan && <Scanner onSlug={(slug) => { setScan(false); router.push(`/s/${slug}`); }} />}
      </Sheet>
    </Shell>
  );
}
