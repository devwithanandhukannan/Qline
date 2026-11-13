// End-to-end API test. Needs a MongoDB reachable at MONGODB_URI. Run: npm run test:e2e
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.MAIL_PROVIDER = 'console';
process.env.FIREBASE_PROJECT_ID = 'demo-project';
// Pick a time zone where it is currently mid-day, so the "queue closes at 23:59" rule cannot flake when the suite runs near midnight
const hourIn = (tz) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
const TZ = ['Asia/Kolkata', 'Europe/London', 'America/New_York', 'Asia/Tokyo', 'Pacific/Auckland'].find((z) => hourIn(z) >= 3 && hourIn(z) <= 19);
process.env.DEFAULT_TIMEZONE = TZ;
const dayIn = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() + offset * 86400000));
const { default: mongoose } = await import('mongoose');
const { env } = await import('../../src/config/env.js');
const { createApp } = await import('../../src/app.js');

await mongoose.connect(env.MONGODB_URI);
await mongoose.connection.dropDatabase();

// capture OTP codes from the console mail provider
let lastCode = null;
const origLog = console.log;
console.log = (...a) => {
  const m = String(a[0]).match(/Your .* verification code is (\d{6})/);
  if (m) lastCode = m[1];
  else if (!String(a[0]).startsWith('[mail:console]')) origLog(...a);
};

const { setKeyProviderForTests } = await import('../../src/services/firebase.js');
const { default: jwt } = await import('jsonwebtoken');
const { default: crypto } = await import('node:crypto');
const gk = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
setKeyProviderForTests(async () => ({ g1: gk.publicKey.export({ type: 'spki', format: 'pem' }) }));
const gtoken = (email, name = 'Gita Rao', extra = {}) => jwt.sign({ iss: 'https://securetoken.google.com/demo-project', aud: 'demo-project', sub: 'u-' + email, auth_time: Math.floor(Date.now() / 1000) - 5, email, email_verified: true, name, firebase: { sign_in_provider: 'google.com' }, ...extra }, gk.privateKey, { algorithm: 'RS256', keyid: 'g1', expiresIn: '1h' });

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}/api`;

class Client {
  constructor(app) { this.app = app; this.jar = new Map(); }
  async req(method, path, body, extra = {}) {
    const headers = { 'content-type': 'application/json', 'x-qline-app': this.app, ...extra };
    if (this.jar.size) headers.cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(';'); const i = pair.indexOf('=');
      const k = pair.slice(0, i), v = pair.slice(i + 1);
      if (!v || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) this.jar.delete(k); else this.jar.set(k, v);
    }
    let json = null; try { json = await res.json(); } catch {}
    return { status: res.status, json };
  }
  get(p, h) { return this.req('GET', p, undefined, h); }
  post(p, b) { return this.req('POST', p, b ?? {}); }
  put(p, b) { return this.req('PUT', p, b); }
  del(p) { return this.req('DELETE', p); }
  async login(email, name) {
    let r = await this.post('/auth/otp/request', { email });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const code = lastCode;
    if (name === undefined) { r = await this.post('/auth/otp/verify', { email, code }); }
    else { r = await this.post('/auth/otp/verify', { email, code, name }); }
    return r;
  }
}

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; origLog(`  ok  ${name}`); } catch (e) { origLog(`  FAIL ${name}\n       ${e.message}`); process.exitCode = 1; } };

const owner = new Client('owner');
const cust = new Client('customer');
const cust2 = new Client('customer');
const owner2 = new Client('owner');
let shop, slug, svcId, bookingId;

await t('auth: needs app header', async () => {
  const r = await fetch(base + '/shops'); assert.equal(r.status, 400);
});
await t('auth: new account requires name', async () => {
  const r = await owner.login('owner@test.dev'); assert.equal(r.status, 400); assert.equal(r.json.error, 'name_required');
});
await t('auth: OTP request throttled to 30s gap', async () => {
  const r = await owner.post('/auth/otp/request', { email: 'owner@test.dev' }); assert.equal(r.status, 429);
});
await t('auth: wrong code lockout after max attempts', async () => {
  await mongoose.connection.collection('otps').deleteMany({});
  await owner.post('/auth/otp/request', { email: 'lock@test.dev' });
  for (let i = 0; i < env.OTP_MAX_ATTEMPTS; i++) {
    const r = await owner.post('/auth/otp/verify', { email: 'lock@test.dev', code: '000000', name: 'X Y' });
    assert.equal(r.status, 400);
  }
  const r = await owner.post('/auth/otp/verify', { email: 'lock@test.dev', code: lastCode, name: 'X Y' });
  assert.equal(r.status, 429);
});
await t('auth: owner signup and session cookie flags', async () => {
  await mongoose.connection.collection('otps').deleteMany({});
  const r = await owner.login('owner@test.dev', 'Ravi Kumar');
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.user.role, 'owner');
  const me = await owner.get('/auth/me'); assert.equal(me.status, 200); assert.equal(me.json.user.email, 'owner@test.dev');
});
await t('auth: same email cannot use the other app', async () => {
  await mongoose.connection.collection('otps').deleteMany({});
  const r = await cust.post('/auth/otp/request', { email: 'owner@test.dev' }); assert.equal(r.status, 409); assert.equal(r.json.error, 'wrong_app');
});
await t('auth: refresh rotates and old token is rejected (reuse detection)', async () => {
  const old = owner.jar.get('qline_owner_r');
  const r = await owner.post('/auth/refresh'); assert.equal(r.status, 200);
  assert.notEqual(owner.jar.get('qline_owner_r'), old);
  const thief = new Client('owner'); thief.jar.set('qline_owner_r', old);
  assert.equal((await thief.post('/auth/refresh')).status, 401);
  assert.equal((await owner.post('/auth/refresh')).status, 401, 'family revoked after reuse');
  await owner.login.call(owner, 'owner@test.dev').catch(() => {});
});

await t('owner: re-login after revoked session', async () => {
  owner.jar.clear();
  await mongoose.connection.collection('otps').deleteMany({});
  const r = await owner.login('owner@test.dev'); assert.equal(r.status, 200, JSON.stringify(r.json));
});

await t('org: customer cookies cannot reach org routes', async () => {
  await mongoose.connection.collection('otps').deleteMany({});
  assert.equal((await cust.login('cust1@test.dev', 'Asha Nair')).status, 200);
  const r = await cust.req('GET', '/org/shop', undefined, { 'x-qline-app': 'owner' });
  assert.equal(r.status, 401);
});
await t('org: shop create validates input strictly', async () => {
  assert.equal((await owner.post('/org/shop', { name: 'A', city: 'x' })).status, 400);
  assert.equal((await owner.post('/org/shop', { name: 'Royal Cuts', city: 'Kochi', isAdmin: true })).status, 400, 'unknown field rejected');
  const r = await owner.post('/org/shop', { name: 'Royal Cuts', city: 'Kochi', area: 'Edappally', category: 'barber', services: [{ name: 'Haircut', durationMin: 20, price: 150 }, { name: 'Beard', durationMin: 10, price: 80 }] });
  assert.equal(r.status, 201, JSON.stringify(r.json)); shop = r.json.shop; slug = shop.slug; svcId = shop.services[0].id;
  assert.equal((await owner.post('/org/shop', { name: 'Second', city: 'Kochi' })).status, 409);
});
await t('org: schedule, settings, staff, override', async () => {
  const all = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: true, intervals: [{ start: '00:00', end: '23:59' }] }));
  assert.equal((await owner.put('/org/shop/schedule', { weekly: all })).status, 200);
  assert.equal((await owner.put('/org/shop/schedule', { weekly: [{ day: 1, open: true, intervals: [{ start: '10:00', end: '09:00' }] }] })).status, 400);
  assert.equal((await owner.put('/org/shop/settings', { maxQueue: 3, slotIntervalMin: 30, advanceDays: 7 })).status, 200);
  assert.equal((await owner.put('/org/shop/settings', { acceptQueue: false, acceptSlots: false })).status, 400);
  const st = await owner.put('/org/shop/staff', { staff: [{ name: 'Sam', offDays: [], offDates: [] }] });
  assert.equal(st.status, 200); assert.equal(st.json.shop.staff.length, 1);
  const d = dayIn(2);
  const o = await owner.post('/org/shop/overrides', { date: d, closed: true, note: 'Festival' });
  assert.equal(o.status, 200); assert.equal(o.json.shop.overrides[0].note, 'Festival');
  assert.equal((await owner.post('/org/shop/overrides', { date: '2020-01-01', closed: true })).status, 400, 'past');
  assert.equal((await owner.post('/org/shop/overrides', { date: d, closed: false, intervals: [] })).status, 400);
});

await t('public: search by name/city, NoSQL injection blocked', async () => {
  let r = await cust.get('/shops?q=royal'); assert.equal(r.status, 200); assert.equal(r.json.total, 1);
  r = await cust.get('/shops?city=kochi&lat=9.99&lng=76.3'); assert.equal(r.json.shops[0].distanceKm, null);
  assert.equal((await cust.get('/shops?q[$ne]=x')).status, 400);
  assert.equal((await cust.get('/shops?q=%5B')).status, 200, 'regex chars are escaped');
  r = await cust.get(`/shops/${slug}`); assert.equal(r.status, 200); assert.equal(r.json.shop.today.state, 'open');
  assert.equal(r.json.shop.services.length, 2);
  assert.equal((await cust.get('/shops/does-not-exist')).status, 404);
});
await t('public: availability shows slots and hides the past', async () => {
  const today = dayIn(0);
  const r = await cust.get(`/shops/${slug}/availability?date=${today}&serviceIds=${svcId}`);
  assert.equal(r.status, 200); assert.equal(r.json.open, true);
  assert.ok(r.json.slots.every((s) => s.start >= 0));
  const far = await cust.get('/shops/' + slug + '/availability?date=2030-01-01'); assert.equal(far.json.open, false);
  const closed = dayIn(2);
  const c = await cust.get(`/shops/${slug}/availability?date=${closed}`); assert.equal(c.json.open, false); assert.match(c.json.reason, /Festival/);
});

let slotTime;
await t('booking: slot booking, conflict with second customer, own double booking', async () => {
  const tomorrow = dayIn(1);
  slotTime = { date: tomorrow, start: 11 * 60 };
  let r = await cust.post('/bookings', { slug, type: 'slot', serviceIds: [svcId], date: tomorrow, slotStart: 660 });
  assert.equal(r.status, 201, JSON.stringify(r.json)); assert.equal(r.json.booking.slotTime, '11:00');
  assert.equal((await cust.post('/bookings', { slug, type: 'slot', serviceIds: [svcId], date: tomorrow, slotStart: 660 })).json.error, 'already_booked');
  await mongoose.connection.collection('otps').deleteMany({});
  assert.equal((await cust2.login('cust2@test.dev', 'Bala Menon')).status, 200);
  r = await cust2.post('/bookings', { slug, type: 'slot', serviceIds: [svcId], date: tomorrow, slotStart: 660 });
  assert.equal(r.status, 409); assert.equal(r.json.error, 'slot_taken');
  r = await cust2.post('/bookings', { slug, type: 'slot', serviceIds: [svcId], date: tomorrow, slotStart: 690 });
  assert.equal(r.status, 201);
});
await t('booking: concurrent grab of the last slot gives exactly one winner', async () => {
  const tomorrow = slotTime.date;
  const extra = [];
  for (let i = 0; i < 4; i++) { const c = new Client('customer'); await mongoose.connection.collection('otps').deleteMany({}); await c.login(`race${i}@test.dev`, `Racer ${i}x`); extra.push(c); }
  const rs = await Promise.all(extra.map((c) => c.post('/bookings', { slug, type: 'slot', serviceIds: [svcId], date: tomorrow, slotStart: 780 })));
  assert.equal(rs.filter((x) => x.status === 201).length, 1, JSON.stringify(rs.map((x) => x.status)));
});
await t('booking: queue join, position, max queue, no duplicates', async () => {
  let r = await cust.post('/bookings', { slug, type: 'queue', serviceIds: [svcId] });
  assert.equal(r.status, 201, JSON.stringify(r.json)); bookingId = r.json.booking.id;
  assert.equal((await cust.post('/bookings', { slug, type: 'queue', serviceIds: [svcId] })).json.error, 'already_queued');
  r = await cust2.post('/bookings', { slug, type: 'queue', serviceIds: [svcId] }); assert.equal(r.status, 201);
  const live = await cust2.get(`/bookings/${r.json.booking.id}`);
  assert.equal(live.json.booking.live.ahead, 1); assert.equal(live.json.booking.live.etaMin, 20);
  const info = await cust.get(`/shops/${slug}`); assert.equal(info.json.shop.queue.ahead, 2); assert.equal(info.json.shop.queue.waitMin, 40);
});
await t('booking: other customer cannot read my booking', async () => {
  assert.equal((await cust2.get(`/bookings/${bookingId}`)).status, 404);
  assert.equal((await cust2.post(`/bookings/${bookingId}/cancel`)).status, 404);
});
await t('booking: bad input rejected', async () => {
  assert.equal((await cust.post('/bookings', { slug, type: 'slot', serviceIds: [svcId] })).status, 400);
  assert.equal((await cust.post('/bookings', { slug, type: 'queue', serviceIds: ['abc'] })).status, 400);
  assert.equal((await cust.post('/bookings', { slug, type: 'queue', serviceIds: [svcId], extra: 1 })).status, 400);
  assert.equal((await cust.post('/bookings', { slug, type: 'queue', serviceIds: [{ $ne: 1 }] })).status, 400);
});

await t('owner: live board, start / done / no-show, chair rule', async () => {
  let q = await owner.get('/org/queue'); assert.equal(q.status, 200);
  const rows = q.json.bookings.filter((b) => b.type === 'queue');
  assert.equal(rows.length, 2); assert.equal(q.json.status.capacity, 1);
  const [a, b] = rows;
  assert.equal((await owner.post(`/org/bookings/${a.id}/action`, { action: 'start' })).status, 200);
  assert.equal((await owner.post(`/org/bookings/${b.id}/action`, { action: 'start' })).status, 409, 'one chair, one at a time');
  assert.equal((await owner.post(`/org/bookings/${a.id}/action`, { action: 'done' })).status, 200);
  assert.equal((await owner.post(`/org/bookings/${a.id}/action`, { action: 'done' })).status, 409);
  assert.equal((await owner.post(`/org/bookings/${b.id}/action`, { action: 'no_show' })).status, 200);
  q = await owner.get('/org/queue'); assert.equal(q.json.summary.done, 1);
});
await t('owner: walk-in, pause and delay', async () => {
  const w = await owner.post('/org/walkin', { name: 'Walk Guy', phone: '', serviceIds: [svcId] }); assert.equal(w.status, 201);
  assert.equal((await owner.post('/org/queue/delay', { delayMin: 15, note: 'Back in 15' })).status, 200);
  let info = await cust.get(`/shops/${slug}`); assert.equal(info.json.shop.queue.delayNote, 'Back in 15'); assert.equal(info.json.shop.queue.waitMin, 35);
  await owner.post('/org/queue/pause', { paused: true });
  const r = await cust.post('/bookings', { slug, type: 'queue', serviceIds: [svcId] });
  assert.equal(r.status, 409);
  await owner.post('/org/queue/pause', { paused: false }); await owner.post('/org/queue/delay', { delayMin: 0 });
});
await t('owner: cannot touch another owner shop data', async () => {
  await mongoose.connection.collection('otps').deleteMany({});
  assert.equal((await owner2.login('owner2@test.dev', 'Other Owner')).status, 200);
  const s2 = await owner2.post('/org/shop', { name: 'Fade Lab', city: 'Kochi' }); assert.equal(s2.status, 201);
  const mine = (await owner.get('/org/queue')).json.bookings[0];
  assert.equal((await owner2.post(`/org/bookings/${mine.id}/action`, { action: 'cancel' })).status, 404);
  assert.equal((await owner2.get('/org/customers')).json.total, 0);
});

await t('review: only after done, once, updates rating', async () => {
  assert.equal((await cust2.post(`/bookings/${(await cust2.get('/bookings/mine?scope=past')).json.bookings.find((x) => x.type === 'queue').id}/review`, { stars: 5 })).status, 403, 'no-show cannot review');
  assert.equal((await cust.post(`/bookings/${bookingId}/review`, { stars: 6 })).status, 400);
  assert.equal((await cust.post(`/bookings/${bookingId}/review`, { stars: 5, comment: 'Very neat and on time', isPublic: true })).status, 201);
  assert.equal((await cust.post(`/bookings/${bookingId}/review`, { stars: 4 })).status, 409);
  const s = await cust.get(`/shops/${slug}`); assert.equal(s.json.shop.rating.avg, 5); assert.equal(s.json.shop.rating.count, 1);
  const rv = await cust.get(`/shops/${slug}/reviews`); assert.equal(rv.json.reviews[0].name, 'Asha'); assert.ok(!('email' in rv.json.reviews[0]));
});
await t('org: calendar, day, reports, customers', async () => {
  const today = (await owner.get('/org/queue')).json.date;
  const cal = await owner.get(`/org/calendar?month=${today.slice(0, 7)}`); assert.equal(cal.status, 200);
  const d = cal.json.days.find((x) => x.date === today); assert.ok(d.total >= 3); assert.equal(d.done, 1);
  assert.ok(cal.json.days.some((x) => x.hasOverride && !x.open));
  const day = await owner.get(`/org/day?date=${today}`); assert.ok(day.json.bookings.length >= 3);
  const rep = await owner.get(`/org/reports?from=${today}&to=${today}`); assert.equal(rep.status, 200);
  assert.equal(rep.json.totals.served, 1); assert.equal(rep.json.totals.noShow, 1); assert.equal(rep.json.totals.revenue, 150);
  assert.equal(rep.json.totals.newCustomers, 2); assert.equal(rep.json.totals.walkins, 1);
  assert.equal(rep.json.ratings.avg, 5); assert.equal(rep.json.topServices[0].name, 'Haircut');
  assert.equal((await owner.get(`/org/reports?from=${today}&to=2000-01-01`)).status, 400);
  assert.equal((await owner.get(`/org/reports?from=2020-01-01&to=${today}`)).status, 400, 'over one year');
  const cu = await owner.get('/org/customers'); assert.equal(cu.json.total, 3);
  const f = await owner.get('/org/customers?q=asha'); assert.equal(f.json.total, 1); assert.equal(f.json.customers[0].visits, 1);
});
await t('security: cookies are httpOnly and unknown routes 404 as JSON', async () => {
  const res = await fetch(base + '/auth/otp/request', { method: 'POST', headers: { 'content-type': 'application/json', 'x-qline-app': 'customer' }, body: JSON.stringify({ email: 'cookie@test.dev' }) });
  assert.equal(res.status, 200);
  const nf = await fetch(base + '/nothing', { headers: { 'x-qline-app': 'customer' } }); assert.equal(nf.status, 404);
  const bad = await fetch(base + '/auth/otp/request', { method: 'POST', headers: { 'content-type': 'application/json', 'x-qline-app': 'customer' }, body: '{bad' }); assert.equal(bad.status, 400);
  const big = await fetch(base + '/auth/otp/request', { method: 'POST', headers: { 'content-type': 'application/json', 'x-qline-app': 'customer' }, body: JSON.stringify({ email: 'a@b.co', pad: 'x'.repeat(60000) }) }); assert.equal(big.status, 413);
  assert.ok(res.headers.get('x-powered-by') === null);
  assert.ok(res.headers.get('strict-transport-security'));
  const c = new Client('customer'); await mongoose.connection.collection('otps').deleteMany({});
  const lr = await fetch(base + '/auth/otp/request', { method: 'POST', headers: { 'content-type': 'application/json', 'x-qline-app': 'customer' }, body: JSON.stringify({ email: 'cookie2@test.dev' }) });
  const vr = await fetch(base + '/auth/otp/verify', { method: 'POST', headers: { 'content-type': 'application/json', 'x-qline-app': 'customer' }, body: JSON.stringify({ email: 'cookie2@test.dev', code: lastCode, name: 'Cookie Man' }) });
  const sc = vr.headers.getSetCookie().join('\n'); assert.match(sc, /HttpOnly/i); assert.match(sc, /SameSite=Lax/i);
  void lr; void c;
});
await t('google: sign-in creates a customer, reuses it, enforces app role, rejects bad tokens', async () => {
  const g = new Client('customer');
  assert.equal((await g.get('/auth/config')).json.google, true);
  let r = await g.post('/auth/google', { idToken: gtoken('gita@test.dev') });
  assert.equal(r.status, 200, JSON.stringify(r.json)); assert.equal(r.json.user.name, 'Gita Rao'); assert.equal(r.json.user.role, 'customer');
  assert.equal((await g.get('/auth/me')).status, 200);
  const g2 = new Client('customer');
  r = await g2.post('/auth/google', { idToken: gtoken('gita@test.dev') }); assert.equal(r.status, 200);
  assert.equal(await mongoose.connection.collection('users').countDocuments({ email: 'gita@test.dev' }), 1);
  const o = new Client('owner');
  r = await o.post('/auth/google', { idToken: gtoken('gita@test.dev') }); assert.equal(r.status, 409); assert.equal(r.json.error, 'wrong_app');
  r = await o.post('/auth/google', { idToken: gtoken('x@test.dev', 'X', { email_verified: false }) }); assert.equal(r.status, 401);
  r = await o.post('/auth/google', { idToken: 'x'.repeat(150) }); assert.equal(r.status, 401);
  r = await o.post('/auth/google', { idToken: 'short' }); assert.equal(r.status, 400);
  r = await o.post('/auth/google', { idToken: gtoken('own@test.dev', 'Owner Via Google') }); assert.equal(r.status, 200); assert.equal(r.json.user.role, 'owner');
});
await t('logout clears the session', async () => {
  assert.equal((await cust2.post('/auth/logout')).status, 200);
  assert.equal((await cust2.get('/auth/me')).status, 401);
});

origLog(`\n${passed} checks passed${process.exitCode ? ', some FAILED' : ''}`);
server.close(); await mongoose.disconnect(); process.exit(process.exitCode || 0);
