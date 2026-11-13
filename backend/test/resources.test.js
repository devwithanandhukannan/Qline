import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateQueue, positionOf, queueDecision } from '../src/services/queue.js';
import { capacityOn } from '../src/services/schedule.js';
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
