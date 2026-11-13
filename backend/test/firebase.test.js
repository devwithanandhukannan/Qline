import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

Object.assign(process.env, {
  NODE_ENV: 'test', MONGODB_URI: 'mongodb://127.0.0.1/none', MAIL_PROVIDER: 'console',
  JWT_ACCESS_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40), OTP_PEPPER: 'c'.repeat(40),
});
const { verifyFirebaseIdToken, setKeyProviderForTests } = await import('../src/services/firebase.js');
const { otpEmail, welcomeEmail } = await import('../src/services/emailTemplates.js');

const PROJECT = 'demo-project';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pub = publicKey.export({ type: 'spki', format: 'pem' });
setKeyProviderForTests(async () => ({ k1: pub }));

const now = () => Math.floor(Date.now() / 1000);
const claims = (o = {}) => ({
  iss: `https://securetoken.google.com/${PROJECT}`, aud: PROJECT, sub: 'uid-123', auth_time: now() - 5,
  email: 'Asha@Example.com', email_verified: true, name: 'Asha Nair', firebase: { sign_in_provider: 'google.com' }, ...o,
});
const sign = (c, key = privateKey, opts = {}) => jwt.sign(c, key, { algorithm: 'RS256', keyid: 'k1', expiresIn: '1h', ...opts });
const bad = (token, code) => assert.rejects(() => verifyFirebaseIdToken(token, PROJECT), (e) => (code ? e.code === code : true));

test('accepts a valid Google token and normalises the email', async () => {
  const u = await verifyFirebaseIdToken(sign(claims()), PROJECT);
  assert.deepEqual(u, { uid: 'uid-123', email: 'asha@example.com', name: 'Asha Nair' });
});
test('rejects wrong audience, issuer, expiry, signature and key id', async () => {
  await bad(sign(claims({ aud: 'other' })));
  await bad(sign(claims({ iss: 'https://evil.example' })));
  await bad(jwt.sign(claims(), privateKey, { algorithm: 'RS256', keyid: 'k1', expiresIn: -10 }));
  await bad(sign(claims(), other.privateKey));
  await bad(jwt.sign(claims(), privateKey, { algorithm: 'RS256', keyid: 'unknown', expiresIn: '1h' }), 'bad_token');
});
test('rejects algorithm confusion and unsigned tokens', async () => {
  await bad(jwt.sign(claims(), pub, { algorithm: 'HS256', keyid: 'k1', expiresIn: '1h' }), 'bad_token');
  const none = `${Buffer.from('{"alg":"none","kid":"k1"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims())).toString('base64url')}.`;
  await bad(none, 'bad_token');
  await bad('not-a-token', 'bad_token');
});
test('rejects unverified email, other providers and future auth_time', async () => {
  await bad(sign(claims({ email_verified: false })), 'unverified_email');
  await bad(sign(claims({ firebase: { sign_in_provider: 'password' } })), 'bad_provider');
  await bad(sign(claims({ auth_time: now() + 3600 })));
  await bad(sign(claims({ sub: '' })));
});
test('disabled when no project id', async () => {
  await assert.rejects(() => verifyFirebaseIdToken(sign(claims()), ''), (e) => e.code === 'google_disabled');
});

test('email templates: code shown, html escaped, no leftover placeholders', () => {
  const o = otpEmail('123456', 10);
  assert.match(o.html, /123456/); assert.match(o.subject, /123456/); assert.match(o.text, /10 minutes/);
  const w = welcomeEmail({ name: '<script>alert(1)</script> Bob', role: 'customer', appUrl: 'https://x.test/explore' });
  assert.ok(!w.html.includes('<script>')); assert.match(w.html, /&lt;script&gt;/);
  assert.match(w.html, /href="https:\/\/x\.test\/explore"/);
  assert.ok(!/undefined|\[object/.test(o.html + w.html));
});
