import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { ensureSeedAdmin } from './services/seedAdmin.js';

mongoose.set('strictQuery', true);

await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000, maxPoolSize: 10 });
console.log('MongoDB connected');

if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
  try {
    const { user, created } = await ensureSeedAdmin({
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
      name: env.ADMIN_NAME,
    });
    console.log(`${created ? 'Seeded' : 'Synced'} admin user: ${user.email}`);
  } catch (err) {
    console.error('Admin seed failed:', err.message);
  }
}

if (env.MAIL_PROVIDER === 'smtp' && process.env.RENDER) {
  console.warn('WARNING: MAIL_PROVIDER=smtp, but Render free web services block SMTP ports (25, 465, 587). Use MAIL_PROVIDER=brevo or gmail_api, or a paid instance.');
}

const server = createApp().listen(env.PORT, () => console.log(`${env.APP_NAME} API on :${env.PORT} (${env.NODE_ENV})`));

const stop = async () => {
  server.close();
  await mongoose.disconnect();
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));
