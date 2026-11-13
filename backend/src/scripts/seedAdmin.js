import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ensureSeedAdmin } from '../services/seedAdmin.js';

function readArg(flag) {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : '';
}

const email = readArg('--email') || env.ADMIN_EMAIL || (env.isProd ? '' : 'admin@qline.app');
const password = readArg('--password') || env.ADMIN_PASSWORD || (env.isProd ? '' : 'admin12345');
const name = readArg('--name') || env.ADMIN_NAME || 'Qline Admin';

if (!email || !password) {
  console.error('Provide ADMIN_EMAIL and ADMIN_PASSWORD (in .env or via --email=... --password=...)');
  process.exit(1);
}

mongoose.set('strictQuery', true);
await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 15_000 });

try {
  const { user, created } = await ensureSeedAdmin({ email, password, name });
  console.log(`${created ? 'Seeded new' : 'Updated existing'} admin user: ${user.email} (${user.name})`);
} finally {
  await mongoose.disconnect();
}

