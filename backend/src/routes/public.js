import { Router } from 'express';
import { SlotHold } from '../models/SlotHold.js';
import { validate } from '../middleware/core.js';
import { slugParam } from '../validators/common.js';
import { searchQuery, availabilityQuery, reviewsQuery } from '../validators/booking.js';
import { Shop } from '../models/Shop.js';
import { Booking } from '../models/Booking.js';
import { Review } from '../models/Review.js';
import { TvAd } from '../models/TvAd.js';
import { SystemConfig } from '../models/SystemConfig.js';
import { notFound } from '../utils/errors.js';
import { presentShop, firstName } from '../services/present.js';
import { buildSlots, openStatus } from '../services/schedule.js';
import { estimateQueue } from '../services/queue.js';
import { getVapidConfig } from '../services/webPush.js';
import { minToHHMM, nowInZone } from '../utils/time.js';

const r = Router();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function km(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

r.get('/shops', validate({ query: searchQuery }), async (req, res) => {
  const { q, city, category, lat, lng, page, limit } = req.valid.query;
  const filter = { isListed: true, isActive: { $ne: false } };
  if (category) filter.category = category;
  if (city) filter.city = new RegExp(`^${escapeRe(city)}`, 'i');
  if (q) {
    const re = new RegExp(escapeRe(q), 'i');
    filter.$or = [{ name: re }, { area: re }, { city: re }, { address: re }];
  }
  const shops = await Shop.find(filter).limit(200).lean();
  let rows = await Promise.all(shops.map((s) => presentShop(s)));
  if (lat != null && lng != null) {
    rows = rows.map((s) => ({ ...s, distanceKm: s.lat != null && s.lng != null ? Math.round(km({ lat, lng }, s) * 10) / 10 : null }));
    rows.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
  } else {
    rows.sort((a, b) => b.rating.count - a.rating.count || a.name.localeCompare(b.name));
  }
  const total = rows.length;
  res.json({ total, shops: rows.slice((page - 1) * limit, page * limit) });
});

r.get('/shops/:slug', validate({ params: slugParam }), async (req, res) => {
  const shop = await Shop.findOne({ slug: req.valid.params.slug }).lean();
  if (!shop || shop.isActive === false) throw notFound('This shop is currently unavailable');
  const resourceId = req.query.resourceId || null;
  res.json({ shop: await presentShop(shop, { resourceId }) });
});

r.get('/push/vapid-key', async (_req, res) => {
  const { publicKey } = await getVapidConfig();
  res.json({ publicKey });
});

r.get('/shops/:slug/availability', validate({ params: slugParam, query: availabilityQuery }), async (req, res) => {
  const shop = await Shop.findOne({ slug: req.valid.params.slug }).lean();
  if (!shop || shop.isActive === false) throw notFound('This shop is currently unavailable');
  const { date, serviceIds, partySize, resourceId } = req.valid.query;
  const ids = serviceIds ? serviceIds.split(',') : [];
  const chosen = ids.length ? shop.services.filter((s) => s.active && ids.includes(String(s._id))) : [];
  const baseDuration = chosen.length ? chosen.reduce((a, s) => a + s.durationMin, 0) : Math.min(...shop.services.filter((s) => s.active).map((s) => s.durationMin), 30);
  const duration = baseDuration * (shop.category === 'cafe' ? 1 : (partySize || 1));
  const bookings = await Booking.find({ shop: shop._id, date, type: 'slot', status: { $in: ['waiting', 'serving', 'done'] } })
    .select('type status slotStart durationMin resourceId')
    .lean();
  const holds = await SlotHold.find({ shop: shop._id, date, expiresAt: { $gt: new Date() } })
    .select('slotStart durationMin resourceId')
    .lean();
  const now = nowInZone(shop.timezone);
  res.json({ date, durationMin: duration, ...buildSlots(shop, date, bookings, duration, now, holds, resourceId, partySize) });
});

r.get('/shops/:slug/tv', validate({ params: slugParam }), async (req, res) => {
  const shop = await Shop.findOne({ slug: req.valid.params.slug }).lean();
  if (!shop || shop.isActive === false) throw notFound('This shop is currently unavailable');
  if (!shop.settings?.enableTvScreen) throw notFound('Live TV display is not enabled for this shop');

  const now = nowInZone(shop.timezone);
  const st = openStatus(shop, now);
  const [rows, ads, tvCfg] = await Promise.all([
    Booking.find({ shop: shop._id, date: now.date, status: { $in: ['waiting', 'serving'] } })
      .select('token queueOrder type slotStart status services durationMin partySize startedAt')
      .lean(),
    TvAd.find({ active: true }).sort({ sortOrder: 1, createdAt: -1 }).select('title videoUrl durationSec').lean(),
    SystemConfig.findById('tvConfig').lean(),
  ]);

  const orderOf = (x) => x.queueOrder ?? x.token * 100;
  const serving = rows
    .filter((b) => b.status === 'serving')
    .sort((a, b) => orderOf(a) - orderOf(b) || a.token - b.token);
  const waiting = rows
    .filter((b) => b.status === 'waiting')
    .sort((a, b) => (a.type === 'queue' && b.type === 'queue' ? orderOf(a) - orderOf(b) : a.token - b.token));

  const est = estimateQueue(shop, rows, now);
  const presentTvRow = (b) => ({
    id: String(b._id),
    token: b.token,
    type: b.type,
    slotTime: b.slotStart != null ? minToHHMM(b.slotStart) : null,
    partySize: b.partySize || 1,
    durationMin: b.durationMin,
    services: (b.services || []).map((s) => s.name),
  });

  res.json({
    shop: {
      name: shop.name,
      slug: shop.slug,
      category: shop.category,
      area: shop.area,
      city: shop.city,
      delayMin: shop.settings.delayMin || 0,
      delayNote: shop.settings.delayNote || '',
      queuePaused: !!shop.settings.queuePaused,
    },
    status: {
      state: st.state,
      closesAt: st.closesAt != null ? minToHHMM(st.closesAt) : null,
      opensAt: st.state === 'later' ? minToHHMM(st.opensAtMin) : st.opensAt || null,
    },
    waitMin: est.waitMin,
    waitingCount: waiting.length,
    serving: serving.map(presentTvRow),
    waiting: waiting.slice(0, 12).map(presentTvRow),
    ads: ads.map((a) => ({ id: String(a._id), title: a.title, videoUrl: a.videoUrl, durationSec: a.durationSec })),
    adGapSec: tvCfg?.data?.gapSec ?? 60,
    updatedAt: new Date().toISOString(),
  });
});

r.get('/shops/:slug/reviews', validate({ params: slugParam, query: reviewsQuery }), async (req, res) => {
  const shop = await Shop.findOne({ slug: req.valid.params.slug }).select('_id isActive').lean();
  if (!shop || shop.isActive === false) throw notFound('This shop is currently unavailable');
  const { page, limit } = req.valid.query;
  const filter = { shop: shop._id, isPublic: true };
  const [rows, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('customer', 'name').lean(),
    Review.countDocuments(filter),
  ]);
  res.json({
    total,
    reviews: rows.map((v) => ({ id: String(v._id), stars: v.stars, comment: v.comment, name: firstName(v.customer?.name || v.guestName || 'Customer'), createdAt: v.createdAt })),
  });
});

export default r;
