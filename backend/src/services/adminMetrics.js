import { eachDay, nowInZone } from '../utils/time.js';

export const bookingPrice = (b) => (b.services || []).reduce((a, s) => a + (s.price || 0), 0);

/**
 * Pure helper that builds daily time-series and totals for platform overview.
 */
export function buildOverviewSeries({ from, to, bookings, customers, shops, today, timezone = 'Asia/Kolkata' }) {
  const days = new Map(
    eachDay(from, to).map((d) => [
      d,
      { date: d, total: 0, served: 0, noShow: 0, cancelled: 0, waiting: 0, serving: 0, walkins: 0, revenue: 0, newCustomers: 0, newOrgs: 0 },
    ])
  );

  let served = 0;
  let noShow = 0;
  let cancelled = 0;
  let walkins = 0;
  let revenue = 0;
  let liveWaiting = 0;
  let liveServing = 0;
  const activeCustomers = new Set();
  const activeShopsToday = new Set();

  for (const b of bookings) {
    const d = days.get(b.date);
    if (d) {
      d.total += 1;
      if (!b.customer) d.walkins += 1;
      if (b.status === 'done') {
        const rev = bookingPrice(b);
        d.served += 1;
        d.revenue += rev;
      } else if (b.status === 'no_show') d.noShow += 1;
      else if (b.status === 'cancelled') d.cancelled += 1;
      else if (b.status === 'waiting') d.waiting += 1;
      else if (b.status === 'serving') d.serving += 1;
    }

    if (!b.customer) walkins += 1;
    else if (b.status !== 'cancelled') activeCustomers.add(String(b.customer));

    if (b.status === 'done') {
      served += 1;
      revenue += bookingPrice(b);
    } else if (b.status === 'no_show') noShow += 1;
    else if (b.status === 'cancelled') cancelled += 1;

    if (b.date === today && (b.status === 'waiting' || b.status === 'serving')) {
      if (b.status === 'waiting') liveWaiting += 1;
      else liveServing += 1;
      activeShopsToday.add(String(b.shop));
    }
  }

  for (const c of customers) {
    const date = nowInZone(timezone, new Date(c.createdAt)).date;
    const d = days.get(date);
    if (d) d.newCustomers += 1;
  }

  for (const s of shops) {
    const date = nowInZone(timezone, new Date(s.createdAt)).date;
    const d = days.get(date);
    if (d) d.newOrgs += 1;
  }

  const total = bookings.length;
  return {
    daily: [...days.values()],
    rangeTotals: {
      bookings: total,
      served,
      noShow,
      cancelled,
      walkins,
      online: total - walkins,
      revenue,
      activeCustomers: activeCustomers.size,
      newCustomers: customers.length,
      newOrgs: shops.length,
      completionRate: total ? Math.round((served / total) * 100) : 0,
      noShowRate: total ? Math.round((noShow / total) * 100) : 0,
    },
    live: {
      waiting: liveWaiting,
      serving: liveServing,
      activeShopsToday: activeShopsToday.size,
    },
  };
}

