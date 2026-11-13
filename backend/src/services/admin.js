import { env } from '../config/env.js';
import { Shop } from '../models/Shop.js';
import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';
import { Review } from '../models/Review.js';
import { AdminLog } from '../models/AdminLog.js';
import { addDays, daysBetween, minToHHMM, nowInZone } from '../utils/time.js';
import { badRequest, notFound } from '../utils/errors.js';
import { bookingPrice, buildOverviewSeries } from './adminMetrics.js';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function getPlatformOverview({ from, to }) {
  const today = nowInZone(env.DEFAULT_TIMEZONE).date;
  const start = from || addDays(today, -29);
  const end = to || today;
  const span = daysBetween(start, end);
  if (span < 0) throw badRequest('Start date must be before end date');
  if (span > 366) throw badRequest('Choose a date range of one year or less');

  const rangeStartDate = new Date(`${start}T00:00:00+05:30`);
  const rangeEndDate = new Date(`${end}T23:59:59.999+05:30`);

  const [
    allShops,
    totalCustomers,
    totalOwners,
    allTimeBookings,
    rangeBookings,
    newCustomers,
    newShops,
    categoryAgg,
    cityAgg,
    recentLogs,
  ] = await Promise.all([
    Shop.find().select('isActive isListed services category city createdAt').lean(),
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'owner' }),
    Booking.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          served: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
          noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          revenue: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'done'] },
                { $sum: '$services.price' },
                0,
              ],
            },
          },
        },
      },
    ]),
    Booking.find({ date: { $gte: start, $lte: end } })
      .select('shop customer date status services createdAt')
      .lean(),
    User.find({ role: 'customer', createdAt: { $gte: rangeStartDate, $lte: rangeEndDate } })
      .select('createdAt')
      .lean(),
    Shop.find({ createdAt: { $gte: rangeStartDate, $lte: rangeEndDate } })
      .select('createdAt')
      .lean(),
    Booking.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      { $lookup: { from: 'shops', localField: 'shop', foreignField: '_id', as: 's' } },
      { $unwind: { path: '$s', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$s.category', 'other'] },
          bookings: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, { $sum: '$services.price' }, 0] } },
        },
      },
      { $sort: { bookings: -1 } },
    ]),
    Shop.aggregate([
      { $match: { city: { $ne: '' } } },
      { $group: { _id: { $toLower: '$city' }, name: { $first: '$city' }, shops: { $sum: 1 } } },
      { $sort: { shops: -1 } },
      { $limit: 8 },
    ]),
    AdminLog.find().sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const activeOrgs = allShops.filter((s) => s.isActive !== false).length;
  const disabledOrgs = allShops.length - activeOrgs;
  const listedOrgs = allShops.filter((s) => s.isListed && s.isActive !== false).length;
  const withServices = allShops.filter((s) => (s.services || []).some((sv) => sv.active)).length;

  const shopCatCounts = new Map();
  for (const s of allShops) shopCatCounts.set(s.category || 'other', (shopCatCounts.get(s.category || 'other') || 0) + 1);
  const categories = [...new Set([...shopCatCounts.keys(), ...categoryAgg.map((c) => c._id)])].map((cat) => {
    const b = categoryAgg.find((c) => c._id === cat);
    return {
      category: cat,
      shops: shopCatCounts.get(cat) || 0,
      bookings: b?.bookings || 0,
      revenue: b?.revenue || 0,
    };
  }).sort((a, b) => b.bookings - a.bookings || b.shops - a.shops);

  const series = buildOverviewSeries({ from: start, to: end, bookings: rangeBookings, customers: newCustomers, shops: newShops, today, timezone: env.DEFAULT_TIMEZONE });
  const allTime = allTimeBookings[0] || { total: 0, served: 0, noShow: 0, cancelled: 0, revenue: 0 };

  return {
    from: start,
    to: end,
    today,
    platform: {
      orgs: { total: allShops.length, active: activeOrgs, disabled: disabledOrgs, listed: listedOrgs, withServices },
      customers: { total: totalCustomers },
      owners: { total: totalOwners },
      allTime: {
        bookings: allTime.total,
        served: allTime.served,
        noShow: allTime.noShow,
        cancelled: allTime.cancelled,
        revenue: allTime.revenue,
      },
    },
    totals: series.rangeTotals,
    live: series.live,
    daily: series.daily,
    categories,
    cities: cityAgg.map((c) => ({ city: c.name, shops: c.shops })),
    recentLogs: recentLogs.map(presentLog),
  };
}

const presentLog = (l) => ({
  id: String(l._id),
  action: l.action,
  targetId: String(l.targetId),
  targetName: l.targetName,
  adminEmail: l.adminEmail,
  reason: l.reason || '',
  createdAt: l.createdAt,
});

export async function getOrgsList({ q, status, category, sort, page, limit }) {
  const today = nowInZone(env.DEFAULT_TIMEZONE).date;
  const filter = {};
  if (status === 'active') filter.isActive = { $ne: false };
  if (status === 'disabled') filter.isActive = false;
  if (category) filter.category = category;

  if (q) {
    const re = new RegExp(escapeRe(q), 'i');
    const matchingOwners = await User.find({ role: 'owner', $or: [{ name: re }, { email: re }, { phone: re }] })
      .select('_id')
      .lean();
    const ownerIds = matchingOwners.map((u) => u._id);
    filter.$or = [{ name: re }, { slug: re }, { city: re }, { area: re }, ...(ownerIds.length ? [{ owner: { $in: ownerIds } }] : [])];
  }

  const shops = await Shop.find(filter).populate('owner', 'name email phone lastLoginAt createdAt').lean();
  const shopIds = shops.map((s) => s._id);

  const statsAgg = shopIds.length
    ? await Booking.aggregate([
        { $match: { shop: { $in: shopIds } } },
        {
          $group: {
            _id: '$shop',
            totalBookings: { $sum: 1 },
            todayBookings: { $sum: { $cond: [{ $eq: ['$date', today] }, 1, 0] } },
            liveQueue: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$date', today] }, { $in: ['$status', ['waiting', 'serving']] }] },
                  1,
                  0,
                ],
              },
            },
            served: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
            noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
            revenue: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, { $sum: '$services.price' }, 0] } },
            customerIds: { $addToSet: '$customer' },
            lastBookingDate: { $max: '$date' },
          },
        },
      ])
    : [];

  const statsMap = new Map(statsAgg.map((x) => [String(x._id), x]));

  let rows = shops.map((s) => {
    const st = statsMap.get(String(s._id));
    const uniqueCustomers = st ? st.customerIds.filter(Boolean).length : 0;
    return {
      id: String(s._id),
      slug: s.slug,
      name: s.name,
      category: s.category,
      city: s.city,
      area: s.area,
      phone: s.phone,
      isListed: s.isListed,
      isActive: s.isActive !== false,
      disabledReason: s.disabledReason || '',
      disabledAt: s.disabledAt || null,
      servicesCount: (s.services || []).filter((x) => x.active).length,
      staffCount: (s.staff || []).filter((x) => x.active).length,
      rating: { avg: Math.round((s.ratingAvg || 0) * 10) / 10, count: s.ratingCount || 0 },
      createdAt: s.createdAt,
      owner: s.owner
        ? { id: String(s.owner._id), name: s.owner.name, email: s.owner.email, phone: s.owner.phone || '', lastLoginAt: s.owner.lastLoginAt || null }
        : null,
      stats: {
        totalBookings: st?.totalBookings || 0,
        todayBookings: st?.todayBookings || 0,
        liveQueue: st?.liveQueue || 0,
        served: st?.served || 0,
        noShow: st?.noShow || 0,
        revenue: st?.revenue || 0,
        uniqueCustomers,
        lastBookingDate: st?.lastBookingDate || null,
      },
    };
  });

  if (sort === 'bookings') rows.sort((a, b) => b.stats.totalBookings - a.stats.totalBookings || new Date(b.createdAt) - new Date(a.createdAt));
  else if (sort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name));
  else rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    total: rows.length,
    orgs: rows.slice((page - 1) * limit, page * limit),
  };
}

export async function getOrgDetail(shopId) {
  const shop = await Shop.findById(shopId).populate('owner', 'name email phone lastLoginAt createdAt').lean();
  if (!shop) throw notFound('Org not found');

  const today = nowInZone(shop.timezone || env.DEFAULT_TIMEZONE).date;
  const from = addDays(today, -29);

  const [bookings, reviews, logs, allCustomerIds, allTime] = await Promise.all([
    Booking.find({ shop: shop._id, date: { $gte: from, $lte: today } }).populate('customer', 'name email').sort({ date: -1, createdAt: -1 }).lean(),
    Review.find({ shop: shop._id }).sort({ createdAt: -1 }).limit(20).populate('customer', 'name').lean(),
    AdminLog.find({ targetId: shop._id }).sort({ createdAt: -1 }).limit(20).lean(),
    Booking.distinct('customer', { shop: shop._id, customer: { $ne: null } }),
    Booking.aggregate([
      { $match: { shop: shop._id } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          served: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
          noShow: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          waiting: { $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] } },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, { $sum: '$services.price' }, 0] } },
        },
      },
    ]),
  ]);

  const series = buildOverviewSeries({ from, to: today, bookings, customers: [], shops: [], today });
  const totals = allTime[0] || { totalBookings: 0, served: 0, noShow: 0, cancelled: 0, waiting: 0, revenue: 0 };

  return {
    org: {
      id: String(shop._id),
      slug: shop.slug,
      name: shop.name,
      category: shop.category,
      description: shop.description,
      phone: shop.phone,
      address: shop.address,
      area: shop.area,
      city: shop.city,
      timezone: shop.timezone,
      isListed: shop.isListed,
      isActive: shop.isActive !== false,
      disabledReason: shop.disabledReason || '',
      disabledAt: shop.disabledAt || null,
      rating: { avg: Math.round((shop.ratingAvg || 0) * 10) / 10, count: shop.ratingCount || 0 },
      services: (shop.services || []).map((s) => ({ id: String(s._id), name: s.name, durationMin: s.durationMin, price: s.price, active: s.active })),
      staffCount: (shop.staff || []).filter((s) => s.active).length,
      createdAt: shop.createdAt,
      owner: shop.owner
        ? { id: String(shop.owner._id), name: shop.owner.name, email: shop.owner.email, phone: shop.owner.phone || '', lastLoginAt: shop.owner.lastLoginAt || null, createdAt: shop.owner.createdAt }
        : null,
    },
    stats: {
      ...totals,
      uniqueCustomers: allCustomerIds.length,
      waitingNow: series.live.waiting + series.live.serving,
    },
    daily: series.daily,
    recentBookings: bookings.slice(0, 25).map((b) => ({
      id: String(b._id),
      date: b.date,
      type: b.type,
      token: b.token,
      slotTime: b.slotStart != null ? minToHHMM(b.slotStart) : null,
      status: b.status,
      customerName: b.customer?.name || b.guestName || 'Walk-in',
      isWalkin: !b.customer,
      services: (b.services || []).map((s) => s.name),
      price: bookingPrice(b),
    })),
    reviews: reviews.map((v) => ({
      id: String(v._id),
      stars: v.stars,
      comment: v.comment,
      isPublic: v.isPublic,
      name: v.customer?.name || 'Customer',
      createdAt: v.createdAt,
    })),
    logs: logs.map(presentLog),
  };
}

export async function setOrgActiveStatus({ shopId, isActive, reason, cancelWaiting, adminUser }) {
  const shop = await Shop.findById(shopId);
  if (!shop) throw notFound('Org not found');

  const cleanReason = isActive ? '' : (reason?.trim() || 'Disabled by administrator');
  shop.isActive = isActive;
  shop.disabledReason = cleanReason;
  shop.disabledAt = isActive ? null : new Date();
  await shop.save();

  let cancelledCount = 0;
  if (!isActive && cancelWaiting) {
    const today = nowInZone(shop.timezone || env.DEFAULT_TIMEZONE).date;
    const res = await Booking.updateMany(
      { shop: shop._id, date: { $gte: today }, status: 'waiting' },
      { $set: { status: 'cancelled' } }
    );
    cancelledCount = res.modifiedCount || 0;
  }

  const log = await AdminLog.create({
    admin: adminUser._id,
    adminEmail: adminUser.email,
    action: isActive ? 'org_enable' : 'org_disable',
    targetId: shop._id,
    targetName: shop.name,
    reason: cleanReason,
  });

  return {
    org: {
      id: String(shop._id),
      name: shop.name,
      isActive: shop.isActive,
      disabledReason: shop.disabledReason,
      disabledAt: shop.disabledAt,
    },
    cancelledCount,
    log: presentLog(log),
  };
}

export async function getCustomersList({ q, sort, page, limit }) {
  const filter = { role: 'customer' };
  if (q) {
    const re = new RegExp(escapeRe(q), 'i');
    filter.$or = [{ name: re }, { email: re }, { phone: re }];
  }

  const users = await User.find(filter).select('name email phone noShowCount createdAt lastLoginAt').lean();
  const ids = users.map((u) => u._id);

  const statsAgg = ids.length
    ? await Booking.aggregate([
        { $match: { customer: { $in: ids } } },
        {
          $group: {
            _id: '$customer',
            totalBookings: { $sum: 1 },
            completedVisits: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
            cancelledCount: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            noShowCount: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
            spent: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, { $sum: '$services.price' }, 0] } },
            shopIds: { $addToSet: '$shop' },
            lastBookingDate: { $max: '$date' },
          },
        },
      ])
    : [];

  const statsMap = new Map(statsAgg.map((x) => [String(x._id), x]));

  let rows = users.map((u) => {
    const st = statsMap.get(String(u._id));
    return {
      id: String(u._id),
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt || null,
      totalBookings: st?.totalBookings || 0,
      completedVisits: st?.completedVisits || 0,
      cancelledCount: st?.cancelledCount || 0,
      noShows: Math.max(u.noShowCount || 0, st?.noShowCount || 0),
      shopsVisited: st?.shopIds?.length || 0,
      spent: st?.spent || 0,
      lastBookingDate: st?.lastBookingDate || null,
    };
  });

  if (sort === 'bookings') rows.sort((a, b) => b.totalBookings - a.totalBookings || new Date(b.createdAt) - new Date(a.createdAt));
  else if (sort === 'noShows') rows.sort((a, b) => b.noShows - a.noShows || b.totalBookings - a.totalBookings);
  else rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    total: rows.length,
    customers: rows.slice((page - 1) * limit, page * limit),
  };
}

export async function getPlatformActivity({ type, page, limit }) {
  if (type === 'logs') {
    const [rows, total] = await Promise.all([
      AdminLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AdminLog.countDocuments(),
    ]);
    return { total, items: rows.map(presentLog) };
  }

  const [rows, total] = await Promise.all([
    Booking.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('shop', 'name slug category city')
      .populate('customer', 'name email')
      .lean(),
    Booking.countDocuments(),
  ]);

  return {
    total,
    items: rows.map((b) => ({
      id: String(b._id),
      date: b.date,
      type: b.type,
      token: b.token,
      slotTime: b.slotStart != null ? minToHHMM(b.slotStart) : null,
      status: b.status,
      price: bookingPrice(b),
      services: (b.services || []).map((s) => s.name),
      isWalkin: !b.customer,
      customerName: b.customer?.name || b.guestName || 'Walk-in',
      customerEmail: b.customer?.email || '',
      shop: b.shop ? { id: String(b.shop._id), name: b.shop.name, slug: b.shop.slug, city: b.shop.city } : null,
      createdAt: b.createdAt,
    })),
  };
}
