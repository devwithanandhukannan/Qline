import { hhmmToMin, weekdayOf, nowInZone, addDays, daysBetween, minToHHMM } from '../utils/time.js';

const toIntervals = (list = []) =>
  list
    .map((i) => ({ start: hhmmToMin(i.start), end: hhmmToMin(i.end) }))
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

// Opening hours for a date: a date override always wins over the weekly pattern.
export function resolveDay(shop, dateStr) {
  const override = (shop.overrides || []).find((o) => o.date === dateStr);
  if (override) {
    const intervals = override.closed ? [] : toIntervals(override.intervals);
    return { open: intervals.length > 0, intervals, note: override.note || '', source: 'override' };
  }
  const wk = (shop.weekly || []).find((d) => d.day === weekdayOf(dateStr));
  if (!wk || !wk.open) return { open: false, intervals: [], note: '', source: 'weekly' };
  const intervals = toIntervals(wk.intervals);
  return { open: intervals.length > 0, intervals, note: '', source: 'weekly' };
}

// How many chairs/barbers/tables are working on a date. No staff/tables configured = 1.
export function capacityOn(shop, dateStr) {
  if (shop.category === 'cafe' && shop.tables?.length) {
    const activeTables = shop.tables.filter((t) => t.active);
    return Math.max(1, activeTables.length);
  }
  const staff = shop.staff || [];
  if (staff.length === 0) return 1;
  const dow = weekdayOf(dateStr);
  return staff.filter((s) => s.active && !(s.offDays || []).includes(dow) && !(s.offDates || []).includes(dateStr)).length;
}

// Is the shop taking people right now, and until when?
export function openStatus(shop, now = nowInZone(shop.timezone)) {
  const day = resolveDay(shop, now.date);
  const cap = capacityOn(shop, now.date);
  if (!day.open || cap === 0) return { state: 'closed', reason: day.note || 'Closed today', closesAt: null, opensAt: nextOpening(shop, now) };
  const current = day.intervals.find((i) => now.minutes >= i.start && now.minutes < i.end);
  if (current) return { state: 'open', closesAt: current.end, capacity: cap, note: day.note };
  const upcoming = day.intervals.find((i) => i.start > now.minutes);
  if (upcoming) return { state: 'later', opensAtMin: upcoming.start, capacity: cap, note: day.note };
  return { state: 'closed', reason: 'Closed for today', closesAt: null, opensAt: nextOpening(shop, now) };
}

function nextOpening(shop, now) {
  for (let i = 1; i <= 14; i++) {
    const d = addDays(now.date, i);
    const day = resolveDay(shop, d);
    if (day.open && capacityOn(shop, d) > 0) return { date: d, time: minToHHMM(day.intervals[0].start) };
  }
  return null;
}

// Exact peak concurrency within [start, start + durationMin) using a sweep-line over clamped intervals.
// Consecutive bookings (e.g. [10:00, 10:30) and [10:30, 11:00)) give peak = 1, not 2.
export function peakConcurrent(bookings, start, durationMin) {
  const end = start + durationMin;
  const events = [];
  for (const b of bookings) {
    if (b.slotStart < end && start < b.slotStart + b.durationMin) {
      events.push([Math.max(start, b.slotStart), 1], [Math.min(end, b.slotStart + b.durationMin), -1]);
    }
  }
  if (!events.length) return 0;
  // Process endings (-1) before starts (+1) at identical timestamps
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let peak = 0;
  for (const [, delta] of events) {
    cur += delta;
    if (cur > peak) peak = cur;
  }
  return peak;
}

// Bookable time slots for a date given existing slot bookings and active temporary holds.
export function buildSlots(shop, dateStr, bookings, durationMin, now = nowInZone(shop.timezone), activeHolds = []) {
  const { slotIntervalMin, advanceDays } = shop.settings;
  const diff = daysBetween(now.date, dateStr);
  if (diff < 0 || diff > advanceDays) return { open: false, slots: [], reason: 'Date is outside the booking window' };
  const day = resolveDay(shop, dateStr);
  const cap = capacityOn(shop, dateStr);
  if (!day.open || cap === 0) return { open: false, slots: [], reason: day.note || 'Closed on this day' };

  const active = [
    ...bookings.filter((b) => b.type === 'slot' && ['waiting', 'serving', 'done'].includes(b.status)),
    ...activeHolds,
  ];
  const slots = [];
  for (const iv of day.intervals) {
    for (let t = iv.start; t + durationMin <= iv.end; t += slotIntervalMin) {
      if (diff === 0 && t < now.minutes + 5) continue;
      const taken = peakConcurrent(active, t, durationMin);
      slots.push({ time: minToHHMM(t), start: t, free: taken < cap, left: Math.max(0, cap - taken) });
    }
  }
  return { open: true, slots, capacity: cap, note: day.note };
}

export function canTakeSlot(shop, dateStr, start, durationMin, bookings, now, activeHolds = [], currentCustomerId = null) {
  const holds = currentCustomerId
    ? activeHolds.filter((h) => String(h.customer) !== String(currentCustomerId))
    : activeHolds;
  const r = buildSlots(shop, dateStr, bookings, durationMin, now, holds);
  const s = r.slots.find((x) => x.start === start);
  return !!s && s.free;
}
