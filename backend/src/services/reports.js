import { eachDay, nowInZone } from '../utils/time.js';

const price = (b) => (b.services || []).reduce((a, s) => a + (s.price || 0), 0);

// Pure function: turns raw bookings into the numbers and chart series the dashboard shows.
export function buildReport({ bookings, priorCustomers, reviews, from, to, tz }) {
  const days = new Map(eachDay(from, to).map((d) => [d, { date: d, total: 0, served: 0, noShow: 0, cancelled: 0, newCustomers: 0, revenue: 0, walkins: 0 }]));
  const firstSeen = new Map(); // customer -> first date in range
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  const services = new Map();
  let durationSum = 0;

  for (const b of bookings) {
    const d = days.get(b.date);
    if (!d) continue;
    d.total += 1;
    if (!b.customer) d.walkins += 1;
    if (b.status === 'done') {
      d.served += 1;
      d.revenue += price(b);
      durationSum += b.durationMin;
      for (const s of b.services || []) {
        const e = services.get(s.name) || { name: s.name, count: 0, revenue: 0 };
        e.count += 1;
        e.revenue += s.price || 0;
        services.set(s.name, e);
      }
    } else if (b.status === 'no_show') d.noShow += 1;
    else if (b.status === 'cancelled') d.cancelled += 1;

    if (b.status !== 'cancelled') {
      const h = b.slotStart != null ? Math.floor(b.slotStart / 60) : Math.floor(nowInZone(tz, new Date(b.createdAt)).minutes / 60);
      hours[h].count += 1;
    }
    if (b.customer && b.status !== 'cancelled') {
      const id = String(b.customer);
      if (!firstSeen.has(id) || b.date < firstSeen.get(id)) firstSeen.set(id, b.date);
    }
  }

  let newCount = 0;
  for (const [id, date] of firstSeen) {
    if (!priorCustomers.has(id)) {
      days.get(date).newCustomers += 1;
      newCount += 1;
    }
  }

  const daily = [...days.values()];
  const sum = (k) => daily.reduce((a, d) => a + d[k], 0);
  const served = sum('served');
  const dist = [0, 0, 0, 0, 0];
  let starSum = 0;
  for (const v of reviews) {
    dist[v.stars - 1] += 1;
    starSum += v.stars;
  }

  return {
    from,
    to,
    totals: {
      bookings: sum('total'),
      served,
      noShow: sum('noShow'),
      cancelled: sum('cancelled'),
      walkins: sum('walkins'),
      uniqueCustomers: firstSeen.size,
      newCustomers: newCount,
      returningCustomers: firstSeen.size - newCount,
      revenue: sum('revenue'),
      avgServiceMin: served ? Math.round(durationSum / served) : 0,
      noShowRate: sum('total') ? Math.round((sum('noShow') / sum('total')) * 100) : 0,
    },
    daily,
    hourly: hours.filter((h) => h.hour >= 5 && h.hour <= 23),
    topServices: [...services.values()].sort((a, b) => b.count - a.count).slice(0, 8),
    ratings: { count: reviews.length, avg: reviews.length ? Math.round((starSum / reviews.length) * 10) / 10 : 0, distribution: dist },
  };
}

export function buildCustomers(bookings, users, q) {
  const map = new Map();
  for (const b of bookings) {
    if (!b.customer) continue;
    const id = String(b.customer);
    const e = map.get(id) || { id, visits: 0, bookings: 0, noShows: 0, firstDate: b.date, lastDate: b.date, spent: 0 };
    e.bookings += 1;
    if (b.status === 'done') {
      e.visits += 1;
      e.spent += price(b);
    }
    if (b.status === 'no_show') e.noShows += 1;
    if (b.date < e.firstDate) e.firstDate = b.date;
    if (b.date > e.lastDate) e.lastDate = b.date;
    map.set(id, e);
  }
  let rows = [...map.values()].map((e) => {
    const u = users.get(e.id);
    return { ...e, name: u?.name || 'Customer', email: u?.email || '', phone: u?.phone || '' };
  });
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((r) => r.name.toLowerCase().includes(needle) || r.email.includes(needle) || r.phone.includes(needle));
  }
  return rows.sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));
}
