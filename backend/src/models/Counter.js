import mongoose from 'mongoose';

// Atomic per-shop-per-day token counter
const counterSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 120 },
});

export const Counter = mongoose.model('Counter', counterSchema);
