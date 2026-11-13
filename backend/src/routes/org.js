import { Router } from 'express';
import crypto from 'node:crypto';
import { validate, requireAuth } from '../middleware/core.js';
import { idParam } from '../validators/common.js';
import * as D from '../validators/shop.js';
import { Shop } from '../models/Shop.js';
import { Booking } from '../models/Booking.js';
import { Counter } from '../models/Counter.js';
import { Review } from '../models/Review.js';
import { User } from '../models/User.js';
import { badRequest, conflict, forbidden, notFound, AppError } from '../utils/errors.js';
import { nowInZone, addDays, eachDay, daysBetween, minToHHMM } from '../utils/time.js';
import { resolveDay, capacityOn, openStatus } from '../services/schedule.js';
import { estimateQueue } from '../services/queue.js';
import { buildReport, buildCustomers } from '../services/reports.js';
import { firstName } from '../services/present.js';
import { notifyBookingStatus, notifyQueueTurnUpdates, notifyShopDelay } from '../services/webPush.js';
import { withDistributedLock } from '../utils/lock.js';

const r = Router();
r.use((req, res, next) => requireAuth('owner')(req, res, next));

const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'shop';

// Loads the caller's own shop. Every org route below uses it, so an owner can only ever touch their own data.
async function withShop(req, _res, next) {
  const shop = await Shop.findOne({ owner: req.user._id });
  if (!shop) throw new AppError(404, 'Create your shop first', 'no_shop');
  req.shop = shop;
  next();
}

function requireActiveShop(req, _res, next) {
  if (req.shop.isActive === false) {
    throw forbidden(req.shop.disabledReason ? `Your shop is turned off by admin: ${req.shop.disabledReason}` : 'Your shop is currently turned off by admin.', 'shop_disabled');
  }
  next();
}

const presentOwnerShop = (s) => ({
  id: String(s._id),
  slug: s.slug,
  name: s.name,
  category: s.category,
  description: s.description,
  phone: s.phone,
  address: s.address,
  area: s.area,
  city: s.city,
  lat: s.lat ?? null,
  lng: s.lng ?? null,
  timezone: s.timezone,
  isListed: s.isListed,
  isActive: s.isActive !== false,
  disabledReason: s.disabledReason || '',
  disabledAt: s.disabledAt || null,
  images: s.images || [],
  services: s.services.map((x) => ({ id: String(x._id), name: x.name, durationMin: x.durationMin, price: x.price, active: x.active })),
  staff: s.staff.map((x) => ({ id: String(x._id), name: x.name, active: x.active, offDays: x.offDays, offDates: x.offDates })),
  weekly: [...s.weekly].sort((a, b) => a.day - b.day).map((d) => ({ day: d.day, open: d.open, intervals: d.intervals.map((i) => ({ start: i.start, end: i.end })) })),
  overrides: [...s.overrides].sort((a, b) => a.date.localeCompare(b.date)).map((o) => ({ date: o.date, closed: o.closed, note: o.note, intervals: o.intervals.map((i) => ({ start: i.start, end: i.end })) })),
  settings: s.settings.toObject ? s.settings.toObject() : s.settings,
  rating: { avg: Math.round(s.ratingAvg * 10) / 10, count: s.ratingCount },
});

const presentRow = (b, user) => ({
  id: String(b._id),
  token: b.token,
  queueOrder: b.queueOrder ?? b.token * 100,
  steppedBackCount: b.steppedBackCount || 0,
  partySize: b.partySize || 1,
  forName: b.forName || '',
  type: b.type,
  status: b.status,
  slotTime: b.slotStart != null ? minToHHMM(b.slotStart) : null,
  name: b.forName ? `${b.forName} (${user ? user.name : b.guestName || 'Guest'})` : user ? user.name : b.guestName || 'Walk-in',
  phone: user ? user.phone || '' : b.guestPhone || '',
  isWalkin: !b.customer,
  services: (b.services || []).map((s) => s.name),
  durationMin: b.durationMin,
  startedAt: b.startedAt || null,
  createdAt: b.createdAt,
});

async function rowsFor(bookings) {
  const ids = [...new Set(bookings.filter((b) => b.customer).map((b) => String(b.customer)))];
  const users = new Map((await User.find({ _id: { $in: ids } }).select('name phone email noShowCount').lean()).map((u) => [String(u._id), u]));
  return bookings.map((b) => ({ ...presentRow(b, b.customer ? users.get(String(b.customer)) : null), noShowCount: b.customer ? users.get(String(b.customer))?.noShowCount || 0 : 0 }));
}

// ---------- shop setup ----------
r.get('/shop', async (req, res) => {
  const shop = await Shop.findOne({ owner: req.user._id });
  res.json({ shop: shop ? presentOwnerShop(shop) : null });
});

r.post('/shop', validate({ body: D.createShopDto }), async (req, res) => {
  if (await Shop.exists({ owner: req.user._id })) throw conflict('You already have a shop.');
  const { services, ...rest } = req.valid.body;
  const base = slugify(rest.name);
  let slug = base;
  for (let i = 0; i < 5 && (await Shop.exists({ slug })); i++) slug = `${base}-${crypto.randomBytes(2).toString('hex')}`;
  const shop = await Shop.create({
    ...rest,
    slug: slug.length < 3 ? `${slug}-shop` : slug,
    owner: req.user._id,
    timezone: process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata',
    services: services?.length ? services.map(({ _id, ...s }) => s) : [{ name: rest.category === 'cafe' ? 'Table for 2' : 'Haircut', durationMin: rest.category === 'cafe' ? 60 : 30, price: 0 }],
  });
  res.status(201).json({ shop: presentOwnerShop(shop) });
});

r.put('/shop', withShop, validate({ body: D.updateShopDto }), async (req, res) => {
  Object.assign(req.shop, req.valid.body);
  await req.shop.save();
  res.json({ shop: presentOwnerShop(req.shop) });
});

r.put('/shop/services', withShop, validate({ body: D.servicesDto }), async (req, res) => {
  const incoming = req.valid.body.services;
  const known = new Set(req.shop.services.map((s) => String(s._id)));
  // Services that already exist keep their id (old bookings and reports stay linked); unknown ids are ignored
  req.shop.services = incoming.map(({ _id, ...s }) => (_id && known.has(_id) ? { _id, ...s } : s));
  await req.shop.save();
  res.json({ shop: presentOwnerShop(req.shop) });
});

r.put('/shop/schedule', withShop, validate({ body: D.scheduleDto }), async (req, res) => {
  req.shop.weekly = req.valid.body.weekly;
  await req.shop.save();
  res.json({ shop: presentOwnerShop(req.shop) });
});

r.put('/shop/settings', withShop, validate({ body: D.settingsDto }), async (req, res) => {
  for (const [k, v] of Object.entries(req.valid.body)) req.shop.settings[k] = v;
  if (!req.shop.settings.acceptQueue && !req.shop.settings.acceptSlots) throw badRequest('Turn on at least queue or slot booking.');
  await req.shop.save();
  res.json({ shop: presentOwnerShop(req.shop) });
});

r.put('/shop/staff', withShop, validate({ body: D.staffDto }), async (req, res) => {
  const known = new Set(req.shop.staff.map((s) => String(s._id)));
  req.shop.staff = req.valid.body.staff.map(({ _id, ...s }) => (_id && known.has(_id) ? { _id, ...s } : s));
  await req.shop.save();
  res.json({ shop: presentOwnerShop(req.shop) });
});

r.post('/shop/overrides', withShop, validate({ body: D.overrideDto }), async (req, res) => {
  const o = req.valid.body;
  const today = nowInZone(req.shop.timezone).date;
  if (o.date < today) throw badRequest('You cannot change a day that has already passed.');
  const rest = req.shop.overrides.filter((x) => x.date !== o.date);
  req.shop.overrides = [...rest, { date: o.date, closed: o.closed, intervals: o.closed ? [] : o.intervals, note: o.note }];
  await req.shop.save();
  res.json({ shop: presentOwnerShop(req.shop) });
});

r.delete('/shop/overrides/:date', withShop, validate({ params: D.overrideParam }), async (req, res) => {
  req.shop.overrides = req.shop.overrides.filter((x) => x.date !== req.valid.params.date);
  await req.shop.save();
  res.json({ shop: presentOwnerShop(req.shop) });
});

// ---------- live queue ----------
r.get('/queue', withShop, async (req, res) => {
  const now = nowInZone(req.shop.timezone);
  const rows = await Booking.find({ shop: req.shop._id, date: now.date }).sort({ token: 1 }).lean();
  const orderOf = (x) => x.queueOrder ?? x.token * 100;
  rows.sort((a, b) => orderOf(a) - orderOf(b) || a.token - b.token);
  const est = estimateQueue(req.shop, rows.filter((b) => ['waiting', 'serving'].includes(b.status)), now);
  const st = openStatus(req.shop, now);
  res.json({
    date: now.date,
    status: { state: st.state, closesAt: st.closesAt != null ? minToHHMM(st.closesAt) : null, capacity: capacityOn(req.shop, now.date), note: resolveDay(req.shop, now.date).note },
    settings: { queuePaused: req.shop.settings.queuePaused, delayMin: req.shop.settings.delayMin, delayNote: req.shop.settings.delayNote, graceMin: req.shop.settings.graceMin },
    summary: { waiting: rows.filter((b) => b.status === 'waiting').length, serving: rows.filter((b) => b.status === 'serving').length, done: rows.filter((b) => b.status === 'done').length, waitMin: est.waitMin },
    bookings: await rowsFor(rows),
  });
});

r.post('/queue/pause', withShop, requireActiveShop, validate({ body: D.pauseDto }), async (req, res) => {
  req.shop.settings.queuePaused = req.valid.body.paused;
  await req.shop.save();
  res.json({ ok: true, paused: req.shop.settings.queuePaused });
});

r.post('/queue/delay', withShop, requireActiveShop, validate({ body: D.delayDto }), async (req, res) => {
  req.shop.settings.delayMin = req.valid.body.delayMin;
  req.shop.settings.delayNote = req.valid.body.delayMin ? req.valid.body.note : '';
  await req.shop.save();
  if (req.shop.settings.delayMin > 0) {
    notifyShopDelay(req.shop, nowInZone(req.shop.timezone).date, req.shop.settings.delayMin, req.shop.settings.delayNote).catch(() => {});
  }
  res.json({ ok: true });
});

r.post('/bookings/:id/action', withShop, validate({ params: idParam, body: D.actionDto }), async (req, res) => {
  const { action } = req.valid.body;
  const out = await withDistributedLock(`booking-act:${req.valid.params.id}`, async () => {
    const b = await Booking.findOne({ _id: req.valid.params.id, shop: req.shop._id });
    if (!b) throw notFound('Booking not found');
    const ok = {
      start: b.status === 'waiting',
      done: b.status === 'serving' || b.status === 'waiting',
      no_show: b.status === 'waiting',
      cancel: b.status === 'waiting' || b.status === 'serving',
    }[action];
    if (!ok) throw conflict(`This booking is already ${b.status.replace('_', ' ')}.`);

    if (action === 'start') {
      if (req.shop.isActive === false) throw forbidden('Your shop is currently turned off by admin.', 'shop_disabled');
      const cap = capacityOn(req.shop, b.date);
      const serving = await Booking.countDocuments({ shop: req.shop._id, date: b.date, status: 'serving' });
      if (serving >= cap) throw conflict(cap === 1 ? 'Finish the current customer first.' : 'All chairs are busy. Finish a customer first.');
      b.status = 'serving';
      b.startedAt = new Date();
    } else if (action === 'done') {
      b.status = 'done';
      b.startedAt ||= new Date();
      b.completedAt = new Date();
    } else if (action === 'no_show') {
      b.status = 'no_show';
      if (b.customer) await User.updateOne({ _id: b.customer }, { $inc: { noShowCount: 1 } });
    } else {
      b.status = 'cancelled';
    }
    await b.save();
    return { status: b.status, date: b.date, booking: b.toObject() };
  });
  notifyBookingStatus(req.shop, out.booking, action).catch(() => {});
  notifyQueueTurnUpdates(req.shop, out.date).catch(() => {});
  res.json({ ok: true, status: out.status });
});

r.post('/walkin', withShop, requireActiveShop, validate({ body: D.walkinDto }), async (req, res) => {
  const { name, phone, serviceIds } = req.valid.body;
  const chosen = req.shop.services.filter((s) => s.active && serviceIds.includes(String(s._id)));
  if (!chosen.length) throw badRequest('Pick at least one service');
  const now = nowInZone(req.shop.timezone);
  const b = await withDistributedLock(`shop:${req.shop._id}:${now.date}`, async () => {
    const live = await Booking.countDocuments({ shop: req.shop._id, date: now.date, type: 'queue', status: { $in: ['waiting', 'serving'] } });
    if (live >= Math.max(req.shop.settings.maxQueue * 2, 30)) throw conflict('The queue is very long already. Finish some customers first.');
    const c = await Counter.findOneAndUpdate({ key: `${req.shop._id}:${now.date}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
    return Booking.create({
      shop: req.shop._id,
      guestName: name || 'Anonymous',
      guestPhone: phone,
      date: now.date,
      type: 'queue',
      token: c.seq,
      queueOrder: c.seq * 100,
      services: chosen.map((s) => ({ serviceId: s._id, name: s.name, durationMin: s.durationMin, price: s.price })),
      durationMin: chosen.reduce((a, s) => a + s.durationMin, 0),
    });
  });
  res.status(201).json({ id: String(b._id), token: b.token });
});

// ---------- calendar and reports ----------
r.get('/calendar', withShop, validate({ query: D.calendarQuery }), async (req, res) => {
  const [y, m] = req.valid.query.month.split('-').map(Number);
  const from = `${req.valid.query.month}-01`;
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const rows = await Booking.find({ shop: req.shop._id, date: { $gte: from, $lte: to } }).select('date status').lean();
  const by = new Map();
  for (const b of rows) {
    const e = by.get(b.date) || { total: 0, done: 0, noShow: 0, cancelled: 0 };
    e.total += 1;
    if (b.status === 'done') e.done += 1;
    if (b.status === 'no_show') e.noShow += 1;
    if (b.status === 'cancelled') e.cancelled += 1;
    by.set(b.date, e);
  }
  const days = eachDay(from, to).map((date) => {
    const d = resolveDay(req.shop, date);
    return { date, open: d.open && capacityOn(req.shop, date) > 0, hasOverride: d.source === 'override', note: d.note, capacity: capacityOn(req.shop, date), ...(by.get(date) || { total: 0, done: 0, noShow: 0, cancelled: 0 }) };
  });
  res.json({ month: req.valid.query.month, today: nowInZone(req.shop.timezone).date, days });
});

r.get('/day', withShop, validate({ query: D.dayQuery }), async (req, res) => {
  const { date } = req.valid.query;
  const rows = await Booking.find({ shop: req.shop._id, date }).sort({ token: 1 }).lean();
  const d = resolveDay(req.shop, date);
  res.json({
    date,
    open: d.open,
    note: d.note,
    intervals: d.intervals.map((i) => ({ start: minToHHMM(i.start), end: minToHHMM(i.end) })),
    capacity: capacityOn(req.shop, date),
    bookings: await rowsFor(rows),
  });
});

r.get('/reports', withShop, validate({ query: D.reportQuery }), async (req, res) => {
  const { from, to } = req.valid.query;
  const span = daysBetween(from, to);
  if (span < 0) throw badRequest('Start date must be before end date');
  if (span > 365) throw badRequest('Please choose a range of one year or less');
  const bookings = await Booking.find({ shop: req.shop._id, date: { $gte: from, $lte: to } }).lean();
  const prior = await Booking.distinct('customer', { shop: req.shop._id, date: { $lt: from }, customer: { $ne: null }, status: { $ne: 'cancelled' } });
  // ratings are tied to the visit date (not the time zone of when the review was written)
  const bookingIds = bookings.filter((b) => b.reviewed).map((b) => b._id);
  const reviews = bookingIds.length ? await Review.find({ booking: { $in: bookingIds } }).select('stars').lean() : [];
  res.json(buildReport({ bookings, priorCustomers: new Set(prior.map(String)), reviews, from, to, tz: req.shop.timezone }));
});

r.get('/customers', withShop, validate({ query: D.customersQuery }), async (req, res) => {
  const { q, page, limit } = req.valid.query;
  const bookings = await Booking.find({ shop: req.shop._id, customer: { $ne: null } }).select('customer date status services').lean();
  const ids = [...new Set(bookings.map((b) => String(b.customer)))];
  const users = new Map((await User.find({ _id: { $in: ids } }).select('name email phone').lean()).map((u) => [String(u._id), u]));
  const all = buildCustomers(bookings, users, q?.toLowerCase());
  res.json({ total: all.length, customers: all.slice((page - 1) * limit, page * limit) });
});

r.get('/reviews', withShop, async (req, res) => {
  const rows = await Review.find({ shop: req.shop._id }).sort({ createdAt: -1 }).limit(100).populate('customer', 'name').lean();
  res.json({ reviews: rows.map((v) => ({ id: String(v._id), stars: v.stars, comment: v.comment, isPublic: v.isPublic, name: firstName(v.customer?.name), createdAt: v.createdAt })) });
});

export default r;
