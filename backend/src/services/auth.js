import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Otp } from '../models/Otp.js';
import { User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { sendMail } from './mail.js';
import { otpEmail, welcomeEmail } from './emailTemplates.js';
import { verifyFirebaseIdToken } from './firebase.js';
import { verifyPassword } from '../utils/password.js';
import { AppError, badRequest, forbidden, tooMany, unauthorized, conflict } from '../utils/errors.js';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const otpHash = (email, code) => crypto.createHmac('sha256', env.OTP_PEPPER).update(`${email}:${code}`).digest('hex');
const safeEq = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const wrongAppMessage = (existingRole) =>
  existingRole === 'owner'
    ? 'This email is registered as a shop owner. Please use the shop app.'
    : existingRole === 'admin'
    ? 'This email is registered as an administrator. Please use the admin portal.'
    : 'This email is registered as a customer. Please use the customer app.';

function assertAdminAllowed(email, role) {
  if (role === 'admin') {
    throw forbidden('Admin portal uses email and password sign-in.', 'password_only');
  }
}

export async function requestOtp({ email, role }) {
  assertAdminAllowed(email, role);
  const existing = await User.findOne({ email }).select('role').lean();
  if (existing && existing.role !== role) {
    throw conflict(wrongAppMessage(existing.role), 'wrong_app');
  }

  // Per-email throttle: max 3 codes in 10 minutes, at least 30s apart
  const recent = await Otp.find({ email, createdAt: { $gt: new Date(Date.now() - 10 * 60_000) } })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean();
  if (recent.length >= 3) throw tooMany('Too many codes requested. Please wait a few minutes.');
  if (recent[0] && Date.now() - new Date(recent[0].createdAt).getTime() < 30_000) {
    throw tooMany('Please wait 30 seconds before asking for another code.');
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await Otp.create({
    email,
    codeHash: otpHash(email, code),
    expiresAt: new Date(Date.now() + env.OTP_TTL_MIN * 60_000),
  });
  try {
    await sendMail({ to: email, ...otpEmail(code, env.OTP_TTL_MIN) });
  } catch (err) {
    console.error('OTP email failed:', err.message);
    throw new AppError(502, 'We could not send the email right now. Please try again.', 'mail_failed');
  }
  return { sent: true, expiresInMin: env.OTP_TTL_MIN, isNewUser: !existing };
}

export async function verifyOtp({ email, code, role, name }) {
  assertAdminAllowed(email, role);
  const otp = await Otp.findOne({ email, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 });
  if (!otp) throw badRequest('That code has expired. Please request a new one.', 'otp_expired');
  if (otp.attempts >= env.OTP_MAX_ATTEMPTS) {
    await Otp.deleteMany({ email });
    throw tooMany('Too many wrong attempts. Please request a new code.');
  }
  otp.attempts += 1;
  await otp.save();
  if (!safeEq(otp.codeHash, otpHash(email, code))) throw badRequest('That code is not correct.', 'otp_invalid');

  let user = await User.findOne({ email });
  if (user && user.role !== role) throw conflict('This email belongs to a different app.', 'wrong_app');
  // A correct code with no name yet keeps the code valid, so the person only has to add their name
  if (!user && !name) throw badRequest('Please tell us your name to create your account.', 'name_required');
  await Otp.deleteMany({ email });
  let created = false;
  if (!user) {
    user = await User.create({ email, name, role });
    created = true;
  }
  if (created) sendWelcome(user);
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export function signAccess(user) {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: String(user._id),
    expiresIn: `${env.ACCESS_TOKEN_TTL_MIN}m`,
    algorithm: 'HS256',
  });
}

export function verifyAccess(token) {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
}

export async function issueRefresh(user, family = crypto.randomUUID(), userAgent = '') {
  const token = crypto.randomBytes(48).toString('hex');
  await RefreshToken.create({
    user: user._id,
    tokenHash: sha256(token),
    family,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
    userAgent: String(userAgent).slice(0, 200),
  });
  return token;
}

// Rotation with reuse detection: a refresh token works exactly once.
export async function rotateRefresh(token, role, userAgent) {
  const rec = await RefreshToken.findOne({ tokenHash: sha256(token) });
  if (!rec || rec.expiresAt < new Date()) throw unauthorized('Session expired');
  if (rec.usedAt) {
    await RefreshToken.deleteMany({ family: rec.family });
    throw unauthorized('Session expired');
  }
  const user = await User.findById(rec.user);
  if (!user || user.role !== role) throw unauthorized('Session expired');
  if (role === 'admin' && env.adminEmails.length > 0 && !env.adminEmails.includes(user.email.toLowerCase())) throw unauthorized('Session expired');
  rec.usedAt = new Date();
  await rec.save();
  const refresh = await issueRefresh(user, rec.family, userAgent);
  return { user, refresh };
}

export async function revokeRefresh(token) {
  if (!token) return;
  const rec = await RefreshToken.findOne({ tokenHash: sha256(token) });
  if (rec) await RefreshToken.deleteMany({ family: rec.family });
}

// Welcome mail is a nice-to-have: never block or fail a sign-in because of it
export function sendWelcome(user) {
  if (user.role === 'admin') return;
  const appUrl = user.role === 'owner' ? env.ORG_APP_URL : env.CUSTOMER_APP_URL;
  sendMail({ to: user.email, ...welcomeEmail({ name: user.name, role: user.role, appUrl: appUrl ? `${appUrl.replace(/\/$/, '')}${user.role === 'owner' ? '/dashboard' : '/explore'}` : '' }) }).catch((e) => console.error('Welcome email failed:', e.message));
}

export async function googleSignIn({ idToken, role }) {
  const g = await verifyFirebaseIdToken(idToken);
  assertAdminAllowed(g.email, role);
  let user = await User.findOne({ email: g.email });
  if (user && user.role !== role) {
    throw conflict(wrongAppMessage(user.role), 'wrong_app');
  }
  let created = false;
  if (!user) {
    user = await User.create({ email: g.email, name: (g.name || g.email.split('@')[0]).slice(0, 80), role });
    created = true;
  }
  if (created) sendWelcome(user);
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export async function loginWithPassword({ email, password, role }) {
  if (role !== 'admin') throw forbidden('Password login is only enabled for admin.', 'password_not_allowed');
  if (env.adminEmails.length > 0 && !env.adminEmails.includes(email.toLowerCase())) {
    throw unauthorized('Invalid email or password', 'bad_credentials');
  }
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || user.role !== 'admin' || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    throw unauthorized('Invalid email or password', 'bad_credentials');
  }
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}
