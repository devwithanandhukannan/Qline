import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDay, capacityOn, buildSlots, canTakeSlot, openStatus, peakConcurrent } from '../src/services/schedule.js';
import { queueDecision, estimateQueue, positionOf } from '../src/services/queue.js';
import { withMemoryLock } from '../src/utils/lock.js';

// Setup realistic test fixtures
const weekly = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
  day,
  open: day !== 0, // Sunday closed, Mon-Sat open
  intervals: day !== 0 ? [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '18:00' }] : [],
}));

const makeShop = (chairs = 1, extra = {}) => ({
  _id: 'shop_101',
  name: 'Crown Salon',
  category: 'barber',
  timezone: 'Asia/Kolkata',
  weekly,
  overrides: [],
  staff: Array.from({ length: chairs }, (_, i) => ({
    _id: `staff_${i + 1}`,
    id: `staff_${i + 1}`,
    name: `Stylist ${i + 1}`,
    active: true,
    offDays: [],
    offDates: [],
  })),
  tables: [],
  settings: {
    slotIntervalMin: 30,
    maxQueue: 10,
    graceMin: 5,
    advanceDays: 7,
    acceptQueue: true,
    acceptSlots: true,
    queuePaused: false,
    delayMin: 0,
    delayDate: '2026-11-18',
    cancelCutoffHours: 2,
    allowStaffSelection: true,
    allowTableSelection: false,
  },
  ...extra,
});

const TODAY = '2026-11-18'; // Wednesday
const TOMORROW = '2026-11-19';

/* =========================================================================
   SCENARIO 1: STRESS TEST - 3 USERS RACE FOR THE SAME SLOT AT THE SAME SECOND
   ========================================================================= */
test('SCENARIO 1 [STRESS]: 3 users simultaneously race to book the exact same 10:00 AM slot (1 chair)', async () => {
  const shop = makeShop(1); // Only 1 barber chair available
  const existingBookings = [];
  const now = { date: TODAY, minutes: 9 * 60 }; // 09:00 AM
  const targetSlot = 10 * 60; // 10:00 AM
  const durationMin = 30;

  let successfulBookings = 0;
  let rejectedBookings = 0;
  const userResults = [];

  // Simulate 3 concurrent contenders executing at the exact same millisecond
  await Promise.all(
    ['User_Alpha', 'User_Beta', 'User_Gamma'].map(async (user) => {
      // Each user goes through atomic memory lock on shop & date
      return withMemoryLock(`slot:${shop._id}:${TODAY}`, async () => {
        // Under the lock, check if slot can be taken
        const available = canTakeSlot(shop, TODAY, targetSlot, durationMin, existingBookings, now);
        if (available) {
          // Winner secures the booking
          existingBookings.push({
            id: `b_${user}`,
            customer: user,
            type: 'slot',
            status: 'waiting',
            slotStart: targetSlot,
            durationMin,
          });
          successfulBookings++;
          userResults.push({ user, status: 'confirmed' });
        } else {
          rejectedBookings++;
          userResults.push({ user, status: 'rejected' });
        }
      });
    })
  );

  // Exactly 1 winner, 2 rejected - zero double bookings!
  assert.equal(successfulBookings, 1, 'Only one user must win the 1-chair slot');
  assert.equal(rejectedBookings, 2, 'Other two users must be gracefully rejected');
  assert.equal(existingBookings.length, 1);
  assert.equal(existingBookings[0].slotStart, 600);

  // Subsequent check reveals slot is now 100% full
  const slotCheck = buildSlots(shop, TODAY, existingBookings, durationMin, now);
  const s10 = slotCheck.slots.find((s) => s.start === 600);
  assert.equal(s10.free, false, '10:00 AM slot must now be marked full');
  assert.equal(s10.left, 0, '0 chairs left for 10:00 AM');
});

/* =========================================================================
   SCENARIO 2: 3 USERS TAKE 3 CHAIRS, THEN 4TH USER BOOKS NEXT SLOT
   ========================================================================= */
test('SCENARIO 2 [CAPACITY & OVERFLOW]: 3 users fill 3 chairs at 10:00 AM, 4th & 5th users book subsequent slots seamlessly', () => {
  const shop3 = makeShop(3); // 3 chairs
  const now = { date: TODAY, minutes: 9 * 60 };
  const bookings = [];

  // 3 users book 10:00 AM
  ['User_1', 'User_2', 'User_3'].forEach((u, i) => {
    assert.ok(canTakeSlot(shop3, TODAY, 600, 30, bookings, now), `User ${i + 1} should be able to book`);
    bookings.push({
      id: `b_${u}`,
      customer: u,
      type: 'slot',
      status: 'waiting',
      slotStart: 600,
      durationMin: 30,
    });
  });

  // Verify 10:00 AM is completely exhausted
  const stateAt10 = buildSlots(shop3, TODAY, bookings, 30, now);
  const s10 = stateAt10.slots.find((s) => s.start === 600);
  assert.equal(s10.free, false);
  assert.equal(s10.left, 0);

  // 4th user tries to book 10:00 AM -> CANNOT take slot!
  assert.equal(canTakeSlot(shop3, TODAY, 600, 30, bookings, now), false, '4th user must be denied 10:00 AM');

  // Next slot at 10:30 AM is available with all 3 chairs free
  const s1030 = stateAt10.slots.find((s) => s.start === 630);
  assert.equal(s1030.free, true);
  assert.equal(s1030.left, 3, '10:30 AM has all 3 chairs open');

  // User 4 books 10:30 AM for 30 min
  bookings.push({ id: 'b_User_4', customer: 'User_4', type: 'slot', status: 'waiting', slotStart: 630, durationMin: 30 });

  // User 5 books 10:30 AM for a 60-minute service (occupies chair until 11:30 AM)
  assert.ok(canTakeSlot(shop3, TODAY, 630, 60, bookings, now));
  bookings.push({ id: 'b_User_5', customer: 'User_5', type: 'slot', status: 'waiting', slotStart: 630, durationMin: 60 });

  // Check slot availability at 11:00 AM:
  // User 4 finished at 11:00, but User 5 is still in chair until 11:30!
  // So at 11:00 AM: 1 chair occupied by User 5, 2 chairs free!
  const stateAfterLongBooking = buildSlots(shop3, TODAY, bookings, 30, now);
  const s1100 = stateAfterLongBooking.slots.find((s) => s.start === 660);
  assert.equal(s1100.free, true);
  assert.equal(s1100.left, 2, '11:00 AM has 2 chairs left because User 5 60m booking extends into it');
});

/* =========================================================================
   SCENARIO 3: STEP-BACK / PRIORITY SWAP & 2-STEP HARD LIMIT
   ========================================================================= */
test('SCENARIO 3 [PRIORITY SWAP]: User A steps back to let User B go first, enforces 2-step limit', () => {
  const shop = makeShop(1);
  const bookings = [
    { _id: 'b_A', customer: 'User_A', token: 1, queueOrder: 100, durationMin: 20, type: 'queue', status: 'waiting' },
    { _id: 'b_B', customer: 'User_B', token: 2, queueOrder: 200, durationMin: 20, type: 'queue', status: 'waiting' },
    { _id: 'b_C', customer: 'User_C', token: 3, queueOrder: 300, durationMin: 20, type: 'queue', status: 'waiting' },
  ];

  // Initial state: User A is 1st (ahead: 0)
  let posA = positionOf(bookings[0], shop, bookings);
  let posB = positionOf(bookings[1], shop, bookings);
  assert.equal(posA.ahead, 0, 'User A is first in line');
  assert.equal(posB.ahead, 1, 'User B is second');
  assert.equal(posA.canStepBack, true, 'User A can step back');

  // STEP BACK 1: User A steps back behind User B
  // Queue order of User A becomes between User B (200) and User C (300) -> 250
  bookings[0].queueOrder = 250;
  bookings[0].steppedBackCount = 1;

  posA = positionOf(bookings[0], shop, bookings);
  posB = positionOf(bookings[1], shop, bookings);
  assert.equal(posB.ahead, 0, 'User B is now served FIRST in front of User A!');
  assert.equal(posA.ahead, 1, 'User A is now behind User B');
  assert.equal(posA.canStepBack, true, 'User A still has 1 step back left');

  // STEP BACK 2: User A steps back again behind User C (300) -> 350
  bookings[0].queueOrder = 350;
  bookings[0].steppedBackCount = 2;

  posA = positionOf(bookings[0], shop, bookings);
  assert.equal(posA.ahead, 2, 'User A is now 3rd');
  assert.equal(posA.canStepBack, false, 'User A reached the strict maximum 2-step back limit!');

  // Serving user CANNOT step back
  bookings[1].status = 'serving';
  posB = positionOf(bookings[1], shop, bookings);
  assert.equal(posB.canStepBack, false, 'Serving customer cannot step back');
});

/* =========================================================================
   SCENARIO 4: DYNAMIC STAFF CHANGES (ADD STAFF & STAFF OFF DAY)
   ========================================================================= */
test('SCENARIO 4 [ORG POV - DYNAMIC STAFF]: Adding staff halves queue wait and doubles slot capacity; staff off-day cuts capacity', () => {
  // Shop starts with 1 barber
  const singleStaffShop = makeShop(1);
  const queueBookings = [
    { type: 'queue', status: 'waiting', durationMin: 30, token: 1 },
    { type: 'queue', status: 'waiting', durationMin: 30, token: 2 },
  ];
  const now = { date: TODAY, minutes: 10 * 60 };

  // 1 Barber: 2 customers * 30 min = 60 min wait
  const est1 = estimateQueue(singleStaffShop, queueBookings, now);
  assert.equal(est1.waitMin, 60, '1 barber wait is 60 min');

  // Org adds 2nd Barber dynamically!
  const twoStaffShop = makeShop(2);
  const est2 = estimateQueue(twoStaffShop, queueBookings, now);
  assert.equal(est2.waitMin, 30, '2 barbers divide work: wait drops to 30 min!');

  // Slot capacity with 1 barber vs 2 barbers
  const bookedSlot = [{ type: 'slot', status: 'waiting', slotStart: 660, durationMin: 30 }];
  const slots1 = buildSlots(singleStaffShop, TODAY, bookedSlot, 30, now);
  assert.equal(slots1.slots.find((s) => s.start === 660).free, false, 'Full for 1 barber');

  const slots2 = buildSlots(twoStaffShop, TODAY, bookedSlot, 30, now);
  assert.equal(slots2.slots.find((s) => s.start === 660).free, true, 'Open for 2nd barber!');
  assert.equal(slots2.slots.find((s) => s.start === 660).left, 1);

  // Staff member takes a day off (Staff 2 off on TODAY)
  twoStaffShop.staff[1].offDates = [TODAY];
  assert.equal(capacityOn(twoStaffShop, TODAY), 1, 'Capacity drops to 1 on off-date');
  const slotsOff = buildSlots(twoStaffShop, TODAY, bookedSlot, 30, now);
  assert.equal(slotsOff.slots.find((s) => s.start === 660).free, false, 'Capacity is back to 1, slot is full');
});

/* =========================================================================
   SCENARIO 5: SLOT VS QUEUE PRIORITY & 10 PEOPLE IN QUEUE
   ========================================================================= */
test('SCENARIO 5 [TRAGIC CONFLICT]: 10 people in queue + Slot booking priority and mutual awareness', () => {
  const shop = makeShop(1);
  const now = { date: TODAY, minutes: 10 * 60 }; // 10:00 AM

  // 10 people in live queue (15 min each = 150 min queue work)
  const tenPeopleQueue = Array.from({ length: 10 }, (_, i) => ({
    _id: `q_${i + 1}`,
    type: 'queue',
    status: 'waiting',
    token: i + 1,
    durationMin: 15,
  }));

  // Slot customer booked an appointment at 11:00 AM (660 min) for 30 min
  const slotAt11 = {
    _id: 's_vip',
    type: 'slot',
    status: 'waiting',
    token: 99,
    slotStart: 660, // 11:00 AM
    durationMin: 30,
  };

  const allBookings = [...tenPeopleQueue, slotAt11];

  // 1. What does the queue estimate tell a 11th walk-in customer?
  // 10 people * 15m = 150m. Projected finish without slot would be 10:00 + 150m = 12:30.
  // BUT at 11:00 AM, the slot booking of 30 min takes the chair!
  // Queue ETA MUST push past the slot appointment (150m + 30m = 180 min wait)!
  const est = estimateQueue(shop, allBookings, now);
  assert.equal(est.waitMin, 180, 'Queue ETA must include the 30m slot customer promised chair at 11:00 AM!');

  // 2. Queue customer currently in chair blocks slot booking during service
  // At 09:40 AM, queue customer was called to chair for 30m service (runs until 10:10 AM)
  const nowCheck = { date: TODAY, minutes: 9 * 60 + 40 }; // 09:40 AM
  const servingQueueBooking = [
    {
      _id: 'q_serving',
      type: 'queue',
      status: 'serving',
      startedAt: `${TODAY}T09:40:00`,
      durationMin: 30, // Finishes at 10:10 AM
    },
  ];

  // Customer looks for upcoming slots on today
  const slotBuild = buildSlots(shop, TODAY, servingQueueBooking, 30, nowCheck);
  const s1000 = slotBuild.slots.find((s) => s.start === 600);
  // Slot at 10:00 AM must NOT be free because queue customer is in the chair until 10:10 AM!
  assert.ok(s1000, 'Slot at 10:00 AM should exist in slot list');
  assert.equal(s1000.free, false, 'Slot at 10:00 AM must be blocked by serving queue customer');

  // Next slot at 10:30 AM is after queue customer finishes, so it IS free!
  const s1030 = slotBuild.slots.find((s) => s.start === 630);
  assert.equal(s1030.free, true, 'Slot at 10:30 AM is free after queue customer is done');
});

/* =========================================================================
   SCENARIO 6: NO PAST SLOTS & 5-MINUTE BUFFER ENFORCEMENT
   ========================================================================= */
test('SCENARIO 6 [PAST TIME SLOTS]: Never shows or allows booking past time slots on current day', () => {
  const shop = makeShop(1);
  // Current time is 11:22 AM
  const now = { date: TODAY, minutes: 11 * 60 + 22 };

  const res = buildSlots(shop, TODAY, [], 30, now);
  const times = res.slots.map((s) => s.time);

  // Past slots MUST NOT appear: 09:00, 09:30, 10:00, 10:30, 11:00
  assert.ok(!times.includes('09:00'));
  assert.ok(!times.includes('10:00'));
  assert.ok(!times.includes('11:00'));
  // 11:22 + 5 min buffer = 11:27 -> 11:30 is the earliest possible slot
  assert.ok(times.includes('11:30'), '11:30 AM should be the first valid future slot');

  // Direct canTakeSlot check for past times
  assert.equal(canTakeSlot(shop, TODAY, 10 * 60, 30, [], now), false, 'Past slot at 10:00 cannot be taken');
  assert.equal(canTakeSlot(shop, TODAY, 11 * 60, 30, [], now), false, 'Past slot at 11:00 cannot be taken');
  assert.equal(canTakeSlot(shop, TODAY, 11 * 60 + 30, 30, [], now), true, 'Future slot at 11:30 can be taken');
});

/* =========================================================================
   SCENARIO 7: TRAGIC REAL-LIFE EDGE CASES (CAFE OVER-CAPACITY, OVERNIGHT DELAY LEAKS)
   ========================================================================= */
test('SCENARIO 7 [TRAGIC REAL-LIFE]: Cafe party size exceeds tables, and delay does not leak across days', () => {
  // 1. Cafe party size exceeds table capacity
  const cafeShop = makeShop(0, {
    category: 'cafe',
    tables: [
      { _id: 'tb_1', id: 'tb_1', name: 'Table 1', capacity: 2, active: true },
      { _id: 'tb_2', id: 'tb_2', name: 'Table 2', capacity: 4, active: true },
    ],
    settings: {
      ...makeShop().settings,
      allowTableSelection: true,
    },
  });

  const now = { date: TODAY, minutes: 10 * 60 };

  // Group of 6 tries to book cafe -> max table is 4 seats!
  const groupOf6 = buildSlots(cafeShop, TODAY, [], 60, now, [], null, 6);
  assert.equal(groupOf6.open, false, 'Cafe cannot seat group of 6');
  assert.match(groupOf6.reason, /No tables available that can seat 6 people/);

  // Group of 4 can book Table 2 (4 seats)
  const groupOf4 = buildSlots(cafeShop, TODAY, [], 60, now, [], null, 4);
  assert.equal(groupOf4.open, true);
  assert.equal(groupOf4.capacity, 1, 'Only 1 table can seat 4 people');

  // Group of 2 has 2 eligible tables (Table 1 and Table 2)
  const groupOf2 = buildSlots(cafeShop, TODAY, [], 60, now, [], null, 2);
  assert.equal(groupOf2.open, true);
  assert.equal(groupOf2.capacity, 2, 'Both tables can seat 2 people');

  // 2. Overnight delay leak prevention:
  // Owner set a 30-min delay on YESTERDAY ('2026-11-17').
  // Today is '2026-11-18'. Delay must NOT affect today's customers!
  const shopWithOldDelay = makeShop(1, {
    settings: {
      ...makeShop().settings,
      delayMin: 30,
      delayDate: '2026-11-17', // Yesterday!
    },
  });

  const queue = [{ type: 'queue', status: 'waiting', durationMin: 20, token: 1 }];
  const estToday = estimateQueue(shopWithOldDelay, queue, { date: TODAY, minutes: 10 * 60 });
  assert.equal(estToday.waitMin, 20, 'Yesterday 30m delay must NOT leak into today wait time!');

  // But if delayDate is today, it correctly applies
  shopWithOldDelay.settings.delayDate = TODAY;
  const estTodayWithActiveDelay = estimateQueue(shopWithOldDelay, queue, { date: TODAY, minutes: 10 * 60 });
  assert.equal(estTodayWithActiveDelay.waitMin, 50, 'Today active 30m delay applies (+30 min)');
});

/* =========================================================================
   SCENARIO 8: CLOSING TIME AUTO-CUTOFF & BREAK STATUS
   ========================================================================= */
test('SCENARIO 8 [CLOSING CUTOFF]: Rejects queue entry if customer service duration extends past closing time', () => {
  const shop = makeShop(1);
  // Shop closes at 13:00 for lunch break
  // At 12:45 PM, a customer with 30-minute service tries to join queue
  const now = { date: TODAY, minutes: 12 * 60 + 45 };

  const decision = queueDecision(shop, [], 30, now);
  assert.equal(decision.ok, false, 'Must reject: service extends past 13:00 lunch break');
  assert.match(decision.reason, /closing/i);

  // But a 10-minute service at 12:45 finishes at 12:55 before 13:00, so it IS allowed!
  const shortServiceDecision = queueDecision(shop, [], 10, now);
  assert.equal(shortServiceDecision.ok, true, '10-minute service finishes before 13:00');

  // During lunch break (13:30 PM), shop status is explicitly 'break'
  const midDayStatus = openStatus(shop, { date: TODAY, minutes: 13 * 60 + 30 });
  assert.equal(midDayStatus.state, 'break', 'Shop state must be "break" between intervals');
  assert.equal(midDayStatus.opensAtMin, 14 * 60, 'Re-opens at 14:00 (840 minutes)');
});
