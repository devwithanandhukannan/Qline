'use client';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Shell, { useShop } from '@/components/Shell';
import { Button, Empty, Input, Sheet, Switch, cx, useConfirm, useToast } from '@/components/ui';
import { DashboardSkeleton } from '@/components/Skeletons';
import { Check, Clock, Phone, Play, Plus, Qr, Users, X } from '@/components/icons';
import { api, ApiError } from '@/lib/api';
import { mins, time12 } from '@/lib/format';

const STATUS_TEXT = { waiting: 'Waiting', serving: 'In the chair', done: 'Done', no_show: 'No-show', cancelled: 'Cancelled' };

function Row({ b, onAction, busy }) {
  const live = b.status === 'waiting' || b.status === 'serving';
  return (
    <div className={cx('qrow', b.status === 'serving' && 'serving')}>
      <div className={cx('token', !live && 'soft')}>{b.token}</div>
      <div className="grow stack-sm" style={{ gap: 2 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <b style={{ fontSize: 17 }}>{b.name}</b>
          {b.partySize > 1 && <span className="tag">{b.partySize} people</span>}
          {b.steppedBackCount > 0 && <span className="tag">Stepped back</span>}
          {b.isWalkin && <span className="tag">Walk-in</span>}
          {b.type === 'slot' && b.slotTime && <span className="tag">Slot {time12(b.slotTime)}</span>}
          {b.noShowCount >= 2 && <span className="tag warn">{b.noShowCount} no-shows</span>}
          {!live && <span className={cx('tag', b.status === 'no_show' && 'bad')}>{STATUS_TEXT[b.status]}</span>}
        </div>
        <div className="small muted">{b.services.join(', ')} · {mins(b.durationMin)}</div>
        {b.phone && (
          <a href={`tel:${b.phone}`} className="small row" style={{ gap: 6, width: 'fit-content' }}>
            <Phone width="14" height="14" /> {b.phone}
          </a>
        )}
        {live && (
          <div className="qactions">
            {b.status === 'waiting' && (
              <Button size="sm" onClick={() => onAction(b, 'start')} loading={busy === b.id + 'start'}><Play width="14" height="14" /> Start</Button>
            )}
            {b.status === 'serving' && (
              <Button size="sm" onClick={() => onAction(b, 'done')} loading={busy === b.id + 'done'}><Check width="16" height="16" /> Done</Button>
            )}
            {b.status === 'waiting' && <Button size="sm" variant="secondary" onClick={() => onAction(b, 'no_show')}>No-show</Button>}
            <Button size="sm" variant="ghost" onClick={() => onAction(b, 'cancel')}>Cancel</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard() {
  const { shop } = useShop();
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [walkin, setWalkin] = useState(false);
  const [late, setLate] = useState(false);
  const [welcome, setWelcome] = useState(params.get('welcome') === '1');
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      setData(await api('/org/queue'));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
    const tick = () => document.visibilityState === 'visible' && load();
    timer.current = setInterval(tick, 8000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer.current);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  async function act(b, action) {
    if (action === 'no_show' || action === 'cancel') {
      const ok = await confirm({
        title: action === 'no_show' ? `Mark ${b.name} as no-show?` : `Cancel ${b.name}'s booking?`,
        message: action === 'no_show' ? 'This counts against the customer and frees up the queue.' : 'They will be removed from the queue.',
        confirmText: action === 'no_show' ? 'Mark no-show' : 'Cancel booking',
        cancelText: 'Keep',
        destructive: true,
      });
      if (!ok) return;
    }
    setBusy(b.id + action);
    try {
      await api(`/org/bookings/${b.id}/action`, { method: 'POST', body: { action } });
      await load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy('');
    }
  }

  async function togglePause(v) {
    setData((d) => ({ ...d, settings: { ...d.settings, queuePaused: v } }));
    try {
      await api('/org/queue/pause', { method: 'POST', body: { paused: v } });
      toast.show(v ? 'Queue paused. New customers cannot join.' : 'Queue is open again');
    } catch (e) {
      toast.error(e.message);
      load();
    }
  }

  async function clearDelay() {
    try {
      await api('/org/queue/delay', { method: 'POST', body: { delayMin: 0, note: '' } });
      toast.show('Delay cleared');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  if (error && !data) {
    return (
      <div className="card center stack">
        <p className="muted">{error}</p>
        <Button variant="secondary" onClick={load} style={{ alignSelf: 'center' }}>Try again</Button>
      </div>
    );
  }
  if (!data) {
    return <DashboardSkeleton />;
  }

  const { status, settings, summary, bookings } = data;
  const orderOf = (x) => x.queueOrder ?? x.token * 100;
  const live = bookings
    .filter((b) => b.status === 'serving' || b.status === 'waiting')
    .sort((a, b) => (a.status === b.status ? orderOf(a) - orderOf(b) || a.token - b.token : a.status === 'serving' ? -1 : 1));
  const past = bookings.filter((b) => !['serving', 'waiting'].includes(b.status)).sort((a, b) => b.token - a.token);
  const stateText = status.state === 'open' ? `Open until ${time12(status.closesAt)}` : status.state === 'later' ? 'Opens later today' : status.note || 'Closed today';

  return (
    <div className="stack-lg">
      <div className="stack">
        <div className="row between wrap enter">
          <div className="stack-sm" style={{ gap: 6 }}>
            <h1>Today</h1>
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="pill"><span className={cx('dot', status.state === 'open' ? 'ok pulse' : 'bad')} /> {stateText}</span>
              <span className="pill"><Users width="16" height="16" /> {status.capacity} {status.capacity === 1 ? 'chair' : 'chairs'}</span>
            </div>
          </div>
          <div className="row wrap mob-actions">
            <Button variant="secondary" onClick={() => setLate(true)}><Clock width="18" height="18" /> Running late</Button>
            <Button onClick={() => setWalkin(true)}><Plus width="18" height="18" /> Add walk-in</Button>
          </div>
        </div>

        {shop && shop.isActive === false && (
          <div className="card row between enter" role="alert" style={{ background: 'color-mix(in srgb, var(--bad) 14%, var(--bg-2))' }}>
            <div className="stack-sm" style={{ gap: 2 }}>
              <b style={{ color: 'var(--bad)' }}>Shop turned off by platform admin</b>
              <span className="small muted">{shop.disabledReason || 'Your shop is hidden from customers and cannot accept new bookings right now.'}</span>
            </div>
          </div>
        )}

        {settings.delayMin > 0 && (
          <div className="card row between enter" style={{ background: 'color-mix(in srgb, var(--warn) 14%, var(--bg-2))' }}>
            <div className="stack-sm" style={{ gap: 2 }}>
              <b>Running {settings.delayMin} min late</b>
              <span className="small muted">{settings.delayNote || 'Customers can see the delay.'}</span>
            </div>
            <Button size="sm" variant="secondary" onClick={clearDelay}>Clear</Button>
          </div>
        )}

        <div className="grid four enter">
          <div className="kpi stat"><b>{summary.waiting}</b><span>Waiting</span></div>
          <div className="kpi stat"><b>{summary.serving}</b><span>In the chair</span></div>
          <div className="kpi stat"><b>{summary.done}</b><span>Done today</span></div>
          <div className="kpi stat"><b>{mins(summary.waitMin)}</b><span>Wait for next</span></div>
        </div>

        <div className="list enter">
          <div className="item">
            <div className="grow">
              <b>Accepting queue</b>
              <div className="small muted">Turn off to stop new people from joining for a while.</div>
            </div>
            <Switch checked={!settings.queuePaused} onChange={(v) => togglePause(!v)} label="Accepting queue" />
          </div>
        </div>
      </div>

      <section className="stack-sm">
        <div className="section-title">Queue · {live.length}</div>
        {live.length === 0 ? (
          <div className="list">
            <Empty icon={<Users />} title="Nobody waiting" action={<Link href="/settings#qr" className="btn secondary sm"><Qr width="16" height="16" /> Show my QR code</Link>}>
              Stick your QR code on the wall so customers can join the queue. Walk-ins can be added with the button above.
            </Empty>
          </div>
        ) : (
          <div className="list">
            {live.map((b) => <Row key={b.id} b={b} onAction={act} busy={busy} />)}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="stack-sm">
          <div className="section-title">Finished · {past.length}</div>
          <div className="list">{past.map((b) => <Row key={b.id} b={b} onAction={act} busy={busy} />)}</div>
        </section>
      )}

      <WalkinSheet open={walkin} onClose={() => setWalkin(false)} shop={shop} onDone={() => { setWalkin(false); load(); }} />
      <LateSheet open={late} onClose={() => setLate(false)} current={settings} onDone={() => { setLate(false); load(); }} />

      <Sheet open={welcome} onClose={() => { setWelcome(false); router.replace('/dashboard'); }} title="Your QR code is ready">
        <div className="stack">
          <p className="muted">Your shop is live. Print the wall poster and customers can scan it to join your queue.</p>
          <Link href="/settings#qr" className="btn block"><Qr width="18" height="18" /> Get my QR code</Link>
          <Button variant="ghost" block onClick={() => { setWelcome(false); router.replace('/dashboard'); }}>Later</Button>
        </div>
      </Sheet>
    </div>
  );
}

function WalkinSheet({ open, onClose, shop, onDone }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [ids, setIds] = useState([]);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);
  const services = (shop?.services || []).filter((s) => s.active);

  useEffect(() => {
    if (open) {
      setName('');
      setPhone('');
      setErr({});
      setIds(services.length === 1 ? [services[0].id] : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function save(e) {
    e.preventDefault();
    if (!ids.length) return setErr({ services: 'Pick at least one service' });
    const finalName = name.trim() || 'Anonymous';
    setBusy(true);
    try {
      const r = await api('/org/walkin', { method: 'POST', body: { name: finalName, phone: phone.trim(), serviceIds: ids } });
      toast.show(`Added as token ${r.token}`);
      onDone();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.fields : {});
      toast.error(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add walk-in">
      <form className="stack" onSubmit={save} noValidate>
        <Input label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} error={err.name} maxLength={80} placeholder="Customer name (defaults to Anonymous)" />
        <Input label="Phone (optional)" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={err.phone} maxLength={20} />
        <div className="field">
          <label>Services</label>
          <div className="row wrap" style={{ gap: 8 }}>
            {services.map((s) => (
              <button key={s.id} type="button" className={cx('chip', ids.includes(s.id) && 'on')} aria-pressed={ids.includes(s.id)} onClick={() => setIds(ids.includes(s.id) ? ids.filter((x) => x !== s.id) : [...ids, s.id])}>
                {s.name} · {mins(s.durationMin)}
              </button>
            ))}
          </div>
          {err.services && <span className="err-text">{err.services}</span>}
        </div>
        <Button block type="submit" loading={busy}>Add to queue</Button>
      </form>
    </Sheet>
  );
}

function LateSheet({ open, onClose, current, onDone }) {
  const toast = useToast();
  const [min, setMin] = useState(10);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setMin(current.delayMin || 10);
      setNote(current.delayNote || '');
    }
  }, [open, current.delayMin, current.delayNote]);

  async function save() {
    setBusy(true);
    try {
      await api('/org/queue/delay', { method: 'POST', body: { delayMin: min, note: note.trim() } });
      toast.show('Customers can now see the delay');
      onDone();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Running late">
      <div className="stack">
        <p className="muted small">Everyone waiting will see the extra time and your note.</p>
        <div className="row wrap" style={{ gap: 8 }}>
          {[5, 10, 15, 30].map((m) => (
            <button key={m} className={cx('chip', min === m && 'on')} onClick={() => setMin(m)} aria-pressed={min === m}>{m} min</button>
          ))}
        </div>
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder="e.g. Back from lunch at 2:30" />
        <Button block onClick={save} loading={busy}>Let customers know</Button>
      </div>
    </Sheet>
  );
}

export default function Page() {
  return (
    <Shell>
      <Suspense fallback={null}>
        <Dashboard />
      </Suspense>
    </Shell>
  );
}
