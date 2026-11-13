import { Router } from 'express';
import { SlotHold } from '../models/SlotHold.js';
import { holdSlotDto } from '../validators/booking.js';
import { validate, requireAuth } from '../middleware/core.js';
import { idParam } from '../validators/common.js';
import { createBookingDto, reviewDto, mineQuery, pushSubscriptionDto, pushDeleteDto } from '../validators/booking.js';
import { Shop } from '../models/Shop.js';
import { Booking } from '../models/Booking.js';
import { Counter } from '../models/Counter.js';
import { Review } from '../models/Review.js';
import { notFound, conflict, badRequest, forbidden, AppError } from '../utils/errors.js';
import { nowInZone, daysBetween } from '../utils/time.js';
import { queueDecision, positionOf } from '../services/queue.js';
import { canTakeSlot, capacityOn, buildSlots, openStatus } from '../services/schedule.js';
import { presentBooking } from '../services/present.js';
import { notifyQueueTurnUpdates } from '../services/webPush.js';
import { withDistributedLock, withMemoryLock } from '../utils/lock.js';

const r = Router();
r.use((req, res, next) => requireAuth('customer')(req, res, next));

const HOLD_MS = 2 * 60 * 1000;

/** Reserve a time slot for 2 minutes while the customer completes booking. */
r.post('/hold-slot', validate({ body: holdSlotDto }), async (req, res) => {
  const { slug, date, slotStart, serviceIds, partySize } = req.valid.body;
  const shop = await Shop.findOne({ slug, isActive: { $ne: false } }).lean();
  if (!shop) throw new AppError(404, 'Shop not found', 'not_found');
  if (!shop.settings.acceptSlots) throw new AppError(409, 'This shop does not take slot bookings.', 'slots_unavailable');

  const picked = serviceIds.map((id) => shop.services.find((s) => String(s._id) === id && s.active)).filter(Boolean);
  if (picked.length !== serviceIds.length) throw new AppError(400, 'One or more selected services are unavailable', 'bad_service');
  const durationMin = picked.reduce((a, s) => a + s.durationMin, 0) * partySize;

  const now = nowInZone(shop.timezone);
  const nowDate = new Date();
  const expiresAt = new Date(nowDate.getTime() + HOLD_MS);

  const hold = await withDistributedLock([`cust:${req.user._id}`, `shop:${shop._id}:${date}`], async () => {
    const [dayBookings, activeHolds] = await Promise.all([
      Booking.find({ shop: shop._id, date, type: 'slot', status: { $in: ['waiting', 'serving', 'done'] } })
        .select('type status durationMin slotStart')
        .lean(),
      SlotHold.find({ shop: shop._id, date, expiresAt: { $gt: nowDate } })
        .select('customer slotStart durationMin')
        .lean(),
    ]);

    if (!canTakeSlot(shop, date, slotStart, durationMin, dayBookings, now, activeHolds, req.user._id)) {
      throw new AppError(409, 'That time was just taken. Please pick another slot.', 'slot_taken');
    }

    await SlotHold.deleteMany({ customer: req.user._id, shop: shop._id });
    return SlotHold.create({
      shop: shop._id,
      customer: req.user._id,
      date,
      slotStart,
      durationMin,
      expiresAt,
    });
  });

  res.status(201).json({
    hold: {
      id: hold._id,
      date: hold.date,
      slotStart: hold.slotStart,
      durationMin: hold.durationMin,
      expiresAt: hold.expiresAt,
      ttlSec: Math.round(HOLD_MS / 1000),
    },
  });
});

/** Release any active slot holds belonging to the current customer (optionally scoped to one shop). */
r.delete('/hold-slot', async (req, res) => {
  const filter = { customer: req.user._id };
  if (req.query.slug) {
    const shop = await Shop.findOne({ slug: String(req.query.slug) }).select('_id').lean();
    if (shop) filter.shop = shop._id;
  }
  await SlotHold.deleteMany(filter);
  res.json({ ok: true });
});

const MAX_ACTIVE = 5;

async function nextToken(shopId, date) {
  const c = await Counter.findOneAndUpdate({ key: `${shopId}:${date}` }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  return c.seq;
}

r.post('/', validate({ body: createBookingDto }), async (req, res) => {
  const { slug, type, serviceIds, slotStart, partySize, forName } = req.valid.body;
  const shop = await Shop.findOne({ slug }).lean();
  if (!shop) throw notFound('Shop not found');
  if (shop.isActive === false) throw forbidden('This shop is temporarily turned off by administrator.', 'shop_disabled');

  const chosen = shop.services.filter((s) => s.active && serviceIds.includes(String(s._id)));
  if (chosen.length !== new Set(serviceIds).size) throw badRequest('One of the services is not available', 'bad_service');
  const durationMin = chosen.reduce((a, s) => a + s.durationMin, 0) * partySize;

  const now = nowInZone(shop.timezone);
  const date = type === 'queue' ? now.date : req.valid.body.date;
  const cleanFor = forName.trim();
  const sameRecipient = (m) => (m.forName || '').trim().toLowerCase() === cleanFor.toLowerCase();

  const booking = await withDistributedLock([`cust:${req.user._id}`, `shop:${shop._id}:${date}`], async () => {
    const mine = await Booking.find({ customer: req.user._id, status: { $in: ['waiting', 'serving'] }, date: { $gte: now.date } })
      .select('shop date type slotStart forName')
      .lean();
    if (mine.length >= MAX_ACTIVE) throw conflict(`You already have ${MAX_ACTIVE} active bookings. Finish or cancel one first.`, 'too_many_active');
    if (type === 'queue' && mine.some((m) => String(m.shop) === String(shop._id) && m.date === date && m.type === 'queue' && sameRecipient(m))) {
      throw conflict(cleanFor ? `You already have a queue booking for ${cleanFor}.` : 'You are already in this queue.', 'already_queued');
    }
    if (type === 'slot' && mine.some((m) => String(m.shop) === String(shop._id) && m.date === date && m.slotStart === slotStart && sameRecipient(m))) {
      throw conflict(cleanFor ? `You already booked this slot for ${cleanFor}.` : 'You already booked this slot.', 'already_booked');
    }

    const dayBookings = await Booking.find({ shop: shop._id, date, status: { $in: ['waiting', 'serving', 'done'] } })
      .select('type status durationMin startedAt token slotStart')
      .lean();

    if (type === 'queue') {
      const d = queueDecision(shop, dayBookings.filter((b) => b.status !== 'done'), durationMin, now);
      if (!d.ok) throw new AppError(409, d.reason, 'queue_unavailable');
    } else {
      if (!shop.settings.acceptSlots) throw new AppError(409, 'This shop does not take slot bookings.', 'slots_unavailable');
      const activeHolds = await SlotHold.find({ shop: shop._id, date, expiresAt: { $gt: new Date() } })
        .select('customer slotStart durationMin')
        .lean();
      if (!canTakeSlot(shop, date, slotStart, durationMin, dayBookings, now, activeHolds, req.user._id)) {
        throw new AppError(409, 'That time was just taken or your reservation expired. Please pick another slot.', 'slot_taken');
      }
      await SlotHold.deleteMany({ customer: req.user._id, shop: shop._id });
    }

    const token = await nextToken(shop._id, date);
    return Booking.create({
      shop: shop._id,
      customer: req.user._id,
      date,
      type,
      token,
      queueOrder: type === 'queue' ? token * 100 : null,
      partySize,
      forName: cleanFor,
      slotStart: type === 'slot' ? slotStart : undefined,
      services: chosen.map((s) => ({ serviceId: s._id, name: s.name, durationMin: s.durationMin * partySize, price: s.price * partySize })),
      durationMin,
    });
  });

  if (booking.type === 'queue') {
    notifyQueueTurnUpdates(shop, date).catch(() => {});
  }
  res.status(201).json({ booking: presentBooking(booking) });
});

r.get('/mine', validate({ query: mineQuery }), async (req, res) => {
  const { scope, page, limit } = req.valid.query;
  const tzNow = (tz) => nowInZone(tz || 'Asia/Kolkata').date;
  const today = tzNow();
  const filter =
    scope === 'active'
      ? { customer: req.user._id, status: { $in: ['waiting', 'serving'] }, date: { $gte: today } }
      : { customer: req.user._id, $or: [{ status: { $in: ['done', 'no_show', 'cancelled'] } }, { date: { $lt: today } }] };
  const [rows, total] = await Promise.all([
    Booking.find(filter).sort({ date: scope === 'active' ? 1 : -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('shop', 'name slug area city').lean(),
    Booking.countDocuments(filter),
  ]);
  res.json({
    total,
    bookings: rows.map((b) => presentBooking(b, { shop: b.shop ? { name: b.shop.name, slug: b.shop.slug, area: b.shop.area, city: b.shop.city } : null })),
  });
});

async function hydrateBooking(b, shop) {
  let live = null;
  if (b.type === 'queue' && ['waiting', 'serving'].includes(b.status)) {
    const todays = await Booking.find({ shop: shop._id, date: b.date, type: 'queue', status: { $in: ['waiting', 'serving'] } })
      .select('type status durationMin startedAt token queueOrder steppedBackCount')
      .lean();
    live = positionOf(b, { settings: shop.settings, _cap: capacityOn(shop, b.date) }, todays);
    const nowServing = todays.filter((x) => x.status === 'serving').map((x) => x.token);
    live = { ...live, nowServing };
  }
  const st = openStatus(shop);
  return presentBooking(b, {
    live,
    shop: { name: shop.name, slug: shop.slug, phone: shop.phone, address: shop.address, area: shop.area, city: shop.city },
    graceMin: shop.settings.graceMin,
    delay: shop.settings.delayMin ? { min: shop.settings.delayMin, note: shop.settings.delayNote } : null,
    shopState: st.state,
  });
}

r.get('/:id', validate({ params: idParam }), async (req, res) => {
  const b = await Booking.findById(req.valid.params.id).lean();
  if (!b || String(b.customer) !== String(req.user._id)) throw notFound('Booking not found');
  const shop = await Shop.findById(b.shop).lean();
  if (!shop) throw notFound('Shop not found');
  res.json({ booking: await hydrateBooking(b, shop) });
});

r.post('/:id/cancel', validate({ params: idParam }), async (req, res) => {
  const updated = await Booking.findOneAndUpdate(
    { _id: req.valid.params.id, customer: req.user._id, status: 'waiting' },
    { $set: { status: 'cancelled' } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    const existing = await Booking.findById(req.valid.params.id).select('customer').lean();
    if (!existing || String(existing.customer) !== String(req.user._id)) throw notFound('Booking not found');
    throw conflict('This booking can no longer be cancelled.');
  }
  if (updated.type === 'queue') {
    const shop = await Shop.findById(updated.shop).lean();
    if (shop) notifyQueueTurnUpdates(shop, updated.date).catch(() => {});
  }
  res.json({ booking: presentBooking(updated) });
});

r.post('/:id/step-back', validate({ params: idParam }), async (req, res) => {
  const target = await Booking.findById(req.valid.params.id).select('shop date customer type').lean();
  if (!target || String(target.customer) !== String(req.user._id)) throw notFound('Booking not found');
  if (target.type !== 'queue') throw badRequest('Only live queue bookings can step back.');

  const shop = await Shop.findById(target.shop).lean();
  if (!shop) throw notFound('Shop not found');

  await withDistributedLock(`shop:${target.shop}:${target.date}`, async () => {
    const waiting = await Booking.find({ shop: target.shop, date: target.date, type: 'queue', status: 'waiting' });
    const orderOf = (x) => x.queueOrder ?? x.token * 100;
    waiting.sort((a, b) => orderOf(a) - orderOf(b) || a.token - b.token);

    const idx = waiting.findIndex((w) => String(w._id) === String(target._id));
    if (idx < 0) throw conflict('This booking can no longer step back.');
    const me = waiting[idx];
    if ((me.steppedBackCount || 0) >= 2) throw conflict('You can step back at most twice per booking.');
    const next = waiting[idx + 1];
    if (!next) throw conflict('Nobody is waiting behind you right now.');

    const myOrder = orderOf(me);
    const nextOrder = orderOf(next);
    next.queueOrder = myOrder;
    me.queueOrder = nextOrder > myOrder ? nextOrder : myOrder + 100;
    me.steppedBackCount = (me.steppedBackCount || 0) + 1;
    // Only reset next-turn notification if moving behind the first 2 waiting spots.
    if (idx + 1 > 1) me.notifiedNext = false;

    await Promise.all([next.save(), me.save()]);
  });

  notifyQueueTurnUpdates(shop, target.date).catch(() => {});
  const updated = await Booking.findById(target._id).lean();
  res.json({ booking: await hydrateBooking(updated, shop) });
});

r.post('/:id/push', validate({ params: idParam, body: pushSubscriptionDto }), async (req, res) => {
  const b = await Booking.findById(req.valid.params.id);
  if (!b || String(b.customer) !== String(req.user._id)) throw notFound('Booking not found');
  const sub = req.valid.body;
  const rest = (b.pushSubscriptions || []).filter((s) => s.endpoint !== sub.endpoint).slice(-2);
  b.pushSubscriptions = [...rest, sub];
  await b.save();
  if (b.type === 'queue' && ['waiting', 'serving'].includes(b.status)) {
    const shop = await Shop.findById(b.shop).lean();
    if (shop) notifyQueueTurnUpdates(shop, b.date).catch(() => {});
  }
  res.json({ ok: true, hasPush: true });
});

r.delete('/:id/push', validate({ params: idParam, body: pushDeleteDto }), async (req, res) => {
  const b = await Booking.findById(req.valid.params.id);
  if (!b || String(b.customer) !== String(req.user._id)) throw notFound('Booking not found');
  const { endpoint } = req.valid.body;
  b.pushSubscriptions = endpoint ? (b.pushSubscriptions || []).filter((s) => s.endpoint !== endpoint) : [];
  await b.save();
  res.json({ ok: true, hasPush: b.pushSubscriptions.length > 0 });
});

r.post('/:id/review', validate({ params: idParam, body: reviewDto }), async (req, res) => {
  const b = await Booking.findOneAndUpdate(
    { _id: req.valid.params.id, customer: req.user._id, status: 'done', reviewed: false },
    { $set: { reviewed: true } },
    { returnDocument: 'after' }
  );
  if (!b) {
    const existing = await Booking.findById(req.valid.params.id).select('customer status reviewed').lean();
    if (!existing || String(existing.customer) !== String(req.user._id)) throw notFound('Booking not found');
    if (existing.status !== 'done') throw forbidden('You can rate a visit after it is completed.');
    throw conflict('You already rated this visit.');
  }
  const { stars, comment, isPublic } = req.valid.body;
  try {
    await Review.create({ shop: b.shop, customer: req.user._id, booking: b._id, stars, comment, isPublic: comment ? isPublic : true });
  } catch (err) {
    await Booking.updateOne({ _id: b._id }, { $set: { reviewed: false } }).catch(() => {});
    throw err;
  }
  await withMemoryLock(`shop-rate:${b.shop}`, async () => {
    const shop = await Shop.findById(b.shop);
    shop.ratingAvg = (shop.ratingAvg * shop.ratingCount + stars) / (shop.ratingCount + 1);
    shop.ratingCount += 1;
    await shop.save();
  });
  res.status(201).json({ ok: true });
});

export default r;
