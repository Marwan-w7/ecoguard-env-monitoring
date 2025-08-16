import mongoose, { Schema, Document } from 'mongoose';

export interface IEvent extends Document {
  _id: string;
  source: string;
  type: 'earthquake' | 'flood' | 'aqi' | 'storm' | 'fire';
  severity: number;
  confidence: number;
  geometry: {
    type: 'Point' | 'Polygon';
    coordinates: number[];
  };
  area_bbox: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  starts_at: Date;
  ends_at?: Date;
  properties: Record<string, any>;
  ingested_at: Date;
}

const EventSchema = new Schema<IEvent>({
  _id: { type: String, required: true },
  source: { type: String, required: true },
  type: { type: String, enum: ['earthquake', 'flood', 'aqi', 'storm', 'fire'], required: true },
  severity: { type: Number, required: true },
  confidence: { type: Number, default: 0.9 },
  geometry: {
    type: { type: String, enum: ['Point', 'Polygon'], required: true },
    coordinates: { type: [Number], required: true }
  },
  area_bbox: { type: [Number], required: true },
  starts_at: { type: Date, required: true },
  ends_at: { type: Date },
  properties: { type: Schema.Types.Mixed, default: {} },
  ingested_at: { type: Date, default: Date.now }
});

EventSchema.index({ geometry: '2dsphere' });
EventSchema.index({ type: 1, starts_at: -1 });

export const Event = mongoose.model<IEvent>('Event', EventSchema);