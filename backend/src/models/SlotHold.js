import mongoose from 'mongoose';

const { Schema } = mongoose;

const slotHoldSchema = new Schema(
  {
    shop: { type: Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true },
    slotStart: { type: Number, required: true },
    durationMin: { type: Number, required: true },
    resourceId: { type: Schema.Types.ObjectId, default: null },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { timestamps: true }
);

slotHoldSchema.index({ shop: 1, date: 1, expiresAt: 1 });
slotHoldSchema.index({ customer: 1, shop: 1 });

export const SlotHold = mongoose.model('SlotHold', slotHoldSchema);
