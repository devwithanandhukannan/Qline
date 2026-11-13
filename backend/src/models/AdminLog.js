import mongoose from 'mongoose';

const adminLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    adminEmail: { type: String, required: true, trim: true, lowercase: true },
    action: { type: String, enum: ['org_disable', 'org_enable'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    targetName: { type: String, required: true, maxlength: 100 },
    reason: { type: String, maxlength: 200, default: '' },
  },
  { timestamps: true }
);

adminLogSchema.index({ createdAt: -1 });
adminLogSchema.index({ targetId: 1, createdAt: -1 });

export const AdminLog = mongoose.model('AdminLog', adminLogSchema);

