import mongoose from 'mongoose';

const lockSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
});

export const Lock = mongoose.model('Lock', lockSchema);

