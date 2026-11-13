import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { badRequest, unauthorized } from '../utils/errors.js';

// Verifies a Firebase ID token (from "Continue with Google") using Google's public signing certificates.
// No service-account secret is needed on the server: only the public project id.
const CERT_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cache = { keys: null, exp: 0 };
async function fetchCerts() {
  if (cache.keys && Date.now() < cache.exp) return cache.keys;
  const res = await fetch(CERT_URL, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Could not load Google certificates (${res.status})`);
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  cache = { keys: await res.json(), exp: Date.now() + maxAge * 1000 };
  return cache.keys;
}

let keyProvider = fetchCerts;
export const setKeyProviderForTests = (fn) => {
  keyProvider = fn;
};

export async function verifyFirebaseIdToken(idToken, projectId = env.FIREBASE_PROJECT_ID) {
  if (!projectId) throw badRequest('Google sign-in is not enabled on this server.', 'google_disabled');
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || decoded.header.alg !== 'RS256' || !decoded.header.kid) throw unauthorized('Google sign-in failed. Please try again.', 'bad_token');

  let keys;
  try {
    keys = await keyProvider();
  } catch (e) {
    console.error('Firebase certs:', e.message);
    throw badRequest('Google sign-in is temporarily unavailable. Please use your email instead.', 'google_unavailable');
  }
  const key = keys[decoded.header.kid];
  if (!key) throw unauthorized('Google sign-in failed. Please try again.', 'bad_token');

  let p;
  try {
    p = jwt.verify(idToken, key, { algorithms: ['RS256'], audience: projectId, issuer: `https://securetoken.google.com/${projectId}` });
  } catch {
    throw unauthorized('Google sign-in expired. Please try again.', 'bad_token');
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof p.sub !== 'string' || !p.sub || p.sub.length > 128) throw unauthorized('Google sign-in failed.', 'bad_token');
  if (typeof p.auth_time !== 'number' || p.auth_time > now + 60) throw unauthorized('Google sign-in failed.', 'bad_token');
  if (p.firebase?.sign_in_provider !== 'google.com') throw unauthorized('Only Google sign-in is accepted here.', 'bad_provider');
  if (!p.email || p.email_verified !== true) throw unauthorized('Your Google email is not verified.', 'unverified_email');
  return { uid: p.sub, email: String(p.email).toLowerCase(), name: String(p.name || '').trim() };
}
