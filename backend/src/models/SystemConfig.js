import mongoose from 'mongoose';

const systemConfigSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const SystemConfig = mongoose.model('SystemConfig', systemConfigSchema);

