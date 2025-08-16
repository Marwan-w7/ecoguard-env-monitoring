import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
  _id: string;
  email?: string;
  phone?: string;
  push?: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  radius_km: number;
  channels: ('webpush' | 'email' | 'sms')[];
  language: string;
  created_at: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
  _id: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  push: {
    endpoint: String,
    keys: {
      p256dh: String,
      auth: String
    }
  },
  location: {
    type: { type: String, enum: ['Point'], required: true },
    coordinates: { type: [Number], required: true }
  },
  radius_km: { type: Number, required: true, min: 1, max: 100 },
  channels: [{ type: String, enum: ['webpush', 'email', 'sms'] }],
  language: { type: String, default: 'en' },
  created_at: { type: Date, default: Date.now }
});

SubscriptionSchema.index({ location: '2dsphere' });

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);