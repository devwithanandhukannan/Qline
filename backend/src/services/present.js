import { nowInZone, minToHHMM } from '../utils/time.js';
import { openStatus, resolveDay } from './schedule.js';
import { estimateQueue } from './queue.js';
import { Booking } from '../models/Booking.js';

export const publicService = (s) => ({ id: String(s._id), name: s.name, durationMin: s.durationMin, price: s.price });

export const publicStaff = (s) => ({
  id: String(s._id),
  name: s.name,
  active: s.active !== false,
  offDays: s.offDays || [],
  offDates: s.offDates || [],
});

export const publicTable = (t) => ({
  id: String(t._id),
  name: t.name,
  capacity: t.capacity || 2,
  active: t.active !== false,
});

// What a customer sees about a shop
export async function presentShop(shop, { withQueue = true, resourceId = null } = {}) {
  const now = nowInZone(shop.timezone);
  const status = openStatus(shop, now);
  const today = resolveDay(shop, now.date);
  let queue = null;
  if (withQueue && status.state === 'open') {
    const todays = await Booking.find({ shop: shop._id, date: now.date, status: { $in: ['waiting', 'serving'] } })
      .select('type status durationMin startedAt token resourceId')
      .lean();
    const est = estimateQueue(shop, todays, now, resourceId);
    queue = { ahead: est.ahead, waitMin: est.waitMin, accepting: shop.settings.acceptQueue && !shop.settings.queuePaused, paused: shop.settings.queuePaused, delayMin: shop.settings.delayMin, delayNote: shop.settings.delayNote };
  }
  return {
    id: String(shop._id),
    slug: shop.slug,
    name: shop.name,
    category: shop.category,
    description: shop.description,
    phone: shop.phone,
    address: shop.address,
    area: shop.area,
    city: shop.city,
    lat: shop.lat ?? null,
    lng: shop.lng ?? null,
    images: shop.images || [],
    rating: { avg: Math.round(shop.ratingAvg * 10) / 10, count: shop.ratingCount },
    services: (shop.services || []).filter((s) => s.active).map(publicService),
    staff: shop.category !== 'cafe' ? (shop.staff || []).filter((s) => s.active).map(publicStaff) : [],
    tables: shop.category === 'cafe' ? (shop.tables || []).filter((t) => t.active).map(publicTable) : [],
    settings: {
      acceptQueue: shop.settings.acceptQueue,
      acceptSlots: shop.settings.acceptSlots,
      slotIntervalMin: shop.settings.slotIntervalMin,
      advanceDays: shop.settings.advanceDays,
      maxQueue: shop.settings.maxQueue,
      graceMin: shop.settings.graceMin,
      allowStaffSelection: shop.category !== 'cafe' && !!shop.settings.allowStaffSelection,
      allowTableSelection: shop.category === 'cafe' && !!shop.settings.allowTableSelection,
    },
    today: {
      date: now.date,
      state: status.state,
      closesAt: status.closesAt != null ? minToHHMM(status.closesAt) : null,
      opensAt: status.state === 'later' ? minToHHMM(status.opensAtMin) : status.opensAt || null,
      note: today.note || status.reason || '',
      hours: today.intervals.map((i) => ({ start: minToHHMM(i.start), end: minToHHMM(i.end) })),
    },
    queue,
  };
}

export const firstName = (n = '') => String(n).trim().split(/\s+/)[0] || 'Customer';

export const presentBooking = (b, extra = {}) => ({
  id: String(b._id),
  shopId: String(b.shop?._id || b.shop),
  date: b.date,
  type: b.type,
  token: b.token,
  slotTime: b.slotStart != null ? minToHHMM(b.slotStart) : null,
  services: (b.services || []).map((s) => ({ name: s.name, durationMin: s.durationMin, price: s.price })),
  durationMin: b.durationMin,
  partySize: b.partySize || 1,
  forName: b.forName || '',
  resourceId: b.resourceId ? String(b.resourceId) : null,
  resourceName: b.resourceName || '',
  resourceType: b.resourceType || null,
  steppedBackCount: b.steppedBackCount || 0,
  hasPush: (b.pushSubscriptions || []).length > 0,
  status: b.status,
  reviewed: b.reviewed,
  createdAt: b.createdAt,
  ...extra,
});
