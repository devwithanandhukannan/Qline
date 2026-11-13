'use client';
import { useCallback, useEffect, useState } from 'react';
import Shell, { useShop } from '@/components/Shell';
import { Button, Empty, Input, Segmented, Sheet, cx, useConfirm, useToast } from '@/components/ui';
import { CalendarGridSkeleton, DaySheetSkeleton } from '@/components/Skeletons';
import { Calendar as CalIcon, ChevronLeft, Chevron, Plus, Trash } from '@/components/icons';
import { api } from '@/lib/api';
import { addDaysStr, longDate, shortDate, time12 } from '@/lib/format';

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const monthLabel = (m) => new Date(`${m}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
const shiftMonth = (m, n) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

function Calendar() {
  const { shop, reload } = useShop();
  const [month, setMonth] = useState(null);
  const [cal, setCal] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState(null);

  const load = useCallback(async (m) => {
    try {
      setCal(await api(`/org/calendar?month=${m}`));
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    // first load: ask for the current month (server tells us today in the shop's timezone)
    if (month) return;
    const guess = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 7);
    setMonth(guess);
  }, [month]);

  useEffect(() => {
    if (month) {
      setCal(null);
      load(month);
    }
  }, [month, load]);

  const today = cal?.today;
  const first = cal ? new Date(`${cal.days[0].date}T00:00:00Z`).getUTCDay() : 0;
  const upcoming = (shop?.overrides || []).filter((o) => today && o.date >= today && o.date <= addDaysStr(today, 60));

  return (
    <div className="stack-lg">
      <div className="row between enter">
        <h1>Calendar</h1>
        <div className="row" style={{ gap: 6 }}>
          <Button variant="secondary" className="icon" onClick={() => month && setMonth(shiftMonth(month, -1))} aria-label="Previous month"><ChevronLeft /></Button>
          <Button variant="secondary" size="sm" onClick={() => setMonth(new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 7))}>Today</Button>
          <Button variant="secondary" className="icon" onClick={() => month && setMonth(shiftMonth(month, 1))} aria-label="Next month"><Chevron /></Button>
        </div>
      </div>

      <div className="stack-sm">
        <h2 aria-live="polite">{month ? monthLabel(month) : ''}</h2>
        {error && <p className="err-text">{error}</p>}
        {!cal ? (
          <CalendarGridSkeleton />
        ) : (
          <div className="cal enter" role="grid" aria-label={monthLabel(month)}>
            {DOW.map((d, i) => <div key={i} className="dow">{d}</div>)}
            {Array.from({ length: first }, (_, i) => <button key={`b${i}`} className="blank" tabIndex={-1} aria-hidden="true" />)}
            {cal.days.map((d) => (
              <button
                key={d.date}
                className={cx(!d.open && 'off', d.date === today && 'today', d.hasOverride && 'ovr', sel === d.date && 'sel')}
                onClick={() => setSel(d.date)}
                aria-label={`${longDate(d.date)}, ${d.total} bookings${d.open ? '' : ', closed'}${d.hasOverride ? ', changed hours' : ''}`}
              >
                {Number(d.date.slice(8))}
                {d.total > 0 ? <small>{d.total}</small> : <small>&nbsp;</small>}
              </button>
            ))}
          </div>
        )}
        <div className="row small muted" style={{ gap: 16, paddingTop: 4 }}>
          <span className="row" style={{ gap: 6 }}><span className="dot warn" /> Changed day</span>
          <span>Dashed = closed</span>
        </div>
      </div>

      <section className="stack-sm">
        <div className="section-title">Upcoming changes</div>
        {upcoming.length === 0 ? (
          <div className="list"><Empty icon={<CalIcon />} title="No special days">Tap any date above to close it or set custom hours.</Empty></div>
        ) : (
          <div className="list">
            {upcoming.map((o) => (
              <button key={o.date} className="item" onClick={() => setSel(o.date)}>
                <div className="grow">
                  <b>{longDate(o.date)}</b>
                  <div className="small muted">
                    {o.closed ? 'Closed' : o.intervals.map((i) => `${time12(i.start)} to ${time12(i.end)}`).join(', ')}
                    {o.note ? ` · ${o.note}` : ''}
                  </div>
                </div>
                <Chevron width="18" height="18" className="faint" />
              </button>
            ))}
          </div>
        )}
      </section>

      <DaySheet
        date={sel}
        today={today}
        override={sel ? (shop?.overrides || []).find((o) => o.date === sel) : null}
        onClose={() => setSel(null)}
        onChanged={async () => {
          await reload();
          load(month);
        }}
      />
    </div>
  );
}

function DaySheet({ date, today, override, onClose, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [info, setInfo] = useState(null);
  const [mode, setMode] = useState('closed');
  const [ranges, setRanges] = useState([{ start: '09:00', end: '18:00' }]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [shown, setShown] = useState(date);
  const past = date && today && date < today;

  useEffect(() => {
    if (date) setShown(date);
  }, [date]);

  useEffect(() => {
    if (!date) return;
    setInfo(null);
    setErr('');
    api(`/org/day?date=${date}`).then(setInfo).catch((e) => setErr(e.message));
  }, [date]);

  useEffect(() => {
    if (!date) return;
    if (override) {
      setMode(override.closed ? 'closed' : 'hours');
      setRanges(override.intervals.length ? override.intervals : [{ start: '09:00', end: '18:00' }]);
      setNote(override.note || '');
    } else {
      setMode('closed');
      setNote('');
      setRanges(info?.intervals?.length ? info.intervals.slice(0, 2) : [{ start: '09:00', end: '18:00' }]);
    }
  }, [date, override, info]);

  const setR = (i, k, v) => setRanges(ranges.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  async function save() {
    setErr('');
    if (mode === 'hours' && ranges.some((r) => !r.start || !r.end || r.start >= r.end)) return setErr('End time must be after start time');
    setBusy(true);
    try {
      await api('/org/shop/overrides', { method: 'POST', body: { date, closed: mode === 'closed', intervals: mode === 'closed' ? [] : ranges, note: note.trim() } });
      toast.show(mode === 'closed' ? 'Day marked closed' : 'Custom hours saved');
      await onChanged();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const ok = await confirm({ title: 'Remove this change?', message: `${longDate(date)} goes back to your normal weekly hours.`, confirmText: 'Remove', destructive: true });
    if (!ok) return;
    try {
      await api(`/org/shop/overrides/${date}`, { method: 'DELETE' });
      toast.show('Back to normal hours');
      await onChanged();
      onClose();
    } catch (e) {
      toast.error(e.message);
    }
  }

  return (
    <Sheet open={!!date} onClose={onClose} title={shown ? shortDate(shown) : ''}>
      {!info && !err ? (
        <DaySheetSkeleton />
      ) : (
        <div className="stack">
          {info && (
            <div className="row wrap" style={{ gap: 8 }}>
              <span className="pill"><span className={cx('dot', info.open ? 'ok' : 'bad')} /> {info.open ? info.intervals.map((i) => `${time12(i.start)} to ${time12(i.end)}`).join(', ') : 'Closed'}</span>
              {info.open && <span className="pill">{info.capacity} {info.capacity === 1 ? 'chair' : 'chairs'}</span>}
              {info.note && <span className="pill">{info.note}</span>}
            </div>
          )}

          {info && (
            <section className="stack-sm">
              <div className="section-title">Bookings · {info.bookings.length}</div>
              {info.bookings.length === 0 ? (
                <p className="muted small" style={{ padding: '0 6px' }}>No bookings yet.</p>
              ) : (
                <div className="list">
                  {info.bookings.map((b) => (
                    <div key={b.id} className="item">
                      <div className="token soft" style={{ width: 38, height: 38, fontSize: 15 }}>{b.token}</div>
                      <div className="grow">
                        <b>{b.name}</b>
                        <div className="small muted">{b.slotTime ? `${time12(b.slotTime)} · ` : ''}{b.services.join(', ')}</div>
                      </div>
                      <span className={cx('tag', b.status === 'no_show' && 'bad')}>{b.status.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {past ? (
            <p className="muted small center">This day has passed, so it can not be changed.</p>
          ) : (
            <section className="stack">
              <div className="section-title" style={{ paddingBottom: 0 }}>Change this day</div>
              <Segmented value={mode} onChange={setMode} options={[{ value: 'closed', label: 'Close this day' }, { value: 'hours', label: 'Custom hours' }]} />
              {mode === 'hours' && (
                <div className="stack-sm">
                  {ranges.map((r, i) => (
                    <div className="timepair" key={i}>
                      <input className="input" type="time" aria-label="Opens" value={r.start} onChange={(e) => setR(i, 'start', e.target.value)} />
                      <span className="muted">to</span>
                      <input className="input" type="time" aria-label="Closes" value={r.end} onChange={(e) => setR(i, 'end', e.target.value)} />
                      {ranges.length > 1 && <button className="ico-btn" aria-label="Remove time range" onClick={() => setRanges(ranges.filter((_, j) => j !== i))}><Trash /></button>}
                    </div>
                  ))}
                  {ranges.length < 2 && (
                    <Button variant="secondary" size="sm" onClick={() => setRanges([...ranges, { start: '16:00', end: '20:00' }])} style={{ alignSelf: 'flex-start' }}><Plus width="16" height="16" /> Add a second range</Button>
                  )}
                </div>
              )}
              <Input label="Note for customers (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} placeholder={mode === 'closed' ? 'e.g. Festival holiday' : 'e.g. Half day'} />
              {err && <span className="err-text">{err}</span>}
              <Button block onClick={save} loading={busy}>{override ? 'Update this day' : 'Save'}</Button>
              {override && <Button block variant="danger-soft" onClick={remove}>Remove override</Button>}
            </section>
          )}
          {past && err && <span className="err-text">{err}</span>}
        </div>
      )}
    </Sheet>
  );
}

export default function Page() {
  return (
    <Shell>
      <Calendar />
    </Shell>
  );
}
