import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, maxlength: 20, default: '' },
    role: { type: String, enum: ['customer', 'owner', 'admin'], required: true },
    passwordHash: { type: String, default: null, select: false },
    noShowCount: { type: Number, default: 0 },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ role: 1, createdAt: -1 });

export const User = mongoose.model('User', userSchema);
