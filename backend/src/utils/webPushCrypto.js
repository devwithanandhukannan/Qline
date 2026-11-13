import crypto from 'node:crypto';

export const toB64Url = (buf) => Buffer.from(buf).toString('base64url');
export const fromB64Url = (str) => Buffer.from(str, 'base64url');

/**
 * Generates an uncompressed P-256 public key (base64url, 65 bytes) and JWK private key for VAPID.
 */
export function generateVapidKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = privateKey.export({ format: 'jwk' });
  const x = fromB64Url(jwk.x);
  const y = fromB64Url(jwk.y);
  const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y]);
  return {
    publicKey: toB64Url(uncompressed),
    privateKey: jwk.d,
    privateJwk: jwk,
  };
}

/**
 * Rebuilds a Node PrivateKeyObject from raw base64url VAPID public (65B uncompressed) and private (32B d) keys.
 */
export function privateKeyFromVapid(publicKeyB64Url, privateKeyB64Url) {
  const pub = fromB64Url(publicKeyB64Url);
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error('Invalid VAPID public key');
  const x = toB64Url(pub.subarray(1, 33));
  const y = toB64Url(pub.subarray(33, 65));
  return crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', x, y, d: privateKeyB64Url },
    format: 'jwk',
  });
}

/**
 * Signs a VAPID JWT (RFC 8292, ES256).
 */
export function signVapidJwt({ audience, subject, privateKeyObj, expSeconds = 12 * 3600 }) {
  const header = toB64Url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = toB64Url(
    JSON.stringify({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + expSeconds,
      sub: subject,
    })
  );
  const input = `${header}.${claims}`;
  const sig = crypto.sign('sha256', Buffer.from(input), { key: privateKeyObj, dsaEncoding: 'ieee-p1363' });
  return `${input}.${toB64Url(sig)}`;
}

/**
 * Encrypts a JSON/UTF-8 push payload per RFC 8291 (`aes128gcm`).
 */
export function encryptWebPushPayload(subscription, payloadText) {
  const uaPublic = fromB64Url(subscription.keys.p256dh);
  const authSecret = fromB64Url(subscription.keys.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) throw new Error('Invalid subscription p256dh key');
  if (authSecret.length < 16) throw new Error('Invalid subscription auth secret');

  const as = crypto.createECDH('prime256v1');
  as.generateKeys();
  const asPublic = as.getPublicKey();
  const sharedSecret = as.computeSecret(uaPublic);
  const salt = crypto.randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(crypto.hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32));
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));

  const record = Buffer.concat([Buffer.from(payloadText, 'utf8'), Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(record), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(21 + asPublic.length);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(asPublic.length, 20);
  asPublic.copy(header, 21);

  return Buffer.concat([header, ciphertext]);
}

