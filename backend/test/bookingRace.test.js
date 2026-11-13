import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSlots, canTakeSlot, peakConcurrent } from '../src/services/schedule.js';
import { withMemoryLock } from '../src/utils/lock.js';

const weekly = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  open: true,
  intervals: [{ start: '09:00', end: '18:00' }],
}));

const makeShop = (chairs = 1) => ({
  timezone: 'Asia/Kolkata',
  weekly,
  overrides: [],
  staff: Array.from({ length: chairs }, (_, i) => ({ name: `Chair ${i + 1}`, active: true, offDays: [], offDates: [] })),
  settings: {
    slotIntervalMin: 30,
    maxQueue: 5,
    graceMin: 5,
    advanceDays: 7,
    acceptQueue: true,
    acceptSlots: true,
    queuePaused: false,
    delayMin: 0,
  },
});

const DAY = '2026-11-16';
const NOW = { date: '2026-11-15', minutes: 600 };

test('peakConcurrent counts exact simultaneous overlap, not consecutive bookings', () => {
  const bookings = [
    { type: 'slot', status: 'waiting', slotStart: 600, durationMin: 30 }, // 10:00 - 10:30
    { type: 'slot', status: 'waiting', slotStart: 630, durationMin: 30 }, // 10:30 - 11:00
  ];
  // Consecutive bookings never overlap each other at any minute
  assert.equal(peakConcurrent(bookings, 600, 60), 1);
  // Boundary touch at 11:00 (660) has 0 overlap
  assert.equal(peakConcurrent(bookings, 660, 30), 0);
  // Add a true overlapping booking 10:15 - 10:45 (615..645) -> peak is 2
  bookings.push({ type: 'slot', status: 'waiting', slotStart: 615, durationMin: 30 });
  assert.equal(peakConcurrent(bookings, 600, 60), 2);
});

test('multi-chair buildSlots allows 60m booking on chair 2 when chair 1 has two consecutive 30m bookings', () => {
  const shop2 = makeShop(2);
  const bookings = [
    { type: 'slot', status: 'waiting', slotStart: 600, durationMin: 30 },
    { type: 'slot', status: 'waiting', slotStart: 630, durationMin: 30 },
  ];
  const slots = buildSlots(shop2, DAY, bookings, 60, NOW);
  const s1000 = slots.slots.find((s) => s.start === 600);
  assert.equal(s1000.free, true);
  assert.equal(s1000.left, 1);
  assert.equal(canTakeSlot(shop2, DAY, 600, 60, bookings, NOW), true);

  // Add a second booking on chair 2 at 10:30 - 11:00 -> now 10:00..11:00 has peak 2 during 10:30..11:00
  bookings.push({ type: 'slot', status: 'waiting', slotStart: 630, durationMin: 30 });
  assert.equal(canTakeSlot(shop2, DAY, 600, 60, bookings, NOW), false);
});

test('withMemoryLock enforces strict mutual exclusion for concurrent contenders', async () => {
  let active = 0;
  let maxActive = 0;
  let counter = 0;

  await Promise.all(
    Array.from({ length: 30 }, (_, i) =>
      withMemoryLock('slot:shop1:2026-11-16', async () => {
        active += 1;
        if (active > maxActive) maxActive = active;
        const snapshot = counter;
        await new Promise((r) => setTimeout(r, i % 3));
        counter = snapshot + 1;
        active -= 1;
      })
    )
  );

  assert.equal(maxActive, 1);
  assert.equal(counter, 30);
});

test('withMemoryLock releases on error and avoids AB/BA deadlock via key sorting', async () => {
  await assert.rejects(
    withMemoryLock(['b', 'a'], async () => {
      throw new Error('boom');
    }),
    /boom/
  );

  // Locking in opposite order concurrently must complete without deadlocking
  const results = await Promise.all([
    withMemoryLock(['shop:1', 'cust:1'], async () => 'one'),
    withMemoryLock(['cust:1', 'shop:1'], async () => 'two'),
  ]);
  assert.deepEqual(results.sort(), ['one', 'two']);
});

test('buildSlots and canTakeSlot respect temporary activeHolds while allowing the holder to confirm', () => {
  const shop1 = makeShop(1);
  const holds = [{ customer: 'custA', slotStart: 600, durationMin: 30 }];

  // Public availability and other customers see 10:00 as occupied
  const avail = buildSlots(shop1, DAY, [], 30, NOW, holds);
  assert.equal(avail.slots.find((s) => s.start === 600).free, false);
  assert.equal(avail.slots.find((s) => s.start === 630).free, true);
  assert.equal(canTakeSlot(shop1, DAY, 600, 30, [], NOW, holds, 'custB'), false);
  assert.equal(canTakeSlot(shop1, DAY, 600, 30, [], NOW, holds), false);

  // The customer holding 10:00 can confirm their own held slot
  assert.equal(canTakeSlot(shop1, DAY, 600, 30, [], NOW, holds, 'custA'), true);
});

