import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    guestName: { type: String, maxlength: 80, default: '' },
    guestPhone: { type: String, maxlength: 20, default: '' },
    date: { type: String, required: true },
    type: { type: String, enum: ['queue', 'slot'], required: true },
    token: { type: Number, required: true },
    slotStart: { type: Number, min: 0, max: 1439 }, // minutes since midnight (slot bookings)
    services: [
      {
        _id: false,
        serviceId: mongoose.Schema.Types.ObjectId,
        name: String,
        durationMin: Number,
        price: Number,
      },
    ],
    durationMin: { type: Number, required: true },
    partySize: { type: Number, min: 1, max: 50, default: 1 },
    forName: { type: String, trim: true, maxlength: 80, default: '' },
    resourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    resourceName: { type: String, maxlength: 80, default: '' },
    resourceType: { type: String, enum: ['staff', 'table', 'other', null], default: null },
    queueOrder: { type: Number, default: null },
    steppedBackCount: { type: Number, min: 0, default: 0 },
    pushSubscriptions: {
      type: [
        {
          _id: false,
          endpoint: { type: String, required: true, maxlength: 1000 },
          keys: {
            p256dh: { type: String, required: true, maxlength: 300 },
            auth: { type: String, required: true, maxlength: 100 },
          },
        },
      ],
      default: [],
    },
    notifiedNext: { type: Boolean, default: false },
    notifiedTurn: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['waiting', 'serving', 'done', 'no_show', 'cancelled'],
      default: 'waiting',
    },
    startedAt: Date,
    completedAt: Date,
    reviewed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

bookingSchema.index({ shop: 1, date: 1, status: 1 });
bookingSchema.index({ shop: 1, date: 1, resourceId: 1, status: 1 });
bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ date: 1, status: 1 });
bookingSchema.index({ createdAt: -1 });
// A token number is unique per shop and day
bookingSchema.index({ shop: 1, date: 1, token: 1 }, { unique: true });

export const Booking = mongoose.model('Booking', bookingSchema);
