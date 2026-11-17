import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true, index: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    guestName: { type: String, maxlength: 80, default: '' },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    stars: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxlength: 500, default: '' },
    // Low-star feedback stays private to the shop unless the customer chooses to share
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Review = mongoose.model('Review', reviewSchema);
