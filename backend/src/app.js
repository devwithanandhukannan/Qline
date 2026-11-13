import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { appHeader, errorHandler, notFoundHandler } from './middleware/core.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import bookingRoutes from './routes/bookings.js';
import orgRoutes from './routes/org.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render sits behind one proxy; needed for correct client IPs in rate limits
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // no Origin header = same-origin proxy or server-to-server (health checks); browsers always send it cross-origin
        if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Qline-App'],
      maxAge: 600,
    })
  );
  app.use(compression());
  app.use(express.json({ limit: '2mb', strict: true }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => res.json({ ok: true, name: env.APP_NAME }));

  const api = express.Router();
  api.use(
    rateLimit({ windowMs: 60_000, limit: 240, skip: () => env.NODE_ENV === 'test', standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'rate_limited', message: 'Too many requests, slow down a little.' } })
  );
  api.get('/health', (_req, res) => res.json({ ok: true })); // used by the apps to wake a sleeping free server
  api.use(appHeader);
  api.use((req, _res, next) => {
    // Only JSON bodies are accepted on writes
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.headers['content-length'] !== '0' && req.body && !req.is('application/json') && Object.keys(req.body).length) {
      return next(Object.assign(new Error('Unsupported content type'), { type: 'entity.parse.failed' }));
    }
    next();
  });
  api.use('/auth', authRoutes);
  api.use('/', publicRoutes);
  api.use('/bookings', bookingRoutes);
  api.use('/org', orgRoutes);
  api.use('/admin', adminRoutes);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
