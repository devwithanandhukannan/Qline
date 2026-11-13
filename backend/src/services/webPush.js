import { env } from '../config/env.js';
import { SystemConfig } from '../models/SystemConfig.js';
import { Booking } from '../models/Booking.js';
import { encryptWebPushPayload, generateVapidKeyPair, privateKeyFromVapid, signVapidJwt } from '../utils/webPushCrypto.js';

let cachedKeys = null;

export async function getVapidConfig() {
  if (cachedKeys) return cachedKeys;
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    cachedKeys = {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKeyObj: privateKeyFromVapid(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY),
    };
    return cachedKeys;
  }

  let rec = await SystemConfig.findById('vapid').lean();
  if (!rec) {
    const pair = generateVapidKeyPair();
    try {
      rec = await SystemConfig.create({ _id: 'vapid', data: { publicKey: pair.publicKey, privateKey: pair.privateKey } });
    } catch {
      rec = await SystemConfig.findById('vapid').lean();
    }
  }
  const { publicKey, privateKey } = rec.data;
  cachedKeys = {
    publicKey,
    privateKeyObj: privateKeyFromVapid(publicKey, privateKey),
  };
  return cachedKeys;
}

export async function sendWebPush(subscription, payload) {
  const { publicKey, privateKeyObj } = await getVapidConfig();
  const audience = new URL(subscription.endpoint).origin;
  const jwt = signVapidJwt({ audience, subject: env.VAPID_SUBJECT, privateKeyObj });
  const body = encryptWebPushPayload(subscription, JSON.stringify(payload));

  const res = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '120',
      Urgency: 'high',
    },
    body,
  });

  if (res.status === 404 || res.status === 410) {
    return { gone: true, status: res.status };
  }
  return { ok: res.ok, status: res.status };
}

async function deliverToBooking(booking, payload) {
  const subs = booking.pushSubscriptions || [];
  if (!subs.length) return;
  const dead = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        const res = await sendWebPush(s, payload);
        if (res.gone) dead.push(s.endpoint);
        else if (!res.ok) console.error(`[webpush] delivery failed (${res.status}) for booking ${booking._id}`);
      } catch (err) {
        console.error('[webpush] network error:', err?.message || err);
      }
    })
  );
  if (dead.length) {
    await Booking.updateOne({ _id: booking._id }, { $pull: { pushSubscriptions: { endpoint: { $in: dead } } } }).catch(() => {});
  }
}

const bookingUrl = (id) => {
  const baseUrl = env.CUSTOMER_APP_URL ? env.CUSTOMER_APP_URL.replace(/\/$/, '') : '';
  return `${baseUrl}/b/${id}`;
};

/**
 * Sends a status push (cancelled by shop, or slot turn started) to a subscribed booking.
 */
export async function notifyBookingStatus(shop, booking, action) {
  if (!booking?.pushSubscriptions?.length) return;
  const url = bookingUrl(booking._id);
  if (action === 'cancel') {
    await deliverToBooking(booking, {
      title: `Booking cancelled at ${shop.name}`,
      body: `Token #${booking.token} was cancelled by the shop.`,
      url,
      tag: `qline-cancel-${booking._id}`,
    });
  } else if (action === 'start' && booking.type === 'slot' && !booking.notifiedTurn) {
    const claimed = await Booking.findOneAndUpdate({ _id: booking._id, notifiedTurn: false }, { $set: { notifiedTurn: true, notifiedNext: true } });
    if (claimed) {
      await deliverToBooking(booking, {
        title: `It's your turn at ${shop.name}!`,
        body: `Token #${booking.token} is ready now. Please head to the counter.`,
        url,
        tag: `qline-turn-${booking._id}`,
      });
    }
  }
}

/**
 * Alerts all waiting customers for today with push subscriptions when the shop posts a delay.
 */
export async function notifyShopDelay(shop, date, delayMin, delayNote) {
  if (!delayMin || delayMin <= 0) return;
  const waiting = await Booking.find({
    shop: shop._id,
    date,
    status: 'waiting',
    'pushSubscriptions.0': { $exists: true },
  }).lean();
  if (!waiting.length) return;
  const body = `Shop is running ~${delayMin} min late${delayNote ? `: ${delayNote}` : '.'}`;
  await Promise.all(
    waiting.map((b) =>
      deliverToBooking(b, {
        title: `Delay update from ${shop.name}`,
        body,
        url: bookingUrl(b._id),
        tag: `qline-delay-${shop._id}-${date}`,
      })
    )
  );
}

/**
 * Checks active queue bookings for a shop+date and notifies:
 *  - anyone now `serving` (`notifiedTurn`)
 *  - waiting customers at index 0 or 1 (`ahead <= 1`, `notifiedNext`)
 */
export async function notifyQueueTurnUpdates(shop, date) {
  const live = await Booking.find({
    shop: shop._id,
    date,
    type: 'queue',
    status: { $in: ['waiting', 'serving'] },
    'pushSubscriptions.0': { $exists: true },
  }).lean();
  if (!live.length) return;

  // Compute true queue position among ALL waiting bookings (even those without push)
  const allWaiting = await Booking.find({ shop: shop._id, date, type: 'queue', status: 'waiting' })
    .select('_id token queueOrder resourceId')
    .lean();
  allWaiting.sort((a, b) => (a.queueOrder ?? a.token * 100) - (b.queueOrder ?? b.token * 100) || a.token - b.token);

  const getAheadCount = (booking) => {
    if (booking.resourceId) {
      const rel = allWaiting.filter((w) => !w.resourceId || String(w.resourceId) === String(booking.resourceId));
      const idx = rel.findIndex((w) => String(w._id) === String(booking._id));
      return idx >= 0 ? idx : null;
    }
    const idx = allWaiting.findIndex((w) => String(w._id) === String(booking._id));
    return idx >= 0 ? idx : null;
  };

  const baseUrl = env.CUSTOMER_APP_URL ? env.CUSTOMER_APP_URL.replace(/\/$/, '') : '';

  for (const b of live) {
    const url = `${baseUrl}/b/${b._id}`;
    if (b.status === 'serving' && !b.notifiedTurn) {
      const claimed = await Booking.findOneAndUpdate(
        { _id: b._id, notifiedTurn: false },
        { $set: { notifiedTurn: true, notifiedNext: true } }
      );
      if (claimed) {
        await deliverToBooking(b, {
          title: `It's your turn at ${shop.name}!`,
          body: `Token #${b.token} is now serving. Please head to the chair.`,
          url,
          tag: `qline-turn-${b._id}`,
        });
      }
    } else if (b.status === 'waiting' && !b.notifiedNext) {
      const ahead = getAheadCount(b);
      if (ahead != null && ahead <= 1) {
        const claimed = await Booking.findOneAndUpdate(
          { _id: b._id, notifiedNext: false },
          { $set: { notifiedNext: true } }
        );
        if (claimed) {
          await deliverToBooking(b, {
            title: ahead === 0 ? `You are next at ${shop.name}` : `Almost your turn at ${shop.name}`,
            body: ahead === 0 ? `Token #${b.token} is next in line. Head to the shop now.` : `Only 1 person ahead of Token #${b.token}. Please head over soon.`,
            url,
            tag: `qline-next-${b._id}`,
          });
        }
      }
    }
  }
}

