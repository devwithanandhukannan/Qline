import mongoose from 'mongoose';

const intervalSchema = new mongoose.Schema(
  { start: { type: String, required: true }, end: { type: String, required: true } },
  { _id: false }
);

const weeklySchema = new mongoose.Schema(
  {
    day: { type: Number, min: 0, max: 6, required: true },
    open: { type: Boolean, default: true },
    intervals: { type: [intervalSchema], default: [] },
  },
  { _id: false }
);

const overrideSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    closed: { type: Boolean, default: false },
    intervals: { type: [intervalSchema], default: [] },
    note: { type: String, maxlength: 140, default: '' },
  },
  { _id: false }
);

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 60 },
  active: { type: Boolean, default: true },
  offDays: { type: [Number], default: [] },
  offDates: { type: [String], default: [] },
});

const tableSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 60 },
  capacity: { type: Number, required: true, min: 1, max: 50, default: 2 },
  active: { type: Boolean, default: true },
});

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true, maxlength: 60 },
  durationMin: { type: Number, required: true, min: 5, max: 480 },
  price: { type: Number, min: 0, default: 0 },
  active: { type: Boolean, default: true },
});

const defaultWeekly = () =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day,
    open: day !== 0,
    intervals: day !== 0 ? [{ start: '09:00', end: '20:00' }] : [],
  }));

const shopSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    category: { type: String, enum: ['barber', 'salon', 'cafe', 'clinic', 'other'], default: 'barber' },
    description: { type: String, maxlength: 400, default: '' },
    phone: { type: String, maxlength: 20, default: '' },
    address: { type: String, maxlength: 200, default: '' },
    area: { type: String, maxlength: 80, default: '' },
    city: { type: String, maxlength: 80, default: '', index: true },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    timezone: { type: String, default: 'Asia/Kolkata' },
    images: { type: [String], default: [] },
    services: { type: [serviceSchema], default: [] },
    staff: { type: [staffSchema], default: [] },
    tables: { type: [tableSchema], default: [] },
    weekly: { type: [weeklySchema], default: defaultWeekly },
    overrides: { type: [overrideSchema], default: [] },
    settings: {
      acceptQueue: { type: Boolean, default: true },
      acceptSlots: { type: Boolean, default: true },
      queuePaused: { type: Boolean, default: false },
      slotIntervalMin: { type: Number, default: 30, min: 10, max: 240 },
      maxQueue: { type: Number, default: 15, min: 1, max: 200 },
      graceMin: { type: Number, default: 5, min: 1, max: 60 },
      advanceDays: { type: Number, default: 7, min: 0, max: 60 },
      delayMin: { type: Number, default: 0, min: 0, max: 240 },
      delayNote: { type: String, maxlength: 140, default: '' },
      delayDate: { type: String, default: null },
      cancelCutoffMin: { type: Number, default: 60, min: 0, max: 1440 },
      enableTvScreen: { type: Boolean, default: false },
      allowStaffSelection: { type: Boolean, default: false },
      allowTableSelection: { type: Boolean, default: false },
    },
    ratingAvg: { type: Number, default: 0 },
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    isListed: { type: Boolean, default: true },
    // Admin-controlled platform switch (separate from owner's isListed)
    isActive: { type: Boolean, default: true, index: true },
    disabledReason: { type: String, maxlength: 200, default: '' },
    disabledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

shopSchema.index({ createdAt: -1 });

export const Shop = mongoose.model('Shop', shopSchema);
