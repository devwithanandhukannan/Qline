import mongoose from 'mongoose';

const tvAdSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    videoUrl: { type: String, required: true, trim: true, maxlength: 600 },
    durationSec: { type: Number, required: true, min: 3, max: 180, default: 15 },
    active: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

tvAdSchema.index({ active: 1, sortOrder: 1, createdAt: -1 });

export const TvAd = mongoose.model('TvAd', tvAdSchema);

