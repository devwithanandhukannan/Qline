'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import Shell, { useShop } from '@/components/Shell';
import { Button, Input, Switch, Textarea, cx, useConfirm, useToast } from '@/components/ui';
import { Download, Plus, Share, Trash, Pin } from '@/components/icons';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { mins } from '@/lib/format';
import { CATEGORIES } from '@/lib/categories';
import ShopImagesUpload from '@/components/ShopImagesUpload';
import ShopMapPicker from '@/components/ShopMapPicker';
import { PwaInstallCard } from '@/components/Pwa';

const CUSTOMER_URL = (process.env.NEXT_PUBLIC_CUSTOMER_URL || 'http://localhost:3000').replace(/\/$/, '');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


function useSave(reload) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState({});
  const run = async (fn, okMsg = 'Saved') => {
    setBusy(true);
    setErrs({});
    try {
      await fn();
      await reload();
      toast.show(okMsg);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrs(e.fields);
      toast.error(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, errs, run, setErrs };
}

/* ---------------- Profile ---------------- */
function Profile({ shop, reload }) {
  const toast = useToast();
  const { busy, errs, run } = useSave(reload);
  const [f, setF] = useState({ name: shop.name, category: shop.category, description: shop.description, phone: shop.phone, address: shop.address, area: shop.area, city: shop.city, lat: shop.lat ?? '', lng: shop.lng ?? '', isListed: shop.isListed, images: shop.images || [] });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    const body = { name: f.name.trim(), category: f.category, description: f.description.trim(), phone: f.phone.trim(), address: f.address.trim(), area: f.area.trim(), city: f.city.trim(), isListed: f.isListed, images: f.images || [] };
    if (f.lat !== '' && f.lng !== '') {
      body.lat = Number(f.lat);
      body.lng = Number(f.lng);
    }
    run(() => api('/org/shop', { method: 'PUT', body }));
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <Input label="Shop name" value={f.name} onChange={set('name')} error={errs.name} maxLength={80} />
      <div className="field">
        <label>Type</label>
        <div className="hscroll" role="radiogroup" aria-label="Shop type">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c.value}
              role="radio"
              aria-checked={f.category === c.value}
              className={cx('chip', f.category === c.value && 'on')}
              onClick={(e) => {
                setF({ ...f, category: c.value });
                e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <Textarea label="About" value={f.description} onChange={set('description')} error={errs.description} maxLength={400} />
      <ShopImagesUpload images={f.images} onChange={(imgs) => setF((prev) => ({ ...prev, images: imgs }))} />
      <Input label="Phone" type="tel" value={f.phone} onChange={set('phone')} error={errs.phone} maxLength={20} />
      <Input label="Address" value={f.address} onChange={set('address')} error={errs.address} maxLength={200} />
      <div className="grid two">
        <Input label="Area" value={f.area} onChange={set('area')} error={errs.area} maxLength={80} />
        <Input label="City" value={f.city} onChange={set('city')} error={errs.city} maxLength={80} />
      </div>
      <ShopMapPicker
        lat={f.lat}
        lng={f.lng}
        onChange={(lat, lng) => setF((prev) => ({ ...prev, lat, lng }))}
        onAddressFound={({ city, area, address }) =>
          setF((prev) => ({
            ...prev,
            city: prev.city || city,
            area: prev.area || area,
            address: prev.address || address,
          }))
        }
      />
      <div className="grid two">
        <Input label="Latitude" inputMode="decimal" value={f.lat} onChange={set('lat')} error={errs.lat} placeholder="Optional" />
        <Input label="Longitude" inputMode="decimal" value={f.lng} onChange={set('lng')} error={errs.lng} placeholder="Optional" />
      </div>
      <div className="list">
        <div className="item">
          <div className="grow"><b>Show in search</b><div className="small muted">Off hides your shop from search. The QR code still works.</div></div>
          <Switch checked={f.isListed} onChange={(v) => setF({ ...f, isListed: v })} label="Show in search" />
        </div>
      </div>
      <Button type="submit" block loading={busy}>Save profile</Button>
    </form>
  );
}

/* ---------------- Services ---------------- */
function Services({ shop, reload }) {
  const confirm = useConfirm();
  const { busy, errs, run } = useSave(reload);
  const [list, setList] = useState(shop.services.map((s) => ({ ...s, durationMin: String(s.durationMin), price: String(s.price || '') })));
  const upd = (i, k, v) => setList(list.map((s, j) => (j === i ? { ...s, [k]: v } : s)));

  async function remove(i) {
    if (list.length === 1) return;
    const ok = await confirm({ title: `Remove ${list[i].name || 'this service'}?`, message: 'It disappears for new bookings. Past bookings keep their records.', confirmText: 'Remove', destructive: true });
    if (ok) setList(list.filter((_, j) => j !== i));
  }

  function save() {
    const body = list.map((s) => ({ ...(s.id ? { _id: s.id } : {}), name: s.name.trim(), durationMin: Number(s.durationMin), price: Number(s.price) || 0, active: s.active }));
    if (body.some((s) => s.name.length < 2)) return run(async () => { throw new ApiError(400, { message: 'Every service needs a name' }); });
    run(() => api('/org/shop/services', { method: 'PUT', body: { services: body } }));
  }

  return (
    <div className="stack">
      <p className="muted small">Duration drives the wait time estimate and the slot lengths customers see.</p>
      <div className="list">
        {list.map((s, i) => (
          <div key={s.id || `n${i}`} className="item svc-row">
            <div className="svc-name">
              <input className="input" aria-label="Service name" value={s.name} onChange={(e) => upd(i, 'name', e.target.value)} maxLength={60} placeholder="Service name" />
            </div>
            <div className="svc-meta">
              <input className="input svc-num" aria-label="Minutes" inputMode="numeric" value={s.durationMin} onChange={(e) => upd(i, 'durationMin', e.target.value.replace(/\D/g, ''))} placeholder="Min" />
              <input className="input svc-num" aria-label="Price" inputMode="numeric" value={s.price} onChange={(e) => upd(i, 'price', e.target.value.replace(/\D/g, ''))} placeholder="₹" />
              <Switch checked={s.active} onChange={(v) => upd(i, 'active', v)} label="Available" />
              <button className="ico-btn" aria-label="Remove service" disabled={list.length === 1} onClick={() => remove(i)}><Trash /></button>
            </div>
          </div>
        ))}
      </div>
      {Object.values(errs).length > 0 && <span className="err-text">{Object.values(errs)[0]}</span>}
      <div className="row between wrap">
        <Button variant="secondary" size="sm" onClick={() => setList([...list, { name: '', durationMin: '20', price: '', active: true }])}><Plus width="16" height="16" /> Add service</Button>
        <span className="small muted">{list.filter((s) => s.active).length} active · {mins(list.filter((s) => s.active).reduce((a, s) => a + (Number(s.durationMin) || 0), 0))} total</span>
      </div>
      <Button block loading={busy} onClick={save}>Save services</Button>
    </div>
  );
}

/* ---------------- Hours ---------------- */
function Hours({ shop, reload }) {
  const { busy, run } = useSave(reload);
  const [week, setWeek] = useState(() => [...shop.weekly].sort((a, b) => a.day - b.day).map((d) => ({ ...d, intervals: d.intervals.map((i) => ({ ...i })) })));
  const [err, setErr] = useState('');
  const upd = (i, patch) => setWeek(week.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const setIv = (di, ii, k, v) => upd(di, { intervals: week[di].intervals.map((x, j) => (j === ii ? { ...x, [k]: v } : x)) });

  function toggle(i, open) {
    upd(i, { open, intervals: open && week[i].intervals.length === 0 ? [{ start: '09:00', end: '20:00' }] : week[i].intervals });
  }

  function copyAll(i) {
    const src = week[i];
    setWeek(week.map((d) => ({ ...d, open: src.open, intervals: src.intervals.map((x) => ({ ...x })) })));
  }

  function save() {
    for (const d of week) {
      if (!d.open) continue;
      const s = [...d.intervals].sort((a, b) => a.start.localeCompare(b.start));
      if (!s.length) return setErr(`${DAYS[d.day]}: add opening hours or switch the day off`);
      if (s.some((x) => !x.start || !x.end || x.start >= x.end)) return setErr(`${DAYS[d.day]}: closing time must be after opening time`);
      if (s.length > 1 && s[1].start < s[0].end) return setErr(`${DAYS[d.day]}: the two time ranges overlap`);
    }
    setErr('');
    run(() => api('/org/shop/schedule', { method: 'PUT', body: { weekly: week.map((d) => ({ day: d.day, open: d.open, intervals: d.open ? d.intervals : [] })) } }));
  }

  return (
    <div className="stack">
      <p className="muted small">Your normal week. Use a second range for a lunch break. For one-off changes use the Calendar tab.</p>
      <div className="list">
        {week.map((d, i) => (
          <div key={d.day} className="item" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
              <b>{DAYS[d.day]}</b>
              <div className="row" style={{ gap: 10 }}>
                {d.open && <button className="btn ghost sm" onClick={() => copyAll(i)}>Copy to all days</button>}
                <Switch checked={d.open} onChange={(v) => toggle(i, v)} label={`${DAYS[d.day]} open`} />
              </div>
            </div>
            {d.open && (
              <div className="stack-sm" style={{ width: '100%' }}>
                {d.intervals.map((iv, j) => (
                  <div className="timepair" key={j}>
                    <input className="input" type="time" aria-label={`${DAYS[d.day]} opens`} value={iv.start} onChange={(e) => setIv(i, j, 'start', e.target.value)} />
                    <span className="muted">to</span>
                    <input className="input" type="time" aria-label={`${DAYS[d.day]} closes`} value={iv.end} onChange={(e) => setIv(i, j, 'end', e.target.value)} />
                    {d.intervals.length > 1 && <button className="ico-btn" aria-label="Remove range" onClick={() => upd(i, { intervals: d.intervals.filter((_, k) => k !== j) })}><Trash /></button>}
                  </div>
                ))}
                {d.intervals.length < 2 && <button className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => upd(i, { intervals: [...d.intervals, { start: '16:00', end: '20:00' }] })}><Plus width="14" height="14" /> Add a break split</button>}
              </div>
            )}
          </div>
        ))}
      </div>
      {err && <span className="err-text" role="alert">{err}</span>}
      <Button block loading={busy} onClick={save}>Save hours</Button>
    </div>
  );
}

/* ---------------- Staff ---------------- */
function Staff({ shop, reload }) {
  const confirm = useConfirm();
  const { busy, run } = useSave(reload);
  const toWorkingDays = (offDays = []) => {
    const list = (offDays || []).map(Number);
    if (list.length >= 7) return [1, 2, 3, 4, 5, 6];
    return [0, 1, 2, 3, 4, 5, 6].filter((d) => !list.includes(d));
  };
  const [list, setList] = useState(
    (shop.staff || []).map((s) => ({
      ...s,
      active: s.active !== false,
      workingDays: toWorkingDays(s.offDays),
      offDates: [...(s.offDates || [])],
    }))
  );
  const [dateInput, setDateInput] = useState({});
  const upd = (i, patch) => setList(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

  async function remove(i) {
    const ok = await confirm({ title: `Remove ${list[i].name || 'this person'}?`, message: 'The number of chairs available will go down.', confirmText: 'Remove', destructive: true });
    if (ok) setList(list.filter((_, j) => j !== i));
  }
  function addDate(i) {
    const d = dateInput[i];
    if (!d || list[i].offDates.includes(d)) return;
    upd(i, { offDates: [...list[i].offDates, d].sort() });
    setDateInput({ ...dateInput, [i]: '' });
  }
  const save = () =>
    run(() =>
      api('/org/shop/staff', {
        method: 'PUT',
        body: {
          staff: list.map((s) => ({
            ...(s.id || s._id ? { _id: s.id || s._id } : {}),
            name: s.name.trim() || 'Staff',
            active: s.active !== false,
            offDays: [0, 1, 2, 3, 4, 5, 6].filter((d) => !s.workingDays.includes(d)),
            offDates: (s.offDates || []).filter((d) => d >= today),
          })),
        },
      })
    );

  return (
    <div className="stack">
      <p className="muted small">Each working person is one chair. If someone is off, customers see shorter capacity and longer waits automatically. With nobody listed, Qline assumes one chair.</p>
      {list.length === 0 && <div className="card center muted small">No staff added. Qline assumes 1 chair.</div>}
      {list.map((s, i) => (
        <div key={s.id || s._id || `n${i}`} className="card stack">
          <div className="row" style={{ gap: 10 }}>
            <input className="input grow" aria-label="Name" value={s.name} onChange={(e) => upd(i, { name: e.target.value })} maxLength={60} placeholder="Name" />
            <Switch checked={s.active} onChange={(v) => upd(i, { active: v })} label="Working" />
            <button className="ico-btn" aria-label="Remove staff" onClick={() => remove(i)}><Trash /></button>
          </div>
          <div className="stack-sm">
            <span className="small muted">Working days</span>
            <div className="hscroll">
              {SHORT.map((d, k) => {
                const isWorking = s.workingDays.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    className={cx('chip', isWorking && 'on')}
                    aria-pressed={isWorking}
                    onClick={() =>
                      upd(i, {
                        workingDays: isWorking
                          ? s.workingDays.filter((x) => x !== k)
                          : [...s.workingDays, k].sort(),
                      })
                    }
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="stack-sm">
            <span className="small muted">Time off on specific dates</span>
            <div className="row wrap" style={{ gap: 8 }}>
              {s.offDates.filter((d) => d >= today).map((d) => (
                <button key={d} className="chip on" aria-label={`Remove ${d}`} onClick={() => upd(i, { offDates: s.offDates.filter((x) => x !== d) })}>{new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ✕</button>
              ))}
            </div>
            <div className="timepair">
              <input className="input" type="date" min={today} aria-label="Add a day off" value={dateInput[i] || ''} onChange={(e) => setDateInput({ ...dateInput, [i]: e.target.value })} />
              <Button size="sm" variant="secondary" onClick={() => addDate(i)} disabled={!dateInput[i]}>Add</Button>
            </div>
          </div>
        </div>
      ))}
      <Button variant="secondary" size="sm" onClick={() => setList([...list, { name: '', active: true, workingDays: [1, 2, 3, 4, 5, 6], offDates: [] }])} style={{ alignSelf: 'flex-start' }}><Plus width="16" height="16" /> Add staff</Button>
      <Button block loading={busy} onClick={save}>Save staff</Button>
    </div>
  );
}

/* ---------------- Tables ---------------- */
function Tables({ shop, reload }) {
  const confirm = useConfirm();
  const { busy, run } = useSave(reload);
  const [list, setList] = useState((shop.tables || []).map((t) => ({ ...t })));
  const upd = (i, patch) => setList(list.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  async function remove(i) {
    const ok = await confirm({
      title: `Remove ${list[i].name || 'this table'}?`,
      message: 'This table will be removed from your cafe seating options.',
      confirmText: 'Remove',
      destructive: true,
    });
    if (ok) setList(list.filter((_, j) => j !== i));
  }

  const save = () =>
    run(() =>
      api('/org/shop/tables', {
        method: 'PUT',
        body: {
          tables: list.map((t) => ({
            ...(t.id ? { _id: t.id } : {}),
            name: t.name.trim() || 'Table',
            capacity: Number(t.capacity) || 2,
            active: t.active !== false,
          })),
        },
      })
    );

  return (
    <div className="stack">
      <p className="muted small">
        Tables and seating capacity for your cafe or restaurant. When table selection is enabled under Rules, customers see available tables filtered by party size.
      </p>
      {list.length === 0 && (
        <div className="card center muted small">No tables added yet. Add tables with their seating capacity (e.g. Table 1: 2-seater, Table 2: 4-seater).</div>
      )}
      {list.map((t, i) => (
        <div key={t.id || `t${i}`} className="card row" style={{ gap: 10, alignItems: 'center' }}>
          <input
            className="input grow"
            aria-label="Table name"
            value={t.name}
            onChange={(e) => upd(i, { name: e.target.value })}
            maxLength={60}
            placeholder="e.g. Table 1, Window Table"
          />
          <div style={{ width: 120, flex: 'none' }}>
            <input
              className="input"
              type="number"
              min={1}
              max={50}
              aria-label="Seats capacity"
              value={t.capacity}
              onChange={(e) => upd(i, { capacity: Number(e.target.value) || 1 })}
              placeholder="Seats"
            />
          </div>
          <Switch checked={t.active !== false} onChange={(v) => upd(i, { active: v })} label="Available" />
          <button className="ico-btn" aria-label="Remove table" onClick={() => remove(i)}>
            <Trash />
          </button>
        </div>
      ))}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setList([...list, { name: `Table ${list.length + 1}`, capacity: 4, active: true }])}
        style={{ alignSelf: 'flex-start' }}
      >
        <Plus width="16" height="16" /> Add table
      </Button>
      <Button block loading={busy} onClick={save}>
        Save tables
      </Button>
    </div>
  );
}

/* ---------------- Rules ---------------- */
function Rules({ shop, reload }) {
  const toast = useToast();
  const { busy, errs, run } = useSave(reload);
  const s0 = shop.settings;
  const [s, setS] = useState({
    acceptQueue: s0.acceptQueue,
    acceptSlots: s0.acceptSlots,
    enableTvScreen: !!s0.enableTvScreen,
    allowStaffSelection: !!s0.allowStaffSelection,
    allowTableSelection: !!s0.allowTableSelection,
    maxQueue: String(s0.maxQueue),
    slotIntervalMin: String(s0.slotIntervalMin),
    graceMin: String(s0.graceMin),
    advanceDays: String(s0.advanceDays),
  });
  const num = (k) => (e) => setS({ ...s, [k]: e.target.value.replace(/\D/g, '') });
  const [err, setErr] = useState('');
  const tvLink = `${CUSTOMER_URL}/tv/${shop.slug}`;

  function save() {
    if (!s.acceptQueue && !s.acceptSlots) return setErr('Keep at least one of queue or slot booking on');
    setErr('');
    run(() =>
      api('/org/shop/settings', {
        method: 'PUT',
        body: {
          acceptQueue: s.acceptQueue,
          acceptSlots: s.acceptSlots,
          enableTvScreen: s.enableTvScreen,
          allowStaffSelection: s.allowStaffSelection,
          allowTableSelection: s.allowTableSelection,
          maxQueue: Number(s.maxQueue),
          slotIntervalMin: Number(s.slotIntervalMin),
          graceMin: Number(s.graceMin),
          advanceDays: Number(s.advanceDays),
        },
      })
    );
  }

  async function copyTvLink() {
    try {
      await navigator.clipboard.writeText(tvLink);
      toast.show('TV display link copied');
    } catch {
      toast.error('Could not copy link');
    }
  }

  function toggleTv(v) {
    setS((cur) => ({ ...cur, enableTvScreen: v }));
    run(() => api('/org/shop/settings', { method: 'PUT', body: { enableTvScreen: v } }));
  }

  const isCafe = shop.category === 'cafe';
  const staffLabel = shop.category === 'clinic' ? 'doctors' : 'staff / stylist';
  const staffDesc = shop.category === 'clinic'
    ? 'Customers can select a specific doctor or choose First Available for the shortest wait.'
    : 'Customers can select a specific stylist or choose First Available for the shortest wait.';

  return (
    <div className="stack">
      <div className="list">
        <div className="item"><div className="grow"><b>Live queue</b><div className="small muted">Customers join today and see their turn live. Best for walk-in shops.</div></div><Switch checked={s.acceptQueue} onChange={(v) => setS({ ...s, acceptQueue: v })} label="Live queue" /></div>
        <div className="item"><div className="grow"><b>Slot booking</b><div className="small muted">Customers pick a time, today or in the coming days.</div></div><Switch checked={s.acceptSlots} onChange={(v) => setS({ ...s, acceptSlots: v })} label="Slot booking" /></div>
        {!isCafe && (
          <div className="item"><div className="grow"><b>Allow customers to choose {staffLabel}</b><div className="small muted">{staffDesc}</div></div><Switch checked={s.allowStaffSelection} onChange={(v) => setS({ ...s, allowStaffSelection: v })} label={`Allow ${staffLabel} selection`} /></div>
        )}
        {isCafe && (
          <div className="item"><div className="grow"><b>Enable table selection (for cafes / dining)</b><div className="small muted">Customers choose a table filtered by party size or choose First Available table.</div></div><Switch checked={s.allowTableSelection} onChange={(v) => setS({ ...s, allowTableSelection: v })} label="Enable table selection" /></div>
        )}
        <div className="item"><div className="grow"><b>Live TV / Counter display (optional)</b><div className="small muted">Public fullscreen screen showing Now Serving &amp; Up Next on a shop TV or tablet.</div></div><Switch checked={s.enableTvScreen} onChange={toggleTv} label="Live TV display" /></div>
      </div>
      {s.enableTvScreen && (
        <div className="card stack-sm">
          <b>Shop TV screen link</b>
          <span className="small muted" style={{ wordBreak: 'break-all' }}>{tvLink}</span>
          <div className="row wrap" style={{ gap: 8 }}>
            <Button type="button" variant="secondary" onClick={copyTvLink}>Copy link</Button>
            <a href={tvLink} target="_blank" rel="noopener noreferrer" className="btn secondary">Open TV screen</a>
          </div>
        </div>
      )}
      <Input label="Maximum people in the queue" inputMode="numeric" value={s.maxQueue} onChange={num('maxQueue')} error={errs.maxQueue} hint="New people are blocked once the queue is this long." />
      <Input label="Slot length step (minutes)" inputMode="numeric" value={s.slotIntervalMin} onChange={num('slotIntervalMin')} error={errs.slotIntervalMin} hint="Slots start every 10 to 240 minutes, for example every 30." />
      <Input label="Grace period (minutes)" inputMode="numeric" value={s.graceMin} onChange={num('graceMin')} error={errs.graceMin} hint="How long you wait for a customer after their turn before marking a no-show." />
      <Input label="Book how many days ahead" inputMode="numeric" value={s.advanceDays} onChange={num('advanceDays')} error={errs.advanceDays} hint="0 means today only." />
      <div className="card small muted">Qline also stops the queue by itself when the people waiting could not finish before closing time.</div>
      {err && <span className="err-text" role="alert">{err}</span>}
      <Button block loading={busy} onClick={save}>Save rules</Button>
    </div>
  );
}

/* ---------------- QR ---------------- */
function QrBlock({ shop }) {
  const toast = useToast();
  const link = `${CUSTOMER_URL}/s/${shop.slug}`;
  const [png, setPng] = useState('');
  useEffect(() => {
    QRCode.toDataURL(link, { width: 880, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } }).then(setPng).catch(() => {});
  }, [link]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.show('Link copied');
    } catch {
      toast.error('Could not copy. Long press the link instead.');
    }
  }
  async function share() {
    if (navigator.share) navigator.share({ title: shop.name, url: link }).catch(() => {});
    else copy();
  }

  return (
    <div className="stack">
      <div className="card center stack" style={{ alignItems: 'center' }}>
        <div style={{ background: '#fff', padding: 12, width: 'min(300px, 100%)' }}>
          {png ? <img src={png} alt={`QR code for ${shop.name}`} width="300" height="300" style={{ width: '100%', height: 'auto' }} /> : <div className="skeleton" style={{ aspectRatio: '1' }} />}
        </div>
        <div className="stack-sm"><b>{shop.name}</b><span className="small muted" style={{ wordBreak: 'break-all' }}>{link}</span></div>
      </div>
      <div className="grid two">
        <a className={cx('btn', !png && 'disabled')} href={png || '#'} download={`${shop.slug}-qr.png`} aria-disabled={!png}><Download width="18" height="18" /> Download PNG</a>
        <Button variant="secondary" onClick={() => window.print()}>Print wall poster</Button>
        <Button variant="secondary" onClick={copy}>Copy link</Button>
        <Button variant="secondary" onClick={share}><Share width="18" height="18" /> Share</Button>
      </div>
      <p className="muted small">Print it, stick it near the entrance or the waiting area. Customers scan with their phone camera and land straight on your shop. No app needed.</p>
      <div className="poster" aria-hidden="true">
        <h1>{shop.name}</h1>
        <p>Scan to join the queue</p>
        {png && <img src={png} alt="" />}
        <p style={{ fontSize: 18, opacity: 0.6 }}>Powered by Qline</p>
      </div>
    </div>
  );
}

/* ---------------- Account ---------------- */
function Account() {
  const { user, logout } = useAuth();
  const confirm = useConfirm();
  const router = useRouter();
  async function out() {
    const ok = await confirm({ title: 'Sign out?', message: 'You can sign back in with a code sent to your email.', confirmText: 'Sign out', destructive: true });
    if (!ok) return;
    await logout();
    router.replace('/');
  }
  return (
    <div className="stack">
      <div className="list">
        <div className="item"><span className="muted grow">Name</span><b>{user?.name}</b></div>
        <div className="item"><span className="muted grow">Email</span><b style={{ wordBreak: 'break-all' }}>{user?.email}</b></div>
      </div>
      <PwaInstallCard />
      <Button variant="danger-soft" block onClick={out}>Sign out</Button>
    </div>
  );
}

function Settings() {
  const { shop, reload } = useShop();
  const [tab, setTab] = useState('profile');
  const top = useRef(null);

  const isCafe = shop?.category === 'cafe';
  const staffTitle = shop?.category === 'clinic' ? 'Doctors' : 'Staff';

  const sections = [
    ['profile', 'Profile'],
    ['services', 'Services'],
    ['hours', 'Hours'],
    !isCafe && ['staff', staffTitle],
    isCafe && ['tables', 'Tables'],
    ['rules', 'Rules'],
    ['qr', 'QR code'],
    ['account', 'Account'],
  ].filter(Boolean);

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.replace('#', '');
      if (sections.some(([id]) => id === h)) setTab(h);
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [sections]);

  useEffect(() => {
    if (!isCafe && tab === 'tables') setTab('profile');
    if (isCafe && tab === 'staff') setTab('profile');
  }, [isCafe, tab]);

  const go = useCallback((id) => {
    setTab(id);
    history.replaceState(null, '', `#${id}`);
  }, []);

  useEffect(() => {
    if (window.location.hash === '#qr') document.getElementById('qr')?.scrollIntoView({ block: 'start' });
    const activeBtn = document.querySelector('.nav-seg button.chip.on');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [tab]);

  const body = {
    profile: <Profile key="p" shop={shop} reload={reload} />,
    services: <Services key="s" shop={shop} reload={reload} />,
    hours: <Hours key="h" shop={shop} reload={reload} />,
    staff: !isCafe ? <Staff key="st" shop={shop} reload={reload} /> : null,
    tables: isCafe ? <Tables key="tb" shop={shop} reload={reload} /> : null,
    rules: <Rules key="r" shop={shop} reload={reload} />,
    qr: <QrBlock key="q" shop={shop} />,
    account: <Account key="a" />,
  }[tab];

  return (
    <div className="stack-lg" style={{ maxWidth: 680, width: '100%', minWidth: 0, margin: '0 auto' }} ref={top}>
      <h1 className="enter no-print">Settings</h1>
      <div className="hscroll nav-seg no-print" role="tablist" aria-label="Settings sections">
        {sections.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={cx('chip', tab === id && 'on')}
            onClick={(e) => {
              go(id);
              e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <section id={tab} className="enter" key={tab} style={{ scrollMarginTop: 70 }}>{body}</section>
      {tab !== 'account' && <div className="no-print"><PwaInstallCard /></div>}
    </div>
  );
}

export default function Page() {
  return (
    <Shell>
      <Settings />
    </Shell>
  );
}
