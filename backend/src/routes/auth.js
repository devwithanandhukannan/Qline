import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import { validate, requireAuth, cookieNames, cookieOpts } from '../middleware/core.js';
import { requestOtpDto, verifyOtpDto, updateMeDto, googleDto, passwordLoginDto } from '../validators/auth.js';
import { requestOtp, verifyOtp, googleSignIn, loginWithPassword, signAccess, issueRefresh, rotateRefresh, revokeRefresh } from '../services/auth.js';
import { User } from '../models/User.js';
import { unauthorized } from '../utils/errors.js';

const r = Router();
const roleOf = (req) => req.qapp; // 'customer' | 'owner'

const limiter = (windowMin, max, message) =>
  rateLimit({
    windowMs: windowMin * 60_000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test', // the e2e suite makes many logins from one IP
    message: { error: 'rate_limited', message },
  });

const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email, phone: u.phone || '', role: u.role });

function setSession(res, app, user, refresh) {
  const n = cookieNames(app);
  res.cookie(n.access, signAccess(user), cookieOpts(env.ACCESS_TOKEN_TTL_MIN * 60_000));
  res.cookie(n.refresh, refresh, cookieOpts(env.REFRESH_TOKEN_TTL_DAYS * 86_400_000, '/api/auth'));
}

r.post('/otp/request', limiter(10, 8, 'Too many attempts. Please try again in a few minutes.'), validate({ body: requestOtpDto }), async (req, res) => {
  const out = await requestOtp({ email: req.valid.body.email, role: roleOf(req) });
  res.json(out);
});

r.post('/otp/verify', limiter(10, 20, 'Too many attempts. Please try again in a few minutes.'), validate({ body: verifyOtpDto }), async (req, res) => {
  const { email, code, name } = req.valid.body;
  const user = await verifyOtp({ email, code, role: roleOf(req), name });
  const refresh = await issueRefresh(user, undefined, req.get('user-agent'));
  setSession(res, req.qapp, user, refresh);
  res.json({ user: publicUser(user) });
});

r.post('/google', limiter(10, 30, 'Too many attempts. Please try again in a few minutes.'), validate({ body: googleDto }), async (req, res) => {
  const user = await googleSignIn({ idToken: req.valid.body.idToken, role: roleOf(req) });
  const refresh = await issueRefresh(user, undefined, req.get('user-agent'));
  setSession(res, req.qapp, user, refresh);
  res.json({ user: publicUser(user) });
});

r.post('/login', limiter(10, 15, 'Too many login attempts. Please try again in a few minutes.'), validate({ body: passwordLoginDto }), async (req, res) => {
  const user = await loginWithPassword({ ...req.valid.body, role: roleOf(req) });
  const refresh = await issueRefresh(user, undefined, req.get('user-agent'));
  setSession(res, req.qapp, user, refresh);
  res.json({ user: publicUser(user) });
});

r.get('/config', (_req, res) => res.json({ google: !!env.FIREBASE_PROJECT_ID }));

r.post('/refresh', limiter(10, 60, 'Too many requests'), async (req, res) => {
  const n = cookieNames(req.qapp);
  const token = req.cookies?.[n.refresh];
  if (!token) throw unauthorized('Session expired', 'no_session');
  const { user, refresh } = await rotateRefresh(token, roleOf(req), req.get('user-agent'));
  setSession(res, req.qapp, user, refresh);
  res.json({ user: publicUser(user) });
});

r.post('/logout', async (req, res) => {
  const n = cookieNames(req.qapp);
  await revokeRefresh(req.cookies?.[n.refresh]);
  res.clearCookie(n.access, cookieOpts(0));
  res.clearCookie(n.refresh, cookieOpts(0, '/api/auth'));
  res.json({ ok: true });
});

const auth = (req, res, next) => requireAuth(roleOf(req))(req, res, next);

r.get('/me', auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

r.patch('/me', auth, validate({ body: updateMeDto }), async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, { $set: req.valid.body }, { returnDocument: 'after' }).lean();
  res.json({ user: publicUser(user) });
});

export default r;
