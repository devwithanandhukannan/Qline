import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { AppError, unauthorized, forbidden, badRequest } from '../utils/errors.js';
import { verifyAccess } from '../services/auth.js';
import { User } from '../models/User.js';

// Every request body, query string and URL param passes through a strict zod schema (our DTOs).
// Unknown keys are rejected, so nothing unexpected (e.g. {"$ne": ...}) can reach the database.
export const validate = (schemas) => (req, _res, next) => {
  req.valid = {};
  for (const part of ['params', 'query', 'body']) {
    if (schemas[part]) req.valid[part] = schemas[part].parse(req[part] ?? {});
  }
  next();
};

const APP_ROLE = { customer: 'customer', owner: 'owner', admin: 'admin' };

// The two frontends send X-Qline-App. It selects the cookie set (so both apps can run on
// localhost) and, because it is a custom header, forces a CORS preflight, which is our CSRF guard.
export function appHeader(req, _res, next) {
  const app = req.get('x-qline-app');
  if (!APP_ROLE[app]) return next(badRequest('Missing app header', 'bad_app'));
  req.qapp = app;
  next();
}

export const cookieNames = (app) => ({ access: `qline_${app}_a`, refresh: `qline_${app}_r` });

export function cookieOpts(maxAgeMs, path = '/') {
  return {
    httpOnly: true,
    secure: env.isProd || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path,
    maxAge: maxAgeMs,
  };
}

export function requireAuth(role) {
  return async (req, _res, next) => {
    const token = req.cookies?.[cookieNames(req.qapp).access];
    const payload = token && verifyAccess(token);
    if (!payload) throw unauthorized('Please sign in', 'no_session');
    if (payload.role !== role || APP_ROLE[req.qapp] !== role) throw forbidden('Wrong app for this account');
    const user = await User.findById(payload.sub).lean();
    if (!user) throw unauthorized('Please sign in', 'no_session');
    if (role === 'admin' && env.adminEmails.length > 0 && !env.adminEmails.includes(user.email.toLowerCase())) {
      throw forbidden('Not authorized for admin access');
    }
    req.user = user;
    next();
  };
}

export function notFoundHandler(_req, _res, next) {
  next(new AppError(404, 'Not found', 'not_found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    const fields = {};
    for (const i of err.issues) fields[i.path.join('.') || '_'] ||= i.message;
    return res.status(400).json({ error: 'validation', message: Object.values(fields)[0] || 'Please check your input', fields });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.code, message: err.message });
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'too_large', message: 'Request is too large' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json', message: 'Invalid JSON' });
  if (err?.name === 'CastError') return res.status(400).json({ error: 'bad_request', message: 'Invalid value' });
  if (err?.code === 11000) return res.status(409).json({ error: 'conflict', message: 'That already exists' });
  console.error(`[${req.method} ${req.path}]`, err); // details stay in server logs only
  res.status(500).json({ error: 'server_error', message: 'Something went wrong. Please try again.' });
}
