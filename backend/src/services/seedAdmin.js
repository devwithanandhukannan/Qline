import { User } from '../models/User.js';
import { hashPassword } from '../utils/password.js';

export async function ensureSeedAdmin({ email, password, name = 'Qline Admin' }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '');
  const cleanName = String(name || 'Qline Admin').trim().slice(0, 80) || 'Qline Admin';

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('ADMIN_EMAIL must be a valid email address');
  }
  if (cleanPassword.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters long');
  }

  const existing = await User.findOne({ email: cleanEmail });
  if (existing && existing.role !== 'admin') {
    throw new Error(`Email ${cleanEmail} already belongs to a ${existing.role} account.`);
  }

  const passwordHash = hashPassword(cleanPassword);
  if (existing) {
    existing.name = cleanName;
    existing.passwordHash = passwordHash;
    await existing.save();
    return { user: existing, created: false };
  }

  const user = await User.create({
    email: cleanEmail,
    name: cleanName,
    role: 'admin',
    passwordHash,
  });
  return { user, created: true };
}

