import mongoose from 'mongoose';

// Refresh tokens are random strings; only their SHA-256 is stored. Rotated on every use.
const refreshSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  family: { type: String, required: true, index: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date },
  userAgent: { type: String, maxlength: 200 },
});
refreshSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshSchema);
