'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { dayLabel, mins, time12 } from '@/lib/format';
import { Clock, Users } from '@/components/icons';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function playChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const now = ctx.currentTime;
    const notes = [
      { f: 659.25, t: 0, d: 0.9 },
      { f: 880.0, t: 0.2, d: 1.2 },
    ];
    notes.forEach(({ f, t, d }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + t);
      gain.gain.setValueAtTime(0.001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.35, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + d);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + d + 0.1);
    });
  } catch (err) {
    console.warn('Audio chime unavailable', err);
  }
}

function announceCallout(tokens) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    if (!tokens || tokens.length === 0) return;
    const first = tokens[0];
    let phrase = `Token number ${first.token}.`;
    if (first.name) phrase = `Token ${first.token}, ${first.name}.`;
    if (first.resourceName) {
      phrase += ` Please proceed to ${first.resourceName}.`;
    }
    const utter = new SpeechSynthesisUtterance(phrase);
    utter.rate = 0.92;
    utter.pitch = 1.05;
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utter);
      } catch {}
    }, 450);
  } catch {}
}

function InterlockingNotch() {
  return (
    <div style={{ width: '100%', height: 22, position: 'relative', overflow: 'hidden', background: '#0b0c10', lineHeight: 0 }} aria-hidden="true">
      <svg viewBox="0 0 440 22" preserveAspectRatio="none" style={{ width: '100%', height: 22, display: 'block' }}>
        <path d="M 0 0 L 440 0 L 440 3 L 262 3 C 242 3 236 18 220 18 C 204 18 198 3 178 3 L 0 3 Z" fill="#f2460d" />
        <path d="M 0 22 L 440 22 L 440 12 L 262 12 C 246 12 238 21 220 21 C 202 21 194 12 178 12 L 0 12 Z" fill="#ffffff" />
      </svg>
    </div>
  );
}

function AdStage({ ad, remaining, totalActiveAds, adIndex }) {
  const [videoErr, setVideoErr] = useState(false);

  useEffect(() => {
    setVideoErr(false);
  }, [ad.id, ad.videoUrl]);

  const durSec = Math.max(3, ad.durationSec || 15);

  return (
    <section className="tv-ad-frame">
      {videoErr ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', color: '#9ca3af', padding: 24 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#e5e7eb' }}>{ad.title}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Video stream unavailable · closing in {remaining}s</div>
          </div>
        </div>
      ) : (
        <video
          key={ad.id}
          src={ad.videoUrl}
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoErr(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            animation: 'fade 1s ease-in-out both',
          }}
        />
      )}

      {/* Top overlay pills */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: 'rgba(11, 12, 16, 0.72)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#f4f4f6',
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 12px',
            borderRadius: 999,
          }}
        >
          Sponsored · {ad.title}
        </div>
        <div
          style={{
            background: 'rgba(11, 12, 16, 0.72)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.14)',
            color: '#e5e7eb',
            fontSize: 12,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            padding: '6px 11px',
            borderRadius: 999,
          }}
        >
          {remaining}s
        </div>
      </div>

      {/* Playlist dots + bottom progress bar */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
        {totalActiveAds > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 12 }}>
            {Array.from({ length: totalActiveAds }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: i === adIndex % totalActiveAds ? 22 : 7,
                  height: 7,
                  borderRadius: 999,
                  background: i === adIndex % totalActiveAds ? '#ff5d22' : 'rgba(255,255,255,0.35)',
                  transition: 'width 0.3s ease',
                }}
              />
            ))}
          </div>
        )}
        <div style={{ height: 4, width: '100%', background: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
          <div
            key={`bar-${ad.id}`}
            style={{
              height: '100%',
              width: '100%',
              background: 'linear-gradient(90deg, #ff5d22, #ff8a4c)',
              transformOrigin: 'left center',
              animation: `tvAdProgress ${durSec}s linear both`,
            }}
          />
        </div>
      </div>
    </section>
  );
}

export default function TvDisplayPage() {
  const { slug } = useParams();
  const clock = useClock();
  const [data, setData] = useState(null);
  const [disabledMsg, setDisabledMsg] = useState('');
  const [err, setErr] = useState('');
  const [origin, setOrigin] = useState('');
  const [pulseServing, setPulseServing] = useState(false);
  const [viewQueue, setViewQueue] = useState(null);
  const [leavingIds, setLeavingIds] = useState([]);
  const [leavingEmpty, setLeavingEmpty] = useState(false);
  const [callingIds, setCallingIds] = useState([]);
  const [shiftSeq, setShiftSeq] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioEnabledRef = useRef(false);
  const viewQueueRef = useRef(null);
  const swapTimerRef = useRef(null);
  const pulseTimerRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('qline_tv_sound') === '1';
      setAudioEnabled(saved);
      audioEnabledRef.current = saved;
    }
  }, []);

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    audioEnabledRef.current = next;
    if (typeof window !== 'undefined') {
      localStorage.setItem('qline_tv_sound', next ? '1' : '0');
    }
    if (next) {
      playChime();
    }
  };

  // Independent ad playback scheduler + smooth mount/unmount animation states.
  const [adIndex, setAdIndex] = useState(0);
  const [adPhase, setAdPhase] = useState('playing'); // 'playing' | 'resting'
  const [adRemaining, setAdRemaining] = useState(0);
  const [adMounted, setAdMounted] = useState(false);
  const [adOpen, setAdOpen] = useState(false);

  const ads = data?.ads || [];
  const adsCount = ads.length;
  const activeAd = adsCount > 0 ? ads[adIndex % adsCount] : null;
  const activeAdId = activeAd?.id || '';
  const activeAdSec = Math.max(3, activeAd?.durationSec || 15);
  const gapSec = Math.max(0, data?.adGapSec ?? 60);

  const wantAd = adPhase === 'playing' && !!activeAd;

  useEffect(() => {
    if (wantAd) {
      setAdMounted(true);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setAdOpen(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setAdOpen(false);
    const hideTimer = setTimeout(() => setAdMounted(false), 1300);
    return () => clearTimeout(hideTimer);
  }, [wantAd]);

  useEffect(() => {
    if (adsCount === 0 || !activeAdId) return;

    if (adPhase === 'playing') {
      const endAt = Date.now() + activeAdSec * 1000;
      setAdRemaining(activeAdSec);
      const tick = setInterval(() => {
        setAdRemaining(Math.max(0, Math.ceil((endAt - Date.now()) / 1000)));
      }, 250);
      const done = setTimeout(() => {
        setAdRemaining(0);
        if (gapSec > 0) {
          setAdPhase('resting');
        } else {
          setAdIndex((i) => (i + 1) % adsCount);
        }
      }, activeAdSec * 1000);
      return () => {
        clearInterval(tick);
        clearTimeout(done);
      };
    }

    const waitTimer = setTimeout(() => {
      setAdIndex((i) => (i + 1) % adsCount);
      setAdPhase('playing');
    }, gapSec * 1000);
    return () => clearTimeout(waitTimer);
  }, [adPhase, activeAdId, activeAdSec, gapSec, adsCount]);

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api(`/shops/${slug}/tv`);
      const nextServing = res.serving || [];
      const nextWaiting = res.waiting || [];
      const nextQueueSnap = {
        serving: nextServing,
        waiting: nextWaiting,
        waitingCount: res.waitingCount || 0,
        waitMin: res.waitMin || 0,
      };
      const cur = viewQueueRef.current;

      setData(res);
      setDisabledMsg('');
      setErr('');

      if (!cur) {
        viewQueueRef.current = nextQueueSnap;
        setViewQueue(nextQueueSnap);
        return;
      }

      const curKey = cur.serving.map((s) => s.id).join(',');
      const nextKey = nextServing.map((s) => s.id).join(',');

      if (curKey === nextKey) {
        if (swapTimerRef.current) return; // Let active promote transition finish cleanly.
        viewQueueRef.current = nextQueueSnap;
        setViewQueue(nextQueueSnap);
        return;
      }

      // Choreographed smooth transition:
      // 1) Existing serving token (or Counter Open) exits smoothly while the next token lifts out of Up Next.
      // 2) New serving token glides into NOW SERVING and remaining tokens shift smoothly up.
      if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);

      const nextServingSet = new Set(nextServing.map((s) => s.id));
      const outgoing = cur.serving.filter((s) => !nextServingSet.has(s.id)).map((s) => s.id);
      const promotedFromWaiting = cur.waiting.filter((w) => nextServingSet.has(w.id)).map((w) => w.id);

      setLeavingIds(outgoing);
      setLeavingEmpty(cur.serving.length === 0 && nextServing.length > 0);
      setCallingIds(promotedFromWaiting);

      const exitMs = outgoing.length > 0 || promotedFromWaiting.length > 0 ? 900 : 550;
      swapTimerRef.current = setTimeout(() => {
        swapTimerRef.current = null;
        viewQueueRef.current = nextQueueSnap;
        setViewQueue(nextQueueSnap);
        setLeavingIds([]);
        setLeavingEmpty(false);
        setCallingIds([]);
        setShiftSeq((s) => s + 1);
        if (nextServing.length > 0) {
          setPulseServing(true);
          pulseTimerRef.current = setTimeout(() => setPulseServing(false), 2600);
          if (audioEnabledRef.current) {
            playChime();
            announceCallout(nextServing);
          }
        }
      }, exitMs);
    } catch (e) {
      if (e.status === 404) setDisabledMsg(e.message || 'Live TV display is turned off for this shop.');
      else setErr(e.message || 'Unable to refresh queue.');
    }
  }, [slug]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => {
      clearInterval(t);
      if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, [load]);

  if (disabledMsg) {
    return (
      <main style={{ minHeight: '100dvh', background: '#0b0c10', color: '#f5f6f8', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ maxWidth: 460, textAlign: 'center', display: 'grid', gap: 14 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>TV display not active</h1>
          <p style={{ color: '#a0a6b1', margin: 0, lineHeight: 1.5 }}>{disabledMsg}</p>
          <div>
            <Link href={`/s/${slug}`} className="btn secondary">Go to shop page</Link>
          </div>
        </div>
      </main>
    );
  }

  if (!data || !viewQueue) {
    return (
      <main style={{ minHeight: '100dvh', background: '#0b0c10', color: '#a0a6b1', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ fontSize: 18 }}>{err || 'Loading live display...'}</div>
      </main>
    );
  }

  const { shop, status } = data;
  const { waitMin, waitingCount, serving, waiting } = viewQueue;
  const isOpen = status?.state === 'open';
  const isPaused = Boolean(shop?.queuePaused);
  const openTime = typeof status?.opensAt === 'string' ? status.opensAt : status?.opensAt?.time || '';
  const openDate = status?.opensAt?.date || null;
  const joinUrl = origin ? `${origin}/s/${shop.slug}` : `/s/${shop.slug}`;
  const nextThree = waiting.slice(0, 3);
  const restWaiting = waiting.slice(3, 9);

  return (
    <main className="tv-main">
      {/* Full-height stage: Left column (Header + Queue Pass + Footer), Right full-height Video Ads */}
      <div className={`tv-stage-wrap${adOpen ? ' with-ad' : ''}`}>
        {/* Left Sidebar Column */}
        <aside className="tv-queue-col">
          {/* Compact Shop Header + Clock */}
          <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'clamp(20px, 2.2vw, 26px)', fontWeight: 700, letterSpacing: '-0.03em', margin: 0 }}>
                  {shop.name}
                </h1>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 10.5,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '4px 9px',
                    borderRadius: 999,
                    background: status.state === 'open' ? 'rgba(34,197,94,0.16)' : 'rgba(239,68,68,0.18)',
                    color: status.state === 'open' ? '#4ade80' : '#f87171',
                  }}
                >
                  {status.state === 'open' && !shop.queuePaused && <span className="dot ok pulse" />}
                  {status.state === 'open' ? (shop.queuePaused ? 'Paused' : 'Live') : 'Closed'}
                </span>
              </div>
              {(shop.area || shop.city) && (
                <p style={{ margin: '3px 0 0', color: '#9ca3af', fontSize: 12.5 }}>
                  {[shop.area, shop.city].filter(Boolean).join(', ')}
                  {status.state === 'open' && status.closesAt ? ` · Till ${time12(status.closesAt)}` : ''}
                </p>
              )}
              {shop.delayMin > 0 && (
                <div style={{ marginTop: 6, display: 'inline-block', background: 'rgba(245,158,11,0.16)', color: '#fbbf24', padding: '4px 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600 }}>
                  ~{shop.delayMin} min delay{shop.delayNote ? ` · ${shop.delayNote}` : ''}
                </div>
              )}
            </div>

            <div style={{ textAlign: 'right', flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ fontSize: 'clamp(18px, 2vw, 24px)', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{clock}</div>
              <button
                type="button"
                onClick={toggleAudio}
                style={{
                  background: audioEnabled ? 'rgba(34, 197, 94, 0.18)' : 'rgba(255, 255, 255, 0.12)',
                  color: audioEnabled ? '#4ade80' : '#d1d5db',
                  border: '1px solid ' + (audioEnabled ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.2)'),
                  borderRadius: 999,
                  padding: '3px 9px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.2s ease',
                }}
                title={audioEnabled ? 'Mute TV audio' : 'Enable TV chime & speech'}
              >
                {audioEnabled ? '🔊 Sound On' : '🔇 Audio Off'}
              </button>
            </div>
          </header>

          {/* Boarding-Pass Interlocking Queue Card */}
          <section className="tv-pass">
          {/* Top Card: Vibrant Orange NOW SERVING */}
          <div
            className={pulseServing ? 'tv-serving-pulse' : undefined}
            style={{
              background: 'linear-gradient(145deg, #ff6328 0%, #ef410c 100%)',
              color: '#ffffff',
              borderRadius: '26px 26px 0 0',
              padding: '22px 22px 16px',
              display: 'grid',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.92 }}>
                Now Serving
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.18)',
                  padding: '4px 10px',
                  borderRadius: 999,
                }}
              >
                {serving.length > 0
                  ? `${serving.length} serving`
                  : !isOpen
                  ? 'Closed'
                  : isPaused
                  ? 'Paused'
                  : 'Ready'}
              </span>
            </div>

            {serving.length === 0 ? (
              <div
                className={leavingEmpty ? 'tv-serving-exit' : 'tv-token-enter'}
                style={{
                  background: 'rgba(255,255,255,0.14)',
                  borderRadius: 18,
                  padding: '26px 18px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
                  {!isOpen ? 'Counter Closed' : isPaused ? 'Queue Paused' : 'Counter Open'}
                </div>
                <div style={{ fontSize: 13, opacity: 0.86, marginTop: 4 }}>
                  {!isOpen
                    ? (openTime ? `Opens${openDate ? ` ${dayLabel(openDate)}` : ''} at ${time12(openTime)}` : 'Shop is currently closed')
                    : isPaused
                    ? 'Queue is temporarily paused'
                    : nextThree[0]
                    ? `Token #${nextThree[0].token} will be called shortly`
                    : 'Walk in or scan to join'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {serving.slice(0, 3).map((b) => {
                  const isLeaving = leavingIds.includes(b.id);
                  return (
                  <div
                    key={b.id}
                    className={isLeaving ? 'tv-serving-exit' : 'tv-promote-in'}
                    style={{
                      background: 'rgba(255,255,255,0.16)',
                      borderRadius: 18,
                      padding: '16px 18px',
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr auto',
                      alignItems: 'center',
                      gap: 14,
                    }}
                  >
                    <div style={{ fontSize: 'clamp(40px, 5vw, 54px)', fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      #{b.token}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ flex: 1, borderBottom: '2px dashed rgba(255,255,255,0.4)' }} />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 10,
                          background: 'rgba(255,255,255,0.2)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {b.durationMin ? `${b.durationMin}m` : 'Serving'}
                      </span>
                      <span style={{ flex: 1, borderBottom: '2px dashed rgba(255,255,255,0.4)' }} />
                    </div>
                    <div style={{ textAlign: 'right', minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                        {b.services[0] || 'Service'}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.85 }}>
                        {b.partySize > 1 ? `${b.partySize} people` : b.slotTime ? `Slot ${time12(b.slotTime)}` : 'At counter'}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, opacity: 0.9, padding: '2px 4px 0' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Users width="14" height="14" /> {waitingCount} waiting
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Clock width="14" height="14" /> {waitMin > 0 ? `~${mins(waitMin)} est.` : (!isOpen ? 'Closed' : 'No wait')}
              </span>
            </div>
          </div>

          <InterlockingNotch />

          {/* Bottom Card: Crisp Pure White UP NEXT */}
          <div
            style={{
              background: '#ffffff',
              color: '#111111',
              borderRadius: '0 0 26px 26px',
              padding: '16px 22px 22px',
              display: 'grid',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#6b7280' }}>
                Up Next
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
                {nextThree.length > 0 ? 'Please be ready' : !isOpen ? 'Closed' : isPaused ? 'Paused' : 'Open'}
              </span>
            </div>

            {nextThree.length === 0 ? (
              <div style={{ background: '#f5f6f8', borderRadius: 16, padding: '22px 16px', textAlign: 'center', color: '#6b7280', fontSize: 14, fontWeight: 500 }}>
                {!isOpen
                  ? 'No active queue · Shop is currently closed'
                  : isPaused
                  ? 'Queue is currently paused'
                  : 'No wait right now — walk right in!'}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gap: 10 }}>
                  {nextThree.map((w, idx) => {
                    const isPicked = callingIds.includes(w.id);
                    return (
                    <div
                      key={`${w.id}-${shiftSeq}`}
                      className={isPicked ? 'tv-pick-next' : shiftSeq > 0 ? 'tv-shift-up' : 'tv-token-enter'}
                      style={{
                        background: isPicked || idx === 0 ? '#fff5f1' : '#f5f6f8',
                        border: isPicked ? '1px solid rgba(242, 70, 13, 0.55)' : idx === 0 ? '1px solid rgba(242, 70, 13, 0.22)' : '1px solid transparent',
                        borderRadius: 16,
                        padding: '13px 16px',
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        alignItems: 'center',
                        gap: 12,
                        animationDelay: isPicked ? '0ms' : `${idx * 95}ms`,
                        transition: 'background 0.95s ease-in-out, border-color 0.95s ease-in-out, transform 1s cubic-bezier(0.25, 0.1, 0.25, 1)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: isPicked || idx === 0 ? '#f2460d' : '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {isPicked ? 'Calling' : idx === 0 ? 'Next' : idx === 1 ? '2nd' : '3rd'}
                        </div>
                        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.05em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
                          #{w.token}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ flex: 1, borderBottom: '2px dashed #d1d5db' }} />
                        <span style={{ background: isPicked ? '#ff5d22' : '#ffffff', border: isPicked ? '1px solid #ff5d22' : '1px solid #e5e7eb', borderRadius: 10, padding: '4px 10px', fontSize: 11, fontWeight: 700, color: isPicked ? '#ffffff' : '#111111', whiteSpace: 'nowrap', transition: 'all 0.5s ease' }}>
                          {isPicked ? 'Starting now' : w.slotTime ? time12(w.slotTime) : idx === 0 ? 'Next turn' : 'In queue'}
                        </span>
                        <span style={{ flex: 1, borderBottom: '2px dashed #d1d5db' }} />
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111111', maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {w.services.join(', ') || 'Service'}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          {[w.durationMin ? `${w.durationMin} min` : null, w.partySize > 1 ? `${w.partySize} people` : null].filter(Boolean).join(' · ') || 'Waiting'}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>

                {restWaiting.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', paddingTop: 2 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, color: '#6b7280', marginRight: 4 }}>Also waiting:</span>
                    {restWaiting.map((w) => (
                      <span
                        key={w.id}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          background: '#f3f4f6',
                          color: '#374151',
                          padding: '4px 9px',
                          borderRadius: 999,
                        }}
                      >
                        #{w.token}{w.partySize > 1 ? ` (${w.partySize}p)` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

          {/* Join Link & Footer */}
          <footer style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '6px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, color: '#9ca3af', fontSize: 13 }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
              Join from your phone: <strong style={{ color: '#ffffff' }}>{joinUrl}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              {err && <span style={{ color: '#fca5a5' }}>{err}</span>}
              <span>Powered by Qline</span>
            </div>
          </footer>
        </aside>

        {/* Right Side: Full-Height 4:3 / Optimal Landscape Contain Video Ads */}
        <div className="tv-ad-col" aria-hidden={!adOpen}>
          {adMounted && activeAd && (
            <AdStage ad={activeAd} remaining={adRemaining} totalActiveAds={adsCount} adIndex={adIndex} />
          )}
        </div>
      </div>
    </main>
  );
}
