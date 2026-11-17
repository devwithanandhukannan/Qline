'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { TopBar } from '@/components/Shell';
import BookingSheet from '@/components/BookingSheet';
import OtpLogin from '@/components/OtpLogin';
import { statusLine, categoryIcon } from '@/components/ShopCard';
import { Button, Empty, Sheet, Skeleton, Stars, cx } from '@/components/ui';
import { ShopDetailSkeleton } from '@/components/Skeletons';
import { ChevronLeft, Check, Phone, Pin, Share, ExternalLink } from '@/components/icons';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ago, mins, money, time12 } from '@/lib/format';

export default function ShopPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { user, ready } = useAuth();
  const [shop, setShop] = useState(null);
  const [missing, setMissing] = useState(false);
  const [picked, setPicked] = useState([]);
  const [reviews, setReviews] = useState(null);
  const [sheet, setSheet] = useState(null); // 'queue' | 'slot'
  const [login, setLogin] = useState(null); // mode to continue with after sign in
  const [expandedImgIdx, setExpandedImgIdx] = useState(null);

  useEffect(() => {
    if (expandedImgIdx === null) return;
    function onKeyDown(e) {
      if (e.key === 'Escape') setExpandedImgIdx(null);
      if (e.key === 'ArrowLeft') setExpandedImgIdx((prev) => (prev > 0 ? prev - 1 : (shop?.images?.length || 1) - 1));
      if (e.key === 'ArrowRight') setExpandedImgIdx((prev) => (prev < (shop?.images?.length || 1) - 1 ? prev + 1 : 0));
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expandedImgIdx, shop?.images?.length]);

  const load = useCallback(async () => {
    try {
      const r = await api(`/shops/${slug}`);
      setShop(r.shop);
    } catch (e) {
      if (e.status === 404) setMissing(true);
    }
  }, [slug]);

  useEffect(() => {
    load();
    api(`/shops/${slug}/reviews?limit=6`).then(setReviews).catch(() => {});
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 15000);
    return () => clearInterval(t);
  }, [slug, load]);

  useEffect(() => {
    if (shop && picked.length === 0 && shop.services.length === 1) setPicked([shop.services[0].id]);
  }, [shop, picked.length]);

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  function start(mode) {
    setSheet(mode);
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: shop.name, url });
      else await navigator.clipboard.writeText(url);
    } catch {}
  }

  const back = (
    <button className="btn icon ghost" onClick={() => (window.history.length > 1 ? router.back() : router.push('/explore'))} aria-label="Back">
      <ChevronLeft />
    </button>
  );

  if (missing) {
    return (
      <>
        <TopBar back={back} />
        <main className="page"><Empty title="Shop not found" action={<Link href="/explore" className="btn">Browse shops</Link>}>This link may be old or mistyped.</Empty></main>
      </>
    );
  }

  if (!shop) {
    return (
      <>
        <TopBar back={back} />
        <main className="page"><ShopDetailSkeleton /></main>
      </>
    );
  }

  const Icon = categoryIcon(shop.category);
  const st = statusLine(shop);
  const total = shop.services.filter((s) => picked.includes(s.id)).reduce((a, s) => a + s.price, 0);
  const wait = shop.queue ? (shop.queue.ahead === 0 ? 'no wait' : `~${mins(shop.queue.waitMin)}`) : null;
  const queueOk = shop.settings.acceptQueue && shop.today.state === 'open' && shop.queue && shop.queue.accepting;
  const mapQ =
    shop.lat != null && shop.lng != null
      ? `${shop.lat},${shop.lng}`
      : encodeURIComponent([shop.name, shop.address, shop.area, shop.city].filter(Boolean).join(', '));

  return (
    <>
      <TopBar back={back} right={<button className="btn icon ghost" onClick={share} aria-label="Share"><Share /></button>} />
      <main className="page stack-lg" style={{ paddingBottom: 'calc(150px + var(--safe-b))' }}>
        <section className="stack enter">
          <div className="row">
            <div
              className="feature"
              style={{
                padding: 0,
                width: 56,
                height: 56,
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
                <Icon width="26" height="26" />
              )}
            </div>
            <div className="grow">
              <h1 style={{ fontSize: 28 }}>{shop.name}</h1>
              <div className="row small muted" style={{ gap: 8, marginTop: 4 }}>
                {shop.rating.count > 0 ? <><Stars value={shop.rating.avg} size={14} /> <span>{shop.rating.avg} ({shop.rating.count})</span></> : <span>New on Qline</span>}
              </div>
            </div>
          </div>
          {shop.description && <p className="muted">{shop.description}</p>}
          <div className="list">
            <div className="item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
              <div className="row" style={{ gap: 10, minWidth: 0, flex: '1 1 200px' }}>
                <Pin width="20" height="20" style={{ flex: 'none', color: 'var(--fg-2)' }} />
                <span className="grow small" style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>
                  {[shop.address, shop.area, shop.city].filter(Boolean).join(', ') || 'View location'}
                </span>
              </div>
              <a
                className="btn secondary sm"
                href={`https://www.google.com/maps/search/?api=1&query=${mapQ}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  fontSize: 12,
                  padding: '7px 14px',
                  borderRadius: 'var(--r-sm)',
                  flex: 'none',
                }}
              >
                <Pin width="14" height="14" />
                <span>Open in Google Maps</span>
                <ExternalLink width="12" height="12" />
              </a>
            </div>
            {shop.phone && (
              <a className="item" href={`tel:${shop.phone.replace(/[^0-9+]/g, '')}`}>
                <Phone width="20" height="20" />
                <span className="grow small">{shop.phone}</span>
              </a>
            )}
          </div>
        </section>

        <section className="card enter stack-sm">
          <div className="row between">
            <span className="row" style={{ gap: 8, fontWeight: 600 }}>
              <span className={cx('dot', st.tone, st.tone === 'ok' && 'pulse')} />
              {shop.today.state === 'open' ? 'Open now' : shop.today.state === 'later' ? 'Opens later' : 'Closed'}
            </span>
            <span className="small muted">
              {shop.today.hours.length > 0 ? shop.today.hours.map((h) => `${time12(h.start)} to ${time12(h.end)}`).join(' · ') : shop.today.note}
            </span>
          </div>
          {shop.today.note && shop.today.hours.length > 0 && <p className="small">{shop.today.note}</p>}
          {shop.queue && shop.settings.acceptQueue && (
            <div className="row between" style={{ marginTop: 6 }}>
              <div className="stat"><b>{shop.queue.ahead}</b><span>in queue</span></div>
              <div className="stat" style={{ textAlign: 'right' }}><b>{shop.queue.ahead === 0 ? '0' : mins(shop.queue.waitMin)}</b><span>{shop.queue.ahead === 0 ? 'minutes wait' : 'estimated wait'}</span></div>
            </div>
          )}
          {shop.queue?.paused && <p className="small" style={{ color: 'var(--warn)' }}>The shop paused new queue entries for a moment.</p>}
          {shop.queue?.delayNote && <p className="small">{shop.queue.delayNote}</p>}
        </section>

        <section className="stack-sm enter">
          <div className="section-title">Choose services</div>
          <div className="list">
            {shop.services.map((s) => {
              const on = picked.includes(s.id);
              return (
                <button key={s.id} className="item" onClick={() => toggle(s.id)} aria-pressed={on}>
                  <span className="grow"><b style={{ fontWeight: 600 }}>{s.name}</b><br /><span className="small muted">{mins(s.durationMin)}</span></span>
                  <span className="num muted">{money(s.price)}</span>
                  <span style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', background: on ? 'var(--inv-bg)' : 'transparent', color: 'var(--inv-fg)', border: on ? 0 : '2px solid var(--fg-3)', transition: 'all .25s var(--ease)', flex: 'none' }}>
                    {on && <Check width="16" height="16" strokeWidth="3" />}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {shop.images && shop.images.length > 0 && (
          <section className="stack-sm enter">
            <div className="section-title">Photos</div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
              }}
            >
              {shop.images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setExpandedImgIdx(i)}
                  aria-label={`View photo ${i + 1}`}
                  style={{
                    position: 'relative',
                    aspectRatio: '1 / 1',
                    borderRadius: 'var(--r)',
                    overflow: 'hidden',
                    background: 'var(--bg-2)',
                    border: '1px solid var(--line)',
                    padding: 0,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow)',
                    transition: 'transform 0.18s var(--ease)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <img
                    src={img}
                    alt={`${shop.name} photo ${i + 1}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="stack-sm enter">
          <div className="section-title">Reviews</div>
          {!reviews && (
            <div className="stack-sm">
              {[0, 1].map((i) => (
                <div className="card stack-sm" key={i}>
                  <div className="row between"><Skeleton h={14} w={84} r={6} /><Skeleton h={12} w={50} r={6} /></div>
                  <Skeleton h={14} w="80%" r={6} />
                  <Skeleton h={12} w="30%" r={6} />
                </div>
              ))}
            </div>
          )}
          {reviews && reviews.reviews.length === 0 && <div className="card center small muted">No reviews yet. Be the first after your visit.</div>}
          {reviews && reviews.reviews.length > 0 && (
            <div className="stack-sm">
              {reviews.reviews.map((r) => (
                <div className="card stack-sm" key={r.id}>
                  <div className="row between"><Stars value={r.stars} size={14} /><span className="tiny muted">{ago(r.createdAt)}</span></div>
                  {r.comment && <p>{r.comment}</p>}
                  <span className="small muted">{r.name}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <div className="tabbar" style={{ padding: '12px 20px calc(12px + var(--safe-b))' }}>
        <div className="tabbar-in" style={{ gap: 10, flexDirection: 'column' }}>
          <div className="row between small muted" style={{ padding: '0 4px' }}>
            <span>{picked.length ? `${picked.length} selected` : 'Select a service'}</span>
            <span className="num">{total ? money(total) : ''}</span>
          </div>
          <div className="row" style={{ gap: 10 }}>
            {shop.settings.acceptQueue && (
              <Button className="grow" disabled={!picked.length || !queueOk} onClick={() => start('queue')}>
                {queueOk ? `Join queue${wait ? ` · ${wait}` : ''}` : shop.today.state === 'open' ? 'Queue unavailable' : 'Queue closed'}
              </Button>
            )}
            {shop.settings.acceptSlots && (
              <Button className="grow" variant={shop.settings.acceptQueue ? 'secondary' : undefined} disabled={!picked.length} onClick={() => start('slot')}>
                Pick a slot
              </Button>
            )}
          </div>
        </div>
      </div>

      <BookingSheet open={!!sheet} onClose={() => setSheet(null)} shop={shop} serviceIds={picked} initialMode={sheet || 'queue'} />

      <Sheet open={!!login} onClose={() => setLogin(null)} title="Almost there">
        <OtpLogin
          title="Sign in to book"
          subtitle="One quick step. We will email you a code, no password needed."
          onDone={() => {
            const m = login;
            setLogin(null);
            setTimeout(() => setSheet(m), 280);
          }}
        />
      </Sheet>

      {expandedImgIdx !== null && shop?.images?.[expandedImgIdx] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Expanded shop photo"
          onClick={() => setExpandedImgIdx(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {/* Top bar with count & close */}
          <div
            style={{
              position: 'absolute',
              top: 'calc(16px + var(--safe-t))',
              left: 20,
              right: 20,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '4px 12px',
                borderRadius: 20,
                backdropFilter: 'blur(8px)',
              }}
            >
              {expandedImgIdx + 1} / {shop.images.length}
            </span>
            <button
              type="button"
              onClick={() => setExpandedImgIdx(null)}
              aria-label="Close photo"
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.18)',
                color: '#fff',
                border: 0,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                fontSize: 18,
                fontWeight: 'bold',
                backdropFilter: 'blur(8px)',
              }}
            >
              ✕
            </button>
          </div>

          {/* Central image with previous/next controls */}
          <div
            style={{
              position: 'relative',
              maxWidth: 'min(92vw, 680px)',
              maxHeight: 'min(78vh, 680px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {shop.images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedImgIdx((prev) => (prev > 0 ? prev - 1 : shop.images.length - 1));
                }}
                aria-label="Previous photo"
                style={{
                  position: 'absolute',
                  left: -18,
                  zIndex: 2,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(20, 20, 20, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 22,
                  backdropFilter: 'blur(8px)',
                }}
              >
                ‹
              </button>
            )}

            <img
              src={shop.images[expandedImgIdx]}
              alt={`${shop.name} full view`}
              style={{
                maxWidth: '100%',
                maxHeight: 'min(78vh, 680px)',
                objectFit: 'contain',
                borderRadius: 'var(--r)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85)',
              }}
            />

            {shop.images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedImgIdx((prev) => (prev < shop.images.length - 1 ? prev + 1 : 0));
                }}
                aria-label="Next photo"
                style={{
                  position: 'absolute',
                  right: -18,
                  zIndex: 2,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(20, 20, 20, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 22,
                  backdropFilter: 'blur(8px)',
                }}
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}
      {ready && null}
    </>
  );
}
