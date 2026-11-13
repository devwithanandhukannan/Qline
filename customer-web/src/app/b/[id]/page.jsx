'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import Shell, { LoginGate } from '@/components/Shell';
import { Button, Empty, StarInput, Switch, Textarea, useConfirm, useToast } from '@/components/ui';
import { TicketPassSkeleton } from '@/components/Skeletons';
import { Bell, Check, ChevronLeft, Clock, Phone, Pin, Users, X } from '@/components/icons';
import TicketPass from '@/components/TicketPass';
import ConfettiBlaster from '@/components/ConfettiBlaster';
import { api } from '@/lib/api';
import { dayLabel, mins, time12 } from '@/lib/format';

function urlBase64ToUint8Array(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function samePushKey(sub, serverKey) {
  const cur = sub?.options?.applicationServerKey;
  if (!cur) return false;
  const a = new Uint8Array(cur);
  if (a.length !== serverKey.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== serverKey[i]) return false;
  return true;
}

const isIosBrowser = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !window.navigator.standalone &&
  !window.matchMedia?.('(display-mode: standalone)')?.matches;

function Ticket() {
  const { id } = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [b, setB] = useState(null);
  const [gone, setGone] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [justCancelled, setJustCancelled] = useState(false);
  const [steppingBack, setSteppingBack] = useState(false);
  const [notify, setNotify] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [notifHint, setNotifHint] = useState('');
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [sending, setSending] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const startAhead = useRef(null);
  const alerted = useRef(false);
  const pushSynced = useRef(false);
  const autoTried = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('new') === '1') {
        setShowConfetti(true);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api(`/bookings/${id}`);
      setB(r.booking);
      if (r.booking?.hasPush && !pushSynced.current) {
        pushSynced.current = true;
        setNotify(true);
        setPushSubscribed(true);
      }
    } catch (e) {
      if (e.status === 404) setGone(true);
    }
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === 'visible' && load(), 8000);
    const v = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', v);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', v);
    };
  }, [load]);

  useEffect(() => {
    if (!b?.live) return;
    if (startAhead.current == null) startAhead.current = b.live.ahead;
    document.title = b.status === 'serving' ? 'Your turn · Qline' : `${b.live.ahead} ahead · Qline`;
    if (b.live.ahead <= 1 && !alerted.current && notify) {
      alerted.current = true;
      navigator.vibrate?.([200, 100, 200]);
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Qline', { body: b.status === 'serving' ? 'It is your turn!' : 'You are next. Please head to the shop.' });
    }
    return () => {
      document.title = 'Qline';
    };
  }, [b, notify]);

  const enableNotify = useCallback(async (v, { silent = false } = {}) => {
    setNotifHint('');
    if (!v) {
      try { localStorage.setItem('qline:push:off', '1'); } catch {}
      setNotify(false);
      setPushSubscribed(false);
      try {
        const reg = await navigator.serviceWorker?.getRegistration?.('/sw.js');
        const sub = await reg?.pushManager?.getSubscription?.();
        await api(`/bookings/${id}/push`, { method: 'DELETE', body: sub ? { endpoint: sub.endpoint } : {} });
      } catch {
        // Best-effort cleanup; local alert toggle is already off.
      }
      return;
    }

    try { localStorage.removeItem('qline:push:off'); } catch {}

    if (isIosBrowser()) {
      setNotifHint('On iPhone, tap Share → Add to Home Screen and open Qline from there for lock-screen alerts.');
    }

    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    if ('Notification' in window && Notification.permission === 'denied') {
      setPushSubscribed(false);
      setNotify(false);
      const msg = 'Notifications are blocked in browser settings. Enable them to get lock-screen alerts.';
      setNotifHint(msg);
      if (!silent) toast.error(msg);
      return;
    }

    const canPush =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window &&
      Notification.permission === 'granted';

    if (canPush) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        const reg = await navigator.serviceWorker.ready;
        const { publicKey } = await api('/push/vapid-key');
        const serverKey = urlBase64ToUint8Array(publicKey);
        let sub = await reg.pushManager.getSubscription();
        if (sub && !samePushKey(sub, serverKey)) {
          await sub.unsubscribe().catch(() => {});
          sub = null;
        }
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: serverKey,
          });
        }
        await api(`/bookings/${id}/push`, { method: 'POST', body: sub.toJSON() });
        pushSynced.current = true;
        setPushSubscribed(true);
        setNotify(true);
        if (!silent) toast.show('Push alert enabled — works even if your phone is locked');
        return;
      } catch {
        // Fall through to in-tab notification alert.
      }
    }

    if (silent) return;
    setPushSubscribed(false);
    setNotify(true);
    toast.show('We will alert you when you are next, while this page is open');
  }, [id, toast]);

  useEffect(() => {
    if (!b || b.status !== 'waiting' || b.hasPush || autoTried.current) return;
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      if (localStorage.getItem('qline:push:off') === '1') return;
    } catch {}
    autoTried.current = true;
    enableNotify(true, { silent: true });
  }, [b, enableNotify]);

  async function stepBack() {
    const ok = await confirm({
      title: 'Let 1 person go ahead?',
      message: `Your token stays #${b.token}, and the person right behind you moves ahead. You can use this up to 2 times per booking.`,
      confirmText: 'Step back 1 spot',
      cancelText: 'Stay in place',
    });
    if (!ok) return;
    setSteppingBack(true);
    try {
      const r = await api(`/bookings/${id}/step-back`, { method: 'POST', body: {} });
      setB(r.booking);
      toast.show('Moved 1 spot back without losing your token');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSteppingBack(false);
    }
  }

  async function cancel() {
    const ok = await confirm({
      title: 'Cancel this booking?',
      message: b.type === 'queue' ? 'You will lose your place in the queue.' : 'Your slot will be released for others.',
      confirmText: 'Cancel booking',
      cancelText: 'Keep it',
      destructive: true,
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await api(`/bookings/${id}/cancel`, { method: 'POST', body: {} });
      setJustCancelled(true);
      navigator.vibrate?.([35, 30, 70]);
      window.scrollTo?.({ top: 0, behavior: 'smooth' });
      toast.show('Booking cancelled');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCancelling(false);
    }
  }

  async function rate() {
    setSending(true);
    try {
      await api(`/bookings/${id}/review`, { method: 'POST', body: { stars, comment: comment.trim(), isPublic } });
      toast.show('Thanks for your feedback');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  }

  if (gone) return <Empty title="Booking not found" action={<Link href="/bookings" className="btn">My bookings</Link>} />;
  if (!b) return <TicketPassSkeleton />;

  const active = b.status === 'waiting' || b.status === 'serving';
  const live = b.live;
  const pct = live && startAhead.current != null ? Math.min(100, Math.round(((startAhead.current - live.ahead) / Math.max(1, startAhead.current)) * 100)) : 0;

  return (
    <div className="stack-lg">
      {showConfetti && <ConfettiBlaster onComplete={() => setShowConfetti(false)} />}
      <div className="stack enter">
        <div className="row" style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
          <button className="btn icon ghost" onClick={() => router.push('/bookings')} aria-label="Back"><ChevronLeft /></button>
          <div className="grow">
            <h2>{b.shop.name}</h2>
            <p className="small muted">{[b.shop.area, b.shop.city].filter(Boolean).join(', ')}</p>
          </div>
        </div>

        {/* The New Physical / Tactile Ticket Pass */}
        <TicketPass booking={b} justCancelled={justCancelled} />

        {active && b.delay && (
          <div className="card row" role="status" style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
            <Clock />
            <div>
              <b>Running {b.delay.min} min late</b>
              {b.delay.note && <p className="small muted">{b.delay.note}</p>}
            </div>
          </div>
        )}

        {active && b.status === 'waiting' && (
          <div className="card stack-sm" style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
            <div className="row between">
              <div className="row">
                <Bell width="20" height="20" />
                <div>
                  <b>{b.type === 'queue' ? "Alert me when I'm next" : 'Notify me of shop updates'}</b>
                  <p className="small muted">
                    {pushSubscribed
                      ? 'Push alert even when browser is closed'
                      : b.type === 'queue'
                      ? 'Get alerts for your turn & delays'
                      : 'Get alerts if your slot starts or delays'}
                  </p>
                </div>
              </div>
              <Switch checked={notify} onChange={(v) => enableNotify(v)} label="Enable booking notifications" />
            </div>
            {notifHint && <p className="small muted" role="status">{notifHint}</p>}
          </div>
        )}

        {active && b.type === 'queue' && (
          <p className="small muted center" style={{ maxWidth: 440, margin: '0 auto' }}>
            Please be at the shop within {b.graceMin} minutes of your turn, or you may be skipped.
          </p>
        )}
      </div>

      {b.status === 'done' && !b.reviewed && (
        <section className="card stack enter" style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
          <div className="center stack-sm"><h3>How was your visit?</h3><p className="small muted">Your feedback helps others choose and helps the shop improve.</p></div>
          <StarInput value={stars} onChange={setStars} />
          {stars > 0 && (
            <div className="stack enter">
              <Textarea placeholder={stars <= 3 ? 'What could be better?' : 'Tell others what you liked (optional)'} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
              {comment.trim() && (
                <div className="row between">
                  <span className="small">Show my comment publicly<br /><span className="muted">Otherwise only the shop sees it</span></span>
                  <Switch checked={isPublic} onChange={setIsPublic} label="Show publicly" />
                </div>
              )}
              <Button block loading={sending} onClick={rate}>Submit</Button>
            </div>
          )}
        </section>
      )}

      {b.status === 'done' && b.reviewed && <p className="center small muted">You rated this visit. Thank you!</p>}

      {b.status === 'waiting' && (
        <div className="stack-sm" style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
          {b.type === 'queue' && live?.canStepBack && (
            <Button block variant="secondary" loading={steppingBack} onClick={stepBack}>
              <Users width="18" height="18" /> Let 1 person go ahead
            </Button>
          )}
          <Button block variant="danger-soft" loading={cancelling} onClick={cancel}><X width="18" height="18" /> Cancel booking</Button>
        </div>
      )}
      {!active && (
        <div style={{ maxWidth: 440, margin: '0 auto', width: '100%' }}>
          <Link href={`/s/${b.shop.slug}`} className="btn secondary block">Book again</Link>
        </div>
      )}
    </div>
  );
}

export default function TicketPage() {
  return (
    <Shell>
      <LoginGate reason="Sign in to see your booking" fallback={<TicketPassSkeleton />}><Ticket /></LoginGate>
    </Shell>
  );
}
