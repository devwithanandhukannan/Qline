import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverviewSeries } from '../src/services/adminMetrics.js';
import { hashPassword, verifyPassword } from '../src/utils/password.js';

test('hashPassword and verifyPassword validate matching passwords and reject wrong ones', () => {
  const stored = hashPassword('super-secret-123');
  assert.ok(stored.includes(':'));
  assert.equal(verifyPassword('super-secret-123', stored), true);
  assert.equal(verifyPassword('wrong-password', stored), false);
  assert.equal(verifyPassword('super-secret-123', ''), false);
  assert.equal(verifyPassword('super-secret-123', 'malformed'), false);
});

test('buildOverviewSeries aggregates daily bookings, revenue, live queue and new signups', () => {
  const from = '2026-11-10';
  const to = '2026-11-12';
  const today = '2026-11-12';

  const bookings = [
    {
      shop: 'shop1',
      customer: 'cust1',
      date: '2026-11-10',
      status: 'done',
      services: [{ name: 'Haircut', price: 200 }],
      createdAt: '2026-11-10T06:00:00Z',
    },
    {
      shop: 'shop1',
      customer: null,
      date: '2026-11-10',
      status: 'no_show',
      services: [{ name: 'Beard', price: 100 }],
      createdAt: '2026-11-10T07:00:00Z',
    },
    {
      shop: 'shop2',
      customer: 'cust2',
      date: '2026-11-12',
      status: 'waiting',
      services: [{ name: 'Facial', price: 500 }],
      createdAt: '2026-11-12T06:00:00Z',
    },
    {
      shop: 'shop1',
      customer: 'cust1',
      date: '2026-11-12',
      status: 'serving',
      services: [{ name: 'Haircut', price: 200 }],
      createdAt: '2026-11-12T06:30:00Z',
    },
  ];

  const customers = [{ createdAt: '2026-11-11T08:00:00Z' }];
  const shops = [{ createdAt: '2026-11-10T09:00:00Z' }];

  const res = buildOverviewSeries({ from, to, bookings, customers, shops, today });

  assert.equal(res.daily.length, 3);
  assert.equal(res.rangeTotals.bookings, 4);
  assert.equal(res.rangeTotals.served, 1);
  assert.equal(res.rangeTotals.noShow, 1);
  assert.equal(res.rangeTotals.walkins, 1);
  assert.equal(res.rangeTotals.online, 3);
  assert.equal(res.rangeTotals.revenue, 200);
  assert.equal(res.rangeTotals.activeCustomers, 2);
  assert.equal(res.rangeTotals.newCustomers, 1);
  assert.equal(res.rangeTotals.newOrgs, 1);
  assert.equal(res.rangeTotals.completionRate, 25);
  assert.equal(res.rangeTotals.noShowRate, 25);

  assert.equal(res.live.waiting, 1);
  assert.equal(res.live.serving, 1);
  assert.equal(res.live.activeShopsToday, 2);

  assert.equal(res.daily[0].revenue, 200);
  assert.equal(res.daily[0].newOrgs, 1);
  assert.equal(res.daily[1].newCustomers, 1);
});
