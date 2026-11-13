// Concurrency & race-condition stress test against live Express + MongoDB.
// Uses an isolated `_race_test` database so existing dev data is untouched.
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.MAIL_PROVIDER = 'console';
process.env.FIREBASE_PROJECT_ID = '';

const hourIn = (tz) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
const TZ = ['Asia/Kolkata', 'Europe/London', 'America/New_York', 'Asia/Tokyo', 'Pacific/Auckland'].find((z) => hourIn(z) >= 2 && hourIn(z) <= 19) || 'Asia/Kolkata';
process.env.DEFAULT_TIMEZONE = TZ;
const dayIn = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() + offset * 86400000));

// Rewrite DB name in MONGODB_URI to an isolated scratch DB before loading config/mongoose
const uri = process.env.MONGODB_URI;
assert.ok(uri, 'MONGODB_URI is required to run race e2e tests');
const u = new URL(uri);
u.pathname = `${u.pathname && u.pathname !== '/' ? u.pathname : '/qline'}_race_test`;
process.env.MONGODB_URI = u.toString();

const { default: mongoose } = await import('mongoose');
const { createApp } = await import('../../src/app.js');
const { Shop } = await import('../../src/models/Shop.js');
const { SlotHold } = await import('../../src/models/SlotHold.js');

await mongoose.connect(process.env.MONGODB_URI);
await mongoose.connection.dropDatabase();

let lastCode = null;
const origLog = console.log;
console.log = (...a) => {
  const m = String(a[0]).match(/Your .* verification code is (\d{6})/);
  if (m) lastCode = m[1];
  else if (!String(a[0]).startsWith('[mail:console]')) origLog(...a);
};

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}/api`;

class Client {
  constructor(app) {
    this.app = app;
    this.jar = new Map();
  }
  async req(method, path, body) {
    const headers = { 'content-type': 'application/json', 'x-qline-app': this.app };
    if (this.jar.size) headers.cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      const k = pair.slice(0, i);
      const v = pair.slice(i + 1);
      if (!v || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) this.jar.delete(k);
      else this.jar.set(k, v);
    }
    let json = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, json };
  }
  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b ?? {}); }
  put(p, b) { return this.req('PUT', p, b); }
  async login(email, name) {
    await mongoose.connection.collection('otps').deleteMany({ email });
    const reqRes = await this.post('/auth/otp/request', { email });
    assert.equal(reqRes.status, 200, JSON.stringify(reqRes.json));
    const code = lastCode;
    const verRes = await this.post('/auth/otp/verify', name ? { email, code, name } : { email, code });
    assert.equal(verRes.status, 200, JSON.stringify(verRes.json));
    return verRes;
  }
}

let passed = 0;
const testCase = async (name, fn) => {
  try {
    await fn();
    passed++;
    origLog(`  ok  ${name}`);
  } catch (e) {
    origLog(`  FAIL ${name}\n       ${e?.stack || e?.message}`);
    process.exitCode = 1;
  }
};

// Setup owner + shop + 10 customers
const owner = new Client('owner');
await owner.login('race-owner@test.dev', 'Shop Owner');
const sRes = await owner.post('/org/shop', {
  name: 'Race Barber',
  city: 'Kochi',
  category: 'barber',
  services: [
    { name: 'Cut 30', durationMin: 30, price: 150 },
    { name: 'Combo 60', durationMin: 60, price: 300 },
  ],
});
assert.equal(sRes.status, 201);
const slug = sRes.json.shop.slug;
const svc30 = sRes.json.shop.services[0].id;
const svc60 = sRes.json.shop.services[1].id;

const allDays = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: true, intervals: [{ start: '00:00', end: '23:59' }] }));
assert.equal((await owner.put('/org/shop/schedule', { weekly: allDays })).status, 200);
assert.equal((await owner.put('/org/shop/settings', { maxQueue: 3, slotIntervalMin: 30, advanceDays: 10 })).status, 200);

const customers = [];
for (let i = 0; i < 10; i++) {
  const c = new Client('customer');
  await c.login(`racer${i}@test.dev`, `Racer ${i}`);
  customers.push(c);
}

const d1 = dayIn(1);
const d2 = dayIn(2);
const d3 = dayIn(3);
const d4 = dayIn(4);
const d5 = dayIn(5);

await testCase('1. 10 customers race for single 1-chair slot -> 1 wins, 9 get slot_taken, token #1 only', async () => {
  const rs = await Promise.all(customers.map((c) => c.post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d1, slotStart: 600 })));
  const wins = rs.filter((r) => r.status === 201);
  const fails = rs.filter((r) => r.status === 409 && r.json?.error === 'slot_taken');
  assert.equal(wins.length, 1);
  assert.equal(fails.length, 9);
  assert.equal(wins[0].json.booking.token, 1, 'token must not waste sequence numbers on failed racers');
});

await testCase('2. 6 customers race for 2-chair slot -> 2 win sequentially (#2, #3), 4 get slot_taken', async () => {
  await owner.put('/org/shop/staff', { staff: [{ name: 'A', offDays: [], offDates: [] }, { name: 'B', offDays: [], offDates: [] }] });
  const rs = await Promise.all(customers.slice(1, 7).map((c) => c.post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d1, slotStart: 720 })));
  const wins = rs.filter((r) => r.status === 201);
  const fails = rs.filter((r) => r.status === 409 && r.json?.error === 'slot_taken');
  assert.equal(wins.length, 2);
  assert.equal(fails.length, 4);
  assert.deepEqual(wins.map((w) => w.json.booking.token).sort((a, b) => a - b), [2, 3]);
});

await testCase('3. Phantom loser interval race (4 rounds): loser 60m never falsely blocks valid adjacent 30m', async () => {
  await owner.put('/org/shop/staff', { staff: [{ name: 'A', offDays: [], offDates: [] }] });
  const t3a = new Client('customer'); await t3a.login('t3a@test.dev', 'T3 A');
  const t3b = new Client('customer'); await t3b.login('t3b@test.dev', 'T3 B');
  const t3c = new Client('customer'); await t3c.login('t3c@test.dev', 'T3 C');
  for (let round = 0; round < 4; round++) {
    const start = 600 + round * 120; // distinct non-overlapping windows on d2
    const rA = t3a.post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d2, slotStart: start });
    const rB = t3b.post('/bookings', { slug, type: 'slot', serviceIds: [svc60], date: d2, slotStart: start });
    const rC = t3c.post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d2, slotStart: start + 30 });
    const [a, b, c] = await Promise.all([rA, rB, rC]);
    if (b.status === 201) {
      assert.equal(a.status, 409);
      assert.equal(c.status, 409);
    } else {
      assert.equal(a.status, 201, `round ${round}: a should win when b loses`);
      assert.equal(c.status, 201, `round ${round}: c must NOT be blocked by phantom loser b`);
    }
  }
});

await testCase('4. Multi-chair consecutive slot fit: chair 1 (10:00-10:30 & 10:30-11:00) leaves chair 2 free for 60m', async () => {
  await owner.put('/org/shop/staff', { staff: [{ name: 'A', offDays: [], offDates: [] }, { name: 'B', offDays: [], offDates: [] }] });
  assert.equal((await customers[3].post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d3, slotStart: 600 })).status, 201);
  assert.equal((await customers[4].post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d3, slotStart: 630 })).status, 201);
  const avail = await customers[5].get(`/shops/${slug}/availability?date=${d3}&serviceIds=${svc60}`);
  assert.equal(avail.json.slots.find((s) => s.start === 600)?.free, true);
  assert.equal((await customers[5].post('/bookings', { slug, type: 'slot', serviceIds: [svc60], date: d3, slotStart: 600 })).status, 201);
});

await testCase('5. Same customer rapid double-tap (4 concurrent calls on 2-chair slot) -> 1 wins, 3 get already_booked', async () => {
  const rs = await Promise.all([0, 1, 2, 3].map(() => customers[6].post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d3, slotStart: 780 })));
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  assert.equal(rs.filter((r) => r.status === 409 && r.json?.error === 'already_booked').length, 3);
});

await testCase('6. Same customer MAX_ACTIVE=5 limit race: 4 concurrent bookings at count=4 -> 1 wins, 3 get too_many_active', async () => {
  const c = customers[7];
  for (let i = 0; i < 4; i++) {
    assert.equal((await c.post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d4, slotStart: 600 + i * 30 })).status, 201);
  }
  const rs = await Promise.all([4, 5, 6, 7].map((i) => c.post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d4, slotStart: 600 + i * 30 })));
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  assert.equal(rs.filter((r) => r.status === 409 && r.json?.error === 'too_many_active').length, 3);
});

await testCase('7. Queue capacity race (maxQueue=3): 2 waiting + 6 simultaneous joins -> strictly 1 wins, 5 get queue_unavailable', async () => {
  await owner.put('/org/shop/staff', { staff: [{ name: 'A', offDays: [], offDates: [] }] });
  assert.equal((await customers[8].post('/bookings', { slug, type: 'queue', serviceIds: [svc30] })).status, 201);
  assert.equal((await customers[9].post('/bookings', { slug, type: 'queue', serviceIds: [svc30] })).status, 201);

  const qRacers = [];
  for (let i = 0; i < 6; i++) {
    const qc = new Client('customer');
    await qc.login(`qracer${i}@test.dev`, `QRacer ${i}`);
    qRacers.push(qc);
  }
  const rs = await Promise.all(qRacers.map((c) => c.post('/bookings', { slug, type: 'queue', serviceIds: [svc30] })));
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  assert.equal(rs.filter((r) => r.status === 409 && r.json?.error === 'queue_unavailable').length, 5);
});

await testCase('8. Same customer double-tap Join Queue -> strictly 1 wins, duplicates get already_queued', async () => {
  await owner.put('/org/shop/settings', { maxQueue: 15 });
  const c = customers[4];
  const rs = await Promise.all([0, 1, 2].map(() => c.post('/bookings', { slug, type: 'queue', serviceIds: [svc30] })));
  assert.equal(rs.filter((r) => r.status === 201).length, 1);
  assert.equal(rs.filter((r) => r.status === 409 && r.json?.error === 'already_queued').length, 2);
});

await testCase('9. Double-cancel yields 1 ok + 1 conflict, and cancelled slot can be re-grabbed concurrently by 1 winner', async () => {
  const b = await customers[3].post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d5, slotStart: 660 });
  assert.equal(b.status, 201);
  const id = b.json.booking.id;
  const cancels = await Promise.all([customers[3].post(`/bookings/${id}/cancel`), customers[3].post(`/bookings/${id}/cancel`)]);
  assert.equal(cancels.filter((r) => r.status === 200).length, 1);
  assert.equal(cancels.filter((r) => r.status === 409).length, 1);

  const grabs = await Promise.all([customers[3], customers[4], customers[5], customers[6]].map((c) => c.post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d5, slotStart: 660 })));
  assert.equal(grabs.filter((r) => r.status === 201).length, 1);
});

await testCase('10. Concurrent double-review on done booking -> 1 wins, ratingCount increments once', async () => {
  const bRes = await customers[8].post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d5, slotStart: 840 });
  assert.equal(bRes.status, 201);
  const bId = bRes.json.booking.id;
  assert.equal((await owner.post(`/org/bookings/${bId}/action`, { action: 'done' })).status, 200);

  const revs = await Promise.all([0, 1, 2].map(() => customers[8].post(`/bookings/${bId}/review`, { stars: 5, comment: 'Great' })));
  assert.equal(revs.filter((r) => r.status === 201).length, 1);
  assert.equal(revs.filter((r) => r.status === 409).length, 2);

  const shopInfo = await customers[0].get(`/shops/${slug}`);
  assert.equal(shopInfo.json.shop.rating.count, 1);
});

await testCase('11. Party size scales duration/price & slot availability, and forName allows guest booking', async () => {
  await owner.put('/org/shop/settings', { maxQueue: 25 });
  const gUser = new Client('customer');
  await gUser.login('group@test.dev', 'Group User');

  const av1 = await gUser.get(`/shops/${slug}/availability?date=${d5}&serviceIds=${svc30}&partySize=1`);
  const av2 = await gUser.get(`/shops/${slug}/availability?date=${d5}&serviceIds=${svc30}&partySize=2`);
  assert.equal(av1.status, 200);
  assert.equal(av2.status, 200);
  assert.equal(av2.json.durationMin, 60);

  const freeForTwo = av2.json.slots.find((s) => s.free);
  assert.ok(freeForTwo, 'Expected a free 60m slot for 2 people');
  const grp = await gUser.post('/bookings', {
    slug,
    type: 'slot',
    serviceIds: [svc30],
    date: d5,
    slotStart: freeForTwo.start,
    partySize: 2,
  });
  assert.equal(grp.status, 201, JSON.stringify(grp.json));
  assert.equal(grp.json.booking.partySize, 2);
  assert.equal(grp.json.booking.durationMin, 60);
  assert.equal(grp.json.booking.services[0].price, 300);

  // Customer joins queue for self, then books a second queue ticket for someone else
  const selfQ = await gUser.post('/bookings', { slug, type: 'queue', serviceIds: [svc30] });
  assert.equal(selfQ.status, 201, JSON.stringify(selfQ.json));
  const guestQ = await gUser.post('/bookings', {
    slug,
    type: 'queue',
    serviceIds: [svc30],
    forName: 'Aarav',
  });
  assert.equal(guestQ.status, 201, JSON.stringify(guestQ.json));
  assert.equal(guestQ.json.booking.forName, 'Aarav');
});

await testCase('12. Step back moves queue booking 1 spot behind without losing token & enforces max 2 limit', async () => {
  await owner.put('/org/shop/settings', { maxQueue: 25 });
  const f1 = new Client('customer'); await f1.login('step1@test.dev', 'Step 1');
  const f2 = new Client('customer'); await f2.login('step2@test.dev', 'Step 2');
  const f3 = new Client('customer'); await f3.login('step3@test.dev', 'Step 3');
  const a = await f1.post('/bookings', { slug, type: 'queue', serviceIds: [svc30] });
  const b = await f2.post('/bookings', { slug, type: 'queue', serviceIds: [svc30] });
  const c = await f3.post('/bookings', { slug, type: 'queue', serviceIds: [svc30] });
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(c.status, 201);

  const aId = a.json.booking.id;
  const aToken = a.json.booking.token;
  const before = (await f1.get(`/bookings/${aId}`)).json.booking.live.ahead;

  const sb1 = await f1.post(`/bookings/${aId}/step-back`);
  assert.equal(sb1.status, 200, JSON.stringify(sb1.json));
  assert.equal(sb1.json.booking.token, aToken);
  assert.equal(sb1.json.booking.steppedBackCount, 1);
  assert.equal(sb1.json.booking.live.ahead, before + 1);

  const sb2 = await f1.post(`/bookings/${aId}/step-back`);
  assert.equal(sb2.status, 200);
  assert.equal(sb2.json.booking.steppedBackCount, 2);
  assert.equal(sb2.json.booking.live.ahead, before + 2);

  const sb3 = await f1.post(`/bookings/${aId}/step-back`);
  assert.equal(sb3.status, 409);
});

await testCase('13. Web Push VAPID key, subscription lifecycle, and optional Live TV screen gating', async () => {
  const vapid = await customers[0].get('/push/vapid-key');
  assert.equal(vapid.status, 200);
  assert.ok(vapid.json.publicKey && vapid.json.publicKey.length > 40);

  const tvOff = await customers[0].get(`/shops/${slug}/tv`);
  assert.equal(tvOff.status, 404);

  assert.equal((await owner.put('/org/shop/settings', { enableTvScreen: true })).status, 200);
  const tvOn = await customers[0].get(`/shops/${slug}/tv`);
  assert.equal(tvOn.status, 200);
  assert.equal(tvOn.json.shop.slug, slug);
  assert.ok(Array.isArray(tvOn.json.waiting));
  if (tvOn.json.waiting.length > 0) {
    assert.equal(tvOn.json.waiting[0].name, undefined);
  }

  // Admin TV video ads CRUD & active filtering on /shops/:slug/tv
  const { User } = await import('../../src/models/User.js');
  const { hashPassword } = await import('../../src/utils/password.js');
  const { env } = await import('../../src/config/env.js');
  const adminEmail = env.adminEmails[0] || 'tv-admin@test.dev';
  await User.findOneAndUpdate(
    { email: adminEmail },
    { $set: { email: adminEmail, name: 'TV Admin', role: 'admin', passwordHash: await hashPassword('AdminPass123!') } },
    { upsert: true }
  );
  const adminClient = new Client('admin');
  const aLogin = await adminClient.post('/auth/login', { email: adminEmail, password: 'AdminPass123!' });
  assert.equal(aLogin.status, 200, JSON.stringify(aLogin.json));

  const ad1 = await adminClient.post('/admin/tv-ads', { title: 'Summer Cut', videoUrl: 'https://cdn.example.com/ad1.mp4', durationSec: 12, active: true });
  const ad2 = await adminClient.post('/admin/tv-ads', { title: 'Paused Ad', videoUrl: 'https://cdn.example.com/ad2.mp4', durationSec: 20, active: false });
  assert.equal(ad1.status, 201, JSON.stringify(ad1.json));
  assert.equal(ad2.status, 201);

  const listAds = await adminClient.get('/admin/tv-ads');
  assert.equal(listAds.status, 200);
  assert.equal(listAds.json.ads.length, 2);
  assert.equal(listAds.json.gapSec, 60);

  const cfgRes = await adminClient.put('/admin/tv-ads/config', { gapSec: 45 });
  assert.equal(cfgRes.status, 200);
  assert.equal(cfgRes.json.gapSec, 45);

  const tvWithAds = await customers[0].get(`/shops/${slug}/tv`);
  assert.equal(tvWithAds.status, 200);
  assert.equal(tvWithAds.json.ads.length, 1);
  assert.equal(tvWithAds.json.adGapSec, 45);
  assert.equal(tvWithAds.json.ads[0].title, 'Summer Cut');
  assert.equal(tvWithAds.json.ads[0].durationSec, 12);

  const updAd = await adminClient.req('PATCH', `/admin/tv-ads/${ad1.json.ad.id}`, { durationSec: 25 });
  assert.equal(updAd.status, 200);
  assert.equal(updAd.json.ad.durationSec, 25);
  assert.equal((await adminClient.req('DELETE', `/admin/tv-ads/${ad1.json.ad.id}`)).status, 200);
  assert.equal((await adminClient.req('DELETE', `/admin/tv-ads/${ad2.json.ad.id}`)).status, 200);

  // Subscribe + unsubscribe push on an active booking
  const pUser = new Client('customer'); await pUser.login('pushuser@test.dev', 'Push User');
  const bRes = await pUser.post('/bookings', { slug, type: 'queue', serviceIds: [svc30] });
  assert.equal(bRes.status, 201);
  const bId = bRes.json.booking.id;
  const sub = {
    endpoint: 'https://push.example.com/sub-e2e-1',
    keys: {
      p256dh: Buffer.alloc(65, 4).toString('base64url'),
      auth: Buffer.alloc(16, 7).toString('base64url'),
    },
  };
  const pAdd = await pUser.post(`/bookings/${bId}/push`, sub);
  assert.equal(pAdd.status, 200);
  assert.equal((await pUser.get(`/bookings/${bId}`)).json.booking.hasPush, true);

  // Trigger delay and owner cancel push hooks cleanly on subscribed booking
  assert.equal((await owner.post('/org/queue/delay', { delayMin: 15, note: 'Running late' })).status, 200);
  assert.equal((await owner.post(`/org/bookings/${bId}/action`, { action: 'cancel' })).status, 200);

  const pDel = await pUser.req('DELETE', `/bookings/${bId}/push`, { endpoint: sub.endpoint });
  assert.equal(pDel.status, 200);
  assert.equal((await pUser.get(`/bookings/${bId}`)).json.booking.hasPush, false);
});

await testCase('14. Disabled org rejects all concurrent booking attempts with 403 shop_disabled', async () => {
  await Shop.updateOne({ slug }, { $set: { isActive: false, disabledReason: 'Audit pause' } });
  const rs = await Promise.all(customers.slice(0, 5).map((c) => c.post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d5, slotStart: 900 })));
  assert.equal(rs.filter((r) => r.status === 403 && r.json?.error === 'shop_disabled').length, 5);
});

await testCase('15. 2-minute SlotHold race, availability masking, release, and expiration recovery', async () => {
  await Shop.updateOne(
    { slug },
    { $set: { isActive: true, disabledReason: '', staff: [{ name: 'Chair 1', active: true, offDays: [], offDates: [] }] } }
  );
  const cands = customers.slice(0, 4);
  const holdRaces = await Promise.all(cands.map((c) => c.post('/bookings/hold-slot', { slug, date: d5, slotStart: 960, serviceIds: [svc30] })));
  const winners = holdRaces.map((r, i) => ({ r, c: cands[i] })).filter((x) => x.r.status === 201);
  assert.equal(winners.length, 1);
  assert.equal(holdRaces.filter((r) => r.status === 409 && r.json?.error === 'slot_taken').length, 3);

  const holder = winners[0].c;
  const rival = cands.find((c) => c !== holder);
  assert.equal(winners[0].r.json.hold.ttlSec, 120);

  // Public availability reflects the temporary lock
  const avHeld = await rival.get(`/shops/${slug}/availability?date=${d5}&serviceIds=${svc30}`);
  assert.equal(avHeld.json.slots.find((s) => s.start === 960).free, false);

  // Rival cannot steal the held slot via direct booking; holder can confirm it and consume the hold
  const rivalBook = await rival.post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d5, slotStart: 960 });
  assert.equal(rivalBook.status, 409);
  const holderBook = await holder.post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d5, slotStart: 960 });
  assert.equal(holderBook.status, 201);
  assert.equal(await SlotHold.countDocuments({}), 0);

  // Switching held slot releases previous slot; DELETE releases immediately
  assert.equal((await rival.post('/bookings/hold-slot', { slug, date: d5, slotStart: 990, serviceIds: [svc30] })).status, 201);
  assert.equal((await rival.post('/bookings/hold-slot', { slug, date: d5, slotStart: 1020, serviceIds: [svc30] })).status, 201);
  const avSwitch = await holder.get(`/shops/${slug}/availability?date=${d5}&serviceIds=${svc30}`);
  assert.equal(avSwitch.json.slots.find((s) => s.start === 990).free, true);
  assert.equal(avSwitch.json.slots.find((s) => s.start === 1020).free, false);

  assert.equal((await rival.req('DELETE', `/bookings/hold-slot?slug=${slug}`)).status, 200);
  const avDel = await holder.get(`/shops/${slug}/availability?date=${d5}&serviceIds=${svc30}`);
  assert.equal(avDel.json.slots.find((s) => s.start === 1020).free, true);

  // Expired hold is ignored even before MongoDB TTL sweep cleans it up
  assert.equal((await rival.post('/bookings/hold-slot', { slug, date: d5, slotStart: 1020, serviceIds: [svc30] })).status, 201);
  await SlotHold.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  const avExp = await holder.get(`/shops/${slug}/availability?date=${d5}&serviceIds=${svc30}`);
  assert.equal(avExp.json.slots.find((s) => s.start === 1020).free, true);
  const holderBookExp = await holder.post('/bookings', { slug, type: 'slot', serviceIds: [svc30], date: d5, slotStart: 1020 });
  assert.equal(holderBookExp.status, 201);
});

origLog(`\n${passed} race/concurrency checks passed${process.exitCode ? ', some FAILED' : ''}`);
await mongoose.connection.dropDatabase();
server.close();
await mongoose.disconnect();
process.exit(process.exitCode || 0);

