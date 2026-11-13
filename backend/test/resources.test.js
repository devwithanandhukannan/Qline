import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateQueue, positionOf, queueDecision } from '../src/services/queue.js';
import { capacityOn, buildSlots, canTakeSlot } from '../src/services/schedule.js';
import { tableDto, tablesDto, settingsDto } from '../src/validators/shop.js';
import { createBookingDto } from '../src/validators/booking.js';

test('capacityOn uses active tables count for cafes', () => {
  const cafeShop = {
    category: 'cafe',
    tables: [
      { name: 'Table 1', capacity: 2, active: true },
      { name: 'Table 2', capacity: 4, active: true },
      { name: 'Table 3', capacity: 6, active: false },
    ],
  };
  assert.equal(capacityOn(cafeShop, '2026-11-14'), 2);
});

test('buildSlots filters by partySize capacity for cafes', () => {
  const cafeShop = {
    timezone: 'Asia/Kolkata',
    category: 'cafe',
    settings: { slotIntervalMin: 60, advanceDays: 7 },
    weekly: [{ day: 6, open: true, intervals: [{ start: '10:00', end: '14:00' }] }],
    tables: [
      { _id: 't1', name: 'Table 1', capacity: 2, active: true },
      { _id: 't2', name: 'Table 2', capacity: 4, active: true },
    ],
  };
  const now = { date: '2026-11-14', minutes: 540 }; // 9:00 AM

  // Party of 4: only Table 2 (capacity 4) is eligible (cap = 1)
  const slots4 = buildSlots(cafeShop, '2026-11-14', [], 60, now, [], null, 4);
  assert.equal(slots4.capacity, 1);
  assert.equal(slots4.slots[0].free, true);

  // Party of 8: no table can accommodate 8
  const slots8 = buildSlots(cafeShop, '2026-11-14', [], 60, now, [], null, 8);
  assert.equal(slots8.open, false);
});

test('buildSlots isolates specific resourceId availability', () => {
  const rahulId = '64b1f1f1f1f1f1f1f1f1f101';
  const anoopId = '64b1f1f1f1f1f1f1f1f1f102';
  const shop = {
    timezone: 'Asia/Kolkata',
    category: 'barber',
    settings: { slotIntervalMin: 30, advanceDays: 7 },
    weekly: [{ day: 6, open: true, intervals: [{ start: '10:00', end: '12:00' }] }],
    staff: [
      { _id: rahulId, name: 'Rahul', active: true },
      { _id: anoopId, name: 'Anoop', active: true },
    ],
  };
  const now = { date: '2026-11-14', minutes: 540 }; // 9:00 AM

  // Rahul is booked at 10:00 (600)
  const bookings = [
    { type: 'slot', status: 'waiting', slotStart: 600, durationMin: 30, resourceId: rahulId },
  ];

  // Anyone: slot at 10:00 is free because Anoop is free (capacity = 2, taken = 1)
  const anyoneSlots = buildSlots(shop, '2026-11-14', bookings, 30, now, [], null, 1);
  assert.equal(anyoneSlots.slots.find((s) => s.start === 600).free, true);

  // Rahul specifically: slot at 10:00 is NOT free because Rahul is busy
  const rahulSlots = buildSlots(shop, '2026-11-14', bookings, 30, now, [], rahulId, 1);
  assert.equal(rahulSlots.slots.find((s) => s.start === 600).free, false);

  // Anoop specifically: slot at 10:00 IS free
  const anoopSlots = buildSlots(shop, '2026-11-14', bookings, 30, now, [], anoopId, 1);
  assert.equal(anoopSlots.slots.find((s) => s.start === 600).free, true);
});

test('estimateQueue with specific resource calculates wait time for that resource', () => {
  const shop = {
    timezone: 'Asia/Kolkata',
    settings: { delayMin: 0, acceptQueue: true, maxQueue: 15, queuePaused: false },
    weekly: [{ day: 6, open: true, intervals: [{ start: '09:00', end: '20:00' }] }],
    staff: [
      { _id: '64b1f1f1f1f1f1f1f1f1f101', name: 'Rahul', active: true },
      { _id: '64b1f1f1f1f1f1f1f1f1f102', name: 'Anoop', active: true },
    ],
  };
  const now = { date: '2026-11-14', minutes: 600 }; // 10:00 AM (Saturday: day 6)

  const todays = [
    // Rahul's queue (30 mins)
    { _id: 'b1', type: 'queue', status: 'waiting', durationMin: 30, resourceId: '64b1f1f1f1f1f1f1f1f1f101' },
    // Anoop's queue (60 mins)
    { _id: 'b2', type: 'queue', status: 'waiting', durationMin: 60, resourceId: '64b1f1f1f1f1f1f1f1f1f102' },
  ];

  // Anyone / First available: split across 2 staff members
  const estAnyone = estimateQueue(shop, todays, now, null);
  assert.equal(estAnyone.ahead, 2);
  assert.equal(estAnyone.waitMin, 45); // (30 + 60) / 2 = 45

  // Specific stylist: Rahul
  const estRahul = estimateQueue(shop, todays, now, '64b1f1f1f1f1f1f1f1f1f101');
  assert.equal(estRahul.ahead, 1);
  assert.equal(estRahul.waitMin, 30); // 30 / 1 = 30

  // Specific stylist: Anoop
  const estAnoop = estimateQueue(shop, todays, now, '64b1f1f1f1f1f1f1f1f1f102');
  assert.equal(estAnoop.ahead, 1);
  assert.equal(estAnoop.waitMin, 60); // 60 / 1 = 60
});

test('positionOf isolates queue ahead based on resourceId', () => {
  const rahulId = '64b1f1f1f1f1f1f1f1f1f101';
  const anoopId = '64b1f1f1f1f1f1f1f1f1f102';
  const shop = { settings: { delayMin: 0 }, _cap: 2 };

  const booking1 = { _id: 'b1', type: 'queue', status: 'waiting', durationMin: 20, token: 1, resourceId: rahulId };
  const booking2 = { _id: 'b2', type: 'queue', status: 'waiting', durationMin: 40, token: 2, resourceId: anoopId };
  const booking3 = { _id: 'b3', type: 'queue', status: 'waiting', durationMin: 25, token: 3, resourceId: rahulId };

  const todays = [booking1, booking2, booking3];

  const pos3 = positionOf(booking3, shop, todays);
  assert.ok(pos3);
  // In Rahul's queue, only booking 1 is ahead of booking 3 (booking 2 is with Anoop)
  assert.equal(pos3.ahead, 1);
  assert.equal(pos3.etaMin, 20);
});

test('validators accept tableDto, tablesDto, allowStaffSelection, allowTableSelection and booking partySize/resourceId', () => {
  const validTable = tableDto.parse({ name: 'Table 1', capacity: 4, active: true });
  assert.equal(validTable.capacity, 4);

  const validSettings = settingsDto.parse({
    allowStaffSelection: true,
    allowTableSelection: true,
    maxQueue: 20,
    graceMin: 10,
  });
  assert.equal(validSettings.allowStaffSelection, true);
  assert.equal(validSettings.allowTableSelection, true);

  const validBooking = createBookingDto.parse({
    slug: 'salon-luxe',
    type: 'queue',
    serviceIds: ['64b1f1f1f1f1f1f1f1f1f101'],
    partySize: 4,
    resourceId: '64b1f1f1f1f1f1f1f1f1f102',
  });
  assert.equal(validBooking.partySize, 4);
  assert.equal(validBooking.resourceId, '64b1f1f1f1f1f1f1f1f1f102');
});

