import { openStatus } from './schedule.js';

// Waiting time for a NEW person joining the live queue.
// work remaining = what is being served now + everyone already waiting, split over the working barbers.
export function estimateQueue(shop, todays, now, resourceId = null) {
  const status = openStatus(shop, now);
  let cap = status.capacity || 1;
  let live = todays.filter((b) => b.type === 'queue' && ['waiting', 'serving'].includes(b.status));

  if (resourceId) {
    cap = 1;
    live = live.filter((b) => !b.resourceId || String(b.resourceId) === String(resourceId));
  }

  let work = 0;
  for (const b of live) {
    if (b.status === 'serving' && b.startedAt) {
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(b.startedAt).getTime()) / 60000));
      work += Math.max(2, b.durationMin - elapsed);
    } else {
      work += b.durationMin;
    }
  }
  const delay = shop.settings.delayMin || 0;
  const waitMin = Math.ceil(work / cap) + delay;
  return { ahead: live.length, waitMin, capacity: cap, status };
}

// Can a new queue member still be finished before closing?
export function queueDecision(shop, todays, durationMin, now, resourceId = null) {
  const { settings } = shop;
  const est = estimateQueue(shop, todays, now, resourceId);
  if (est.status.state !== 'open') {
    return { ok: false, reason: est.status.state === 'later' ? 'The shop has not opened yet.' : 'The shop is closed right now.', ...est };
  }
  if (!settings.acceptQueue) return { ok: false, reason: 'This shop is not taking queue entries. Please book a slot.', ...est };
  if (settings.queuePaused) return { ok: false, reason: 'The queue is paused by the shop for a moment.', ...est };
  const totalLive = todays.filter((b) => b.type === 'queue' && ['waiting', 'serving'].includes(b.status)).length;
  if (totalLive >= settings.maxQueue || est.ahead >= settings.maxQueue) {
    return { ok: false, reason: 'The queue is full for today.', ...est };
  }
  if (now.minutes + est.waitMin + durationMin > est.status.closesAt) {
    return { ok: false, reason: 'The queue has reached closing time for today. Try a slot on another day.', ...est };
  }
  return { ok: true, ...est };
}

// Position and ETA for an existing booking
export function positionOf(booking, shop, todays) {
  if (booking.status !== 'waiting' && booking.status !== 'serving') return null;
  const cap = Math.max(1, shop._cap ?? 1);
  const orderOf = (x) => x.queueOrder ?? x.token * 100;
  let live = todays
    .filter((b) => b.type === 'queue' && ['waiting', 'serving'].includes(b.status))
    .sort((a, b) => orderOf(a) - orderOf(b) || a.token - b.token);

  if (booking.resourceId) {
    live = live.filter((b) => !b.resourceId || String(b.resourceId) === String(booking.resourceId));
  }

  const idx = live.findIndex((b) => String(b._id) === String(booking._id));
  if (idx < 0) return null;
  let work = 0;
  for (const b of live.slice(0, idx)) {
    if (b.status === 'serving' && b.startedAt) {
      const elapsed = Math.max(0, Math.floor((Date.now() - new Date(b.startedAt).getTime()) / 60000));
      work += Math.max(2, b.durationMin - elapsed);
    } else work += b.durationMin;
  }
  const hasWaitingBehind = live.slice(idx + 1).some((b) => b.status === 'waiting');
  return {
    ahead: idx,
    etaMin: booking.status === 'serving' ? 0 : Math.ceil(work / (booking.resourceId ? 1 : cap)) + (shop.settings?.delayMin || 0),
    canStepBack: booking.status === 'waiting' && (booking.steppedBackCount || 0) < 2 && hasWaitingBehind,
  };
}
