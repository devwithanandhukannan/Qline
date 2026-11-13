import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  encryptWebPushPayload,
  fromB64Url,
  generateVapidKeyPair,
  privateKeyFromVapid,
  signVapidJwt,
  toB64Url,
} from '../src/utils/webPushCrypto.js';
import { positionOf } from '../src/services/queue.js';

function decryptRfc8291(encryptedBuf, uaEcdh, authSecret) {
  const salt = encryptedBuf.subarray(0, 16);
  const rs = encryptedBuf.readUInt32BE(16);
  assert.equal(rs, 4096);
  const idlen = encryptedBuf.readUInt8(20);
  const asPublic = encryptedBuf.subarray(21, 21 + idlen);
  const body = encryptedBuf.subarray(21 + idlen);
  const ciphertext = body.subarray(0, body.length - 16);
  const tag = body.subarray(body.length - 16);

  const shared = uaEcdh.computeSecret(asPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaEcdh.getPublicKey(), asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));

  const decipher = crypto.createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  assert.equal(plain[plain.length - 1], 0x02);
  return plain.subarray(0, plain.length - 1).toString('utf8');
}

test('VAPID keypair + JWT ES256 signature verification', () => {
  const pair = generateVapidKeyPair();
  const pubRaw = fromB64Url(pair.publicKey);
  assert.equal(pubRaw.length, 65);
  assert.equal(pubRaw[0], 0x04);

  const privKey = privateKeyFromVapid(pair.publicKey, pair.privateKey);
  const jwt = signVapidJwt({
    audience: 'https://fcm.googleapis.com',
    subject: 'mailto:alerts@qline.app',
    privateKeyObj: privKey,
  });

  const [hdr, payload, sig] = jwt.split('.');
  const parsedHdr = JSON.parse(fromB64Url(hdr).toString('utf8'));
  const parsedPayload = JSON.parse(fromB64Url(payload).toString('utf8'));
  assert.equal(parsedHdr.alg, 'ES256');
  assert.equal(parsedPayload.aud, 'https://fcm.googleapis.com');
  assert.equal(parsedPayload.sub, 'mailto:alerts@qline.app');

  const pubKeyObj = crypto.createPublicKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: toB64Url(pubRaw.subarray(1, 33)),
      y: toB64Url(pubRaw.subarray(33, 65)),
    },
    format: 'jwk',
  });
  const ok = crypto.verify(
    'sha256',
    Buffer.from(`${hdr}.${payload}`),
    { key: pubKeyObj, dsaEncoding: 'ieee-p1363' },
    fromB64Url(sig)
  );
  assert.equal(ok, true);
});

test('RFC 8291 aes128gcm payload encrypt/decrypt round-trip', () => {
  const ua = crypto.createECDH('prime256v1');
  ua.generateKeys();
  const authSecret = crypto.randomBytes(16);
  const sub = {
    endpoint: 'https://push.example.com/abc',
    keys: {
      p256dh: toB64Url(ua.getPublicKey()),
      auth: toB64Url(authSecret),
    },
  };
  const message = JSON.stringify({ title: 'Qline', body: 'You are next at Fade Studio', url: '/b/123' });
  const encrypted = encryptWebPushPayload(sub, message);
  const decrypted = decryptRfc8291(encrypted, ua, authSecret);
  assert.equal(decrypted, message);
});

test('positionOf respects queueOrder and canStepBack rules', () => {
  const shop = { _cap: 1, settings: { delayMin: 0 } };
  const b1 = { _id: 'b1', type: 'queue', status: 'waiting', token: 1, queueOrder: 200, durationMin: 20, steppedBackCount: 1 };
  const b2 = { _id: 'b2', type: 'queue', status: 'waiting', token: 2, queueOrder: 100, durationMin: 15, steppedBackCount: 0 };
  const b3 = { _id: 'b3', type: 'queue', status: 'waiting', token: 3, queueOrder: 300, durationMin: 15, steppedBackCount: 2 };
  const todays = [b1, b2, b3];

  const pos2 = positionOf(b2, shop, todays);
  assert.equal(pos2.ahead, 0);
  assert.equal(pos2.etaMin, 0);
  assert.equal(pos2.canStepBack, true);

  const pos1 = positionOf(b1, shop, todays);
  assert.equal(pos1.ahead, 1);
  assert.equal(pos1.etaMin, 15);
  assert.equal(pos1.canStepBack, true);

  // Last person in line or stepped back twice cannot step back further
  const pos3 = positionOf(b3, shop, todays);
  assert.equal(pos3.ahead, 2);
  assert.equal(pos3.canStepBack, false);
});

