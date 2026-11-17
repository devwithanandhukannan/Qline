'use client';
import Link from 'next/link';
import { Coffee, Pin, Scissors, Shield, Store } from './icons';
import { Stars } from './ui';
import { mins, time12 } from '@/lib/format';

export const categoryIcon = (c) => {
  if (c === 'cafe') return Coffee;
  if (c === 'clinic') return Shield;
  if (c === 'other') return Store;
  return Scissors;
};

export function statusLine(shop) {
  const t = shop.today;
  if (t.state === 'open') {
    if (shop.queue?.paused) return { tone: 'warn', text: 'Queue paused' };
    if (shop.queue && shop.settings.acceptQueue) {
      return { tone: 'ok', text: shop.queue.ahead === 0 ? 'No wait right now' : `${shop.queue.ahead} waiting · about ${mins(shop.queue.waitMin)}` };
    }
    return { tone: 'ok', text: `Open until ${time12(t.closesAt)}` };
  }
  if (t.state === 'later') return { tone: 'warn', text: `Opens ${time12(t.opensAt)}` };
  return { tone: 'bad', text: t.note || 'Closed today' };
}

export default function ShopCard({ shop }) {
  const Icon = categoryIcon(shop.category);
  const s = statusLine(shop);
  return (
    <Link href={`/s/${shop.slug}`} className="card tap enter" style={{ display: 'block' }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div
          className="feature"
          style={{
            padding: 0,
            width: 48,
            height: 48,
            borderRadius: 'var(--r)',
            background: 'var(--inv-bg)',
            color: 'var(--inv-fg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
            overflow: 'hidden',
          }}
        >
          {shop.images && shop.images.length > 0 ? (
            <img src={shop.images[0]} alt={shop.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Icon width="22" height="22" />
          )}
        </div>
        <div className="grow stack-sm" style={{ gap: 4 }}>
          <div className="row between" style={{ alignItems: 'flex-start' }}>
            <h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600, fontSize: 17, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{shop.name}</h3>
            {shop.distanceKm != null && <span className="small muted num" style={{ flex: 'none' }}>{shop.distanceKm} km</span>}
          </div>
          <div className="row small muted" style={{ gap: 6 }}>
            <Pin width="14" height="14" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[shop.area, shop.city].filter(Boolean).join(', ')}</span>
          </div>
          <div className="row between" style={{ marginTop: 4 }}>
            <span className="row small" style={{ gap: 8 }}>
              <span className={`dot ${s.tone} ${s.tone === 'ok' ? 'pulse' : ''}`} />
              {s.text}
            </span>
            {shop.rating.count > 0 && (
              <span className="row small muted" style={{ gap: 6 }}>
                <Stars value={shop.rating.avg} size={13} /> {shop.rating.avg}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
