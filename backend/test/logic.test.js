import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDay, capacityOn, buildSlots, openStatus } from '../src/services/schedule.js';
import { queueDecision, estimateQueue } from '../src/services/queue.js';
import { addDays, weekdayOf, isValidDateStr } from '../src/utils/time.js';

const weekly = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day, open: day !== 0, intervals: day !== 0 ? [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }] : [],
}));
const shop = (extra = {}) => ({
  timezone: 'Asia/Kolkata', weekly, overrides: [], staff: [],
  settings: { slotIntervalMin: 30, maxQueue: 3, graceMin: 5, advanceDays: 7, acceptQueue: true, acceptSlots: true, queuePaused: false, delayMin: 0 },
  ...extra,
});
// 2026-11-09 is a Monday, 2026-11-08 a Sunday
const MON = '2026-11-09';
const SUN = '2026-11-08';

test('date helpers', () => {
  assert.equal(weekdayOf(MON), 1);
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.ok(isValidDateStr('2028-02-29'));
  assert.ok(!isValidDateStr('2026-02-30'));
});

test('weekly schedule and lunch break', () => {
  assert.equal(resolveDay(shop(), SUN).open, false);
  const d = resolveDay(shop(), MON);
  assert.equal(d.intervals.length, 2);
  assert.equal(d.intervals[1].start, 14 * 60);
});

test('override closes a normal day and opens a normal off day', () => {
  const s = shop({ overrides: [{ date: MON, closed: true, intervals: [], note: 'Festival' }, { date: SUN, closed: false, intervals: [{ start: '10:00', end: '12:00' }] }] });
  assert.equal(resolveDay(s, MON).open, false);
  assert.equal(resolveDay(s, MON).note, 'Festival');
  assert.equal(resolveDay(s, SUN).open, true);
});

test('staff off days and dates reduce capacity', () => {
  const s = shop({ staff: [
    { name: 'A', active: true, offDays: [], offDates: [] },
    { name: 'B', active: true, offDays: [1], offDates: [] },
    { name: 'C', active: true, offDays: [], offDates: [MON] },
  ] });
  assert.equal(capacityOn(s, MON), 1);
  assert.equal(capacityOn(s, '2026-11-10'), 3);
  assert.equal(capacityOn(shop(), MON), 1);
});

test('slots skip the lunch break, respect capacity and the past', () => {
  const now = { date: MON, minutes: 9 * 60 + 40 };
  const booked = [{ type: 'slot', status: 'waiting', slotStart: 10 * 60, durationMin: 30 }];
  const r = buildSlots(shop(), MON, booked, 30, now);
  const times = r.slots.map((x) => x.time);
  assert.ok(!times.includes('09:30'), 'past slot hidden');
  assert.ok(!times.includes('13:00'), 'lunch hidden');
  assert.equal(r.slots.find((x) => x.time === '10:00').free, false);
  assert.equal(r.slots.find((x) => x.time === '10:30').free, true);
  const two = buildSlots(shop({ staff: [{ name: 'A', active: true, offDays: [], offDates: [] }, { name: 'B', active: true, offDays: [], offDates: [] }] }), MON, booked, 30, now);
  assert.equal(two.slots.find((x) => x.time === '10:00').free, true);
});

test('slot booking window', () => {
  const now = { date: MON, minutes: 600 };
  assert.equal(buildSlots(shop(), addDays(MON, 20), [], 30, now).open, false);
  assert.equal(buildSlots(shop(), addDays(MON, -1), [], 30, now).open, false);
});

test('queue ETA divides work across barbers', () => {
  const now = { date: MON, minutes: 10 * 60 };
  const q = [
    { type: 'queue', status: 'waiting', durationMin: 20, token: 1 },
    { type: 'queue', status: 'waiting', durationMin: 20, token: 2 },
  ];
  assert.equal(estimateQueue(shop(), q, now).waitMin, 40);
  const two = shop({ staff: [{ name: 'A', active: true, offDays: [], offDates: [] }, { name: 'B', active: true, offDays: [], offDates: [] }] });
  assert.equal(estimateQueue(two, q, now).waitMin, 20);
  assert.equal(estimateQueue(shop({ settings: { ...shop().settings, delayMin: 10 } }), q, now).waitMin, 50);
});

test('queue auto-cutoff, max length, closed and paused', () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ type: 'queue', status: 'waiting', durationMin: 20, token: i + 1 }));
  assert.equal(queueDecision(shop(), [], 20, { date: MON, minutes: 600 }).ok, true);
  assert.equal(queueDecision(shop(), mk(3), 20, { date: MON, minutes: 600 }).ok, false, 'max queue');
  const late = queueDecision(shop(), mk(2), 20, { date: MON, minutes: 12 * 60 + 30 });
  assert.equal(late.ok, false, 'cannot finish before lunch closes at 13:00');
  assert.equal(queueDecision(shop(), [], 20, { date: SUN, minutes: 600 }).ok, false, 'closed');
  assert.equal(queueDecision(shop({ settings: { ...shop().settings, queuePaused: true } }), [], 20, { date: MON, minutes: 600 }).ok, false);
  assert.equal(openStatus(shop(), { date: MON, minutes: 13 * 60 + 30 }).state, 'break');
});

test('queue ETA accounts for upcoming slot bookings during wait window (B1/L1)', () => {
  const now = { date: MON, minutes: 10 * 60 };
  const bookings = [
    { type: 'queue', status: 'waiting', durationMin: 20, token: 1 },
    // Slot booked at 10:20 (within the wait window) for 30 minutes
    { type: 'slot', status: 'waiting', slotStart: 10 * 60 + 20, durationMin: 30, token: 2 },
  ];
  // 1 chair: queue (20) + slot (30) = 50 min wait
  assert.equal(estimateQueue(shop(), bookings, now).waitMin, 50);
});

test('buildSlots accounts for serving queue customers and early done slots (L1/L6)', () => {
  const now = { date: MON, minutes: 9 * 60 + 40 };
  // A walk-in started at 09:50 for 30 min (serving until 10:20)
  const startedAt = new Date();
  startedAt.setHours(9, 50, 0, 0);
  const queueServing = [
    { type: 'queue', status: 'serving', startedAt, durationMin: 30 },
  ];
  const r = buildSlots(shop(), MON, queueServing, 30, now);
  // 10:00 slot overlaps with 09:50-10:20 walk-in, so free should be false
  assert.equal(r.slots.find((x) => x.time === '10:00').free, false);
  // 10:30 slot starts after walk-in finish, so free should be true
  assert.equal(r.slots.find((x) => x.time === '10:30').free, true);

  // L6: slot finished early at 10:15 instead of 10:45
  const slotStarted = new Date();
  slotStarted.setHours(10, 0, 0, 0);
  const slotCompleted = new Date();
  slotCompleted.setHours(10, 15, 0, 0);
  const slotDoneEarly = [
    { type: 'slot', status: 'done', slotStart: 10 * 60, durationMin: 45, startedAt: slotStarted, completedAt: slotCompleted },
  ];
  const r2 = buildSlots(shop(), MON, slotDoneEarly, 30, now);
  // Because it was marked done at 10:15, 10:30 slot should be free!
  assert.equal(r2.slots.find((x) => x.time === '10:30').free, true);
});
