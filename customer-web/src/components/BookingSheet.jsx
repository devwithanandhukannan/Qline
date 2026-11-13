'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, Button, Segmented, Skeleton, Input, Switch, cx, useToast } from './ui';
import { api } from '@/lib/api';
import { addDaysStr, dayLabel, mins, money, time12 } from '@/lib/format';

// Confirm sheet for both flows: join the live queue now, or pick a day + time slot.
export default function BookingSheet({ open, onClose, shop, serviceIds, initialMode }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState(initialMode);
  const [date, setDate] = useState(shop.today.date);
  const [avail, setAvail] = useState(null);
  const [slot, setSlot] = useState(null);
  const [partySize, setPartySize] = useState('1');
  const [forOther, setForOther] = useState(false);
  const [forName, setForName] = useState('');
  const [busy, setBusy] = useState(false);
  const [holding, setHolding] = useState(false);
  const [holdUntil, setHoldUntil] = useState(0);
  const [holdSec, setHoldSec] = useState(0);
  const [error, setError] = useState('');
  const loadSeqRef = useRef(0);
  const holdReqRef = useRef(0);
  const holdActiveRef = useRef(false);
  const bookingRef = useRef(false);

  const count = Number(partySize) || 1;
  const chosen = shop.services.filter((s) => serviceIds.includes(s.id));
  const total = chosen.reduce((a, s) => a + s.price, 0) * count;
  const duration = chosen.reduce((a, s) => a + s.durationMin, 0) * count;
  const { acceptQueue, acceptSlots, advanceDays } = shop.settings;

  const releaseHold = useCallback(() => {
    holdReqRef.current += 1;
    setHoldUntil(0);
    setHoldSec(0);
    if (holdActiveRef.current) {
      holdActiveRef.current = false;
      api(`/bookings/hold-slot?slug=${shop.slug}`, { method: 'DELETE' }).catch(() => {});
    }
  }, [shop.slug]);

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setPartySize('1');
      setForOther(false);
      setForName('');
      setError('');
      setSlot(null);
      setHoldUntil(0);
      setHoldSec(0);
      holdActiveRef.current = false;
    }
  }, [open, initialMode]);

  const loadSlots = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setAvail(null);
    setSlot(null);
    try {
      const res = await api(`/shops/${shop.slug}/availability?date=${date}&serviceIds=${serviceIds.join(',')}&partySize=${count}`);
      if (seq === loadSeqRef.current) setAvail(res);
    } catch (e) {
      if (seq === loadSeqRef.current) setError(e.message);
    }
  }, [shop.slug, date, serviceIds, count]);

  useEffect(() => {
    if (open && mode === 'slot') loadSlots();
  }, [open, mode, loadSlots]);

  // Tick the 2-minute slot reservation countdown from its server expiry timestamp.
  useEffect(() => {
    if (!open || mode !== 'slot' || !holdUntil) {
      setHoldSec(0);
      return;
    }
    const tick = () => {
      const left = Math.ceil((holdUntil - Date.now()) / 1000);
      if (left <= 0) {
        holdReqRef.current += 1;
        holdActiveRef.current = false;
        setHoldUntil(0);
        setHoldSec(0);
        setSlot(null);
        setError('Session expired! Your 2-minute slot reservation timed out. Please select your slot again.');
        toast.show('2-minute reservation expired');
        loadSlots();
        return false;
      }
      setHoldSec(left);
      return true;
    };
    if (!tick()) return;
    const id = setInterval(() => {
      if (!tick()) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [open, mode, holdUntil, loadSlots, toast]);

  async function selectSlot(s) {
    if (!s.free || bookingRef.current) return;
    if (slot === s.start && holdUntil > Date.now()) return;
    const reqId = ++holdReqRef.current;
    setHolding(true);
    setError('');
    try {
      const r = await api('/bookings/hold-slot', {
        method: 'POST',
        body: { slug: shop.slug, date, slotStart: s.start, serviceIds, partySize: count },
      });
      if (reqId !== holdReqRef.current) return;
      const until = Date.parse(r.hold.expiresAt) || Date.now() + (r.hold.ttlSec || 120) * 1000;
      holdActiveRef.current = true;
      setSlot(s.start);
      setHoldUntil(until);
      setHoldSec(Math.max(1, Math.ceil((until - Date.now()) / 1000)));
    } catch (e) {
      if (reqId !== holdReqRef.current) return;
      holdActiveRef.current = false;
      setHoldUntil(0);
      setHoldSec(0);
      setSlot(null);
      setError(e.message);
      loadSlots();
    } finally {
      if (reqId === holdReqRef.current) setHolding(false);
    }
  }

  function handleClose() {
    releaseHold();
    onClose();
  }

  async function book() {
    if (bookingRef.current || holding) return;
    if (forOther && !forName.trim()) {
      setError('Enter the name of the person you are booking for');
      return;
    }
    bookingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const body = {
        slug: shop.slug,
        type: mode,
        serviceIds,
        partySize: count,
        ...(forOther && forName.trim() ? { forName: forName.trim() } : {}),
        ...(mode === 'slot' ? { date, slotStart: slot } : {}),
      };
      const r = await api('/bookings', { method: 'POST', body });
      holdActiveRef.current = false;
      setHoldUntil(0);
      setHoldSec(0);
      toast.show(mode === 'queue' ? 'You are in the queue' : 'Slot booked');
      onClose();
      router.push(`/b/${r.booking.id}?new=1`);
    } catch (e) {
      setError(e.message);
      if (e.code === 'slot_taken' || e.code === 'already_booked') {
        holdActiveRef.current = false;
        setHoldUntil(0);
        setHoldSec(0);
        setSlot(null);
        loadSlots();
      }
    } finally {
      bookingRef.current = false;
      setBusy(false);
    }
  }

  const options = [
    acceptQueue && { value: 'queue', label: 'Join queue' },
    acceptSlots && { value: 'slot', label: 'Pick a slot' },
  ].filter(Boolean);
  const dates = Array.from({ length: advanceDays + 1 }, (_, i) => addDaysStr(shop.today.date, i));
  const timerLabel = `${String(Math.floor(holdSec / 60)).padStart(2, '0')}:${String(holdSec % 60).padStart(2, '0')}`;

  return (
    <Sheet open={open} onClose={handleClose} title={shop.name}>
      <div className="stack">
        {options.length > 1 && <Segmented value={mode} onChange={(v) => { if (v !== 'slot') releaseHold(); setMode(v); setError(''); }} options={options} />}

        <div className="list">
          {chosen.map((s) => (
            <div className="item" key={s.id}>
              <span className="grow">{s.name}<br /><span className="small muted">{mins(s.durationMin)}{count > 1 ? ` × ${count}` : ''}</span></span>
              <span className="num">{money(s.price * count)}</span>
            </div>
          ))}
          <div className="item" style={{ fontWeight: 600 }}>
            <span className="grow">Total · {mins(duration)}{count > 1 ? ` · ${count} people` : ''}</span>
            <span className="num">{total ? money(total) : ''}</span>
          </div>
        </div>

        <div className="card stack-sm" style={{ padding: '12px 14px' }}>
          <div className="row between" style={{ gap: 12 }}>
            <div>
              <b style={{ fontSize: 14 }}>People</b>
              <div className="small muted">Book together for family or friends</div>
            </div>
            <div style={{ width: 150, flex: 'none' }}>
              <Segmented
                value={partySize}
                onChange={(v) => { if (mode === 'slot') releaseHold(); setPartySize(v); setError(''); }}
                options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }]}
              />
            </div>
          </div>
          <div className="row between" style={{ gap: 12, paddingTop: 6, borderTop: '1px solid var(--border, #ececec)' }}>
            <div>
              <b style={{ fontSize: 14 }}>Book for someone else</b>
              <div className="small muted">Separate ticket in their name</div>
            </div>
            <Switch
              checked={forOther}
              onChange={(v) => { setForOther(v); if (!v) setForName(''); setError(''); }}
              label="Book for someone else"
            />
          </div>
          {forOther && (
            <Input
              label="Guest name"
              placeholder="e.g. Aarav / Dad"
              maxLength={40}
              value={forName}
              onChange={(e) => { setForName(e.target.value); setError(''); }}
            />
          )}
        </div>

        {mode === 'queue' && (
          <div className="card center stack-sm">
            {shop.today.state !== 'open' ? (
              <p className="muted">{shop.today.state === 'later' ? `The shop opens at ${time12(shop.today.opensAt)}. You can join the queue once it opens.` : 'The shop is closed right now.'}</p>
            ) : (
              <>
                <p className="small muted">Estimated wait if you join now</p>
                <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em' }} className="num">
                  {shop.queue ? (shop.queue.ahead === 0 ? 'No wait' : `~${mins(shop.queue.waitMin)}`) : '-'}
                </div>
                {shop.queue && shop.queue.ahead > 0 && <p className="small muted">{shop.queue.ahead} {shop.queue.ahead === 1 ? 'person is' : 'people are'} ahead of you</p>}
                {shop.queue?.delayNote && <p className="small">{shop.queue.delayNote}</p>}
              </>
            )}
          </div>
        )}

        {mode === 'slot' && (
          <div className="stack">
            <div className="dates">
              {dates.map((d) => {
                const dt = new Date(`${d}T00:00:00`);
                return (
                  <button key={d} className={cx('datebtn', d === date && 'on')} onClick={() => { if (d !== date) { releaseHold(); setSlot(null); setDate(d); } }} aria-pressed={d === date}>
                    <small>{dayLabel(d, shop.today.date) === 'Today' ? 'Today' : dt.toLocaleDateString('en-IN', { weekday: 'short' })}</small>
                    <b>{dt.getDate()}</b>
                    <small>{dt.toLocaleDateString('en-IN', { month: 'short' })}</small>
                  </button>
                );
              })}
            </div>
            {!avail && !error && <div className="slots">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} h={46} r={14} />)}</div>}
            {avail && !avail.open && <p className="muted center" style={{ padding: '18px 0' }}>{avail.reason || 'No slots on this day.'}</p>}
            {avail?.open && avail.slots.length === 0 && <p className="muted center" style={{ padding: '18px 0' }}>No more slots today. Try another day.</p>}
            {avail?.open && avail.slots.length > 0 && (
              <div className="slots" role="radiogroup" aria-label="Time slots">
                {avail.slots.map((s) => (
                  <button key={s.start} role="radio" aria-checked={slot === s.start} className={cx('slot', slot === s.start && 'on')} disabled={!s.free || holding} onClick={() => selectSlot(s)}>
                    {time12(s.time)}
                  </button>
                ))}
              </div>
            )}
            {slot != null && holdSec > 0 && (
              <div
                role="status"
                className="row between"
                style={{
                  padding: '10px 14px',
                  borderRadius: 12,
                  background: holdSec <= 20 ? 'rgba(239, 68, 68, 0.10)' : 'rgba(255, 92, 0, 0.08)',
                  border: `1px solid ${holdSec <= 20 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 92, 0, 0.25)'}`,
                  gap: 10,
                }}
              >
                <span className="small" style={{ fontWeight: 500 }}>
                  Slot reserved for you — confirm before time runs out
                </span>
                <span className="num" style={{ fontWeight: 700, fontSize: 15, color: holdSec <= 20 ? '#dc2626' : 'var(--accent, #ff5c00)' }}>
                  {timerLabel}
                </span>
              </div>
            )}
            {avail?.note && <p className="small muted center">{avail.note}</p>}
          </div>
        )}

        {error && <p className="err-text center" role="alert">{error}</p>}

        <Button block loading={busy || holding} onClick={book} disabled={(mode === 'slot' && slot == null) || (mode === 'queue' && shop.today.state !== 'open') || chosen.length === 0 || holding}>
          {mode === 'queue' ? 'Join the queue' : slot != null ? `Book ${dayLabel(date, shop.today.date)} at ${time12(`${String(Math.floor(slot / 60)).padStart(2, '0')}:${String(slot % 60).padStart(2, '0')}`)}` : 'Pick a time'}
        </Button>
      </div>
    </Sheet>
  );
}
