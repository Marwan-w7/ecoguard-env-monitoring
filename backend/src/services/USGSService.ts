import fetch from 'node-fetch';
import { Event } from '../models/Event';

export class USGSService {
  private static readonly USGS_EARTHQUAKE_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
  private static readonly USGS_SIGNIFICANT_URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson';

  static async ingestEarthquakes(): Promise<{ inserted: number; updated: number }> {
    try {
      const response = await fetch(this.USGS_EARTHQUAKE_URL);
      const data = await response.json() as any;
      
      let inserted = 0;
      let updated = 0;

      for (const feature of data.features) {
        const eventId = `usgs-${feature.id}`;
        const magnitude = feature.properties.mag;
        
        // Only process significant earthquakes (magnitude >= 2.5)
        if (magnitude < 2.5) continue;

        const eventData = {
          _id: eventId,
          source: 'usgs',
          type: 'earthquake' as const,
          severity: magnitude,
          confidence: 0.95,
          geometry: {
            type: 'Point' as const,
            coordinates: feature.geometry.coordinates.slice(0, 2) // [lng, lat]
          },
          area_bbox: this.calculateBoundingBox(
            feature.geometry.coordinates[0], 
            feature.geometry.coordinates[1], 
            magnitude
          ),
          starts_at: new Date(feature.properties.time),
          properties: {
            place: feature.properties.place,
            depth_km: feature.geometry.coordinates[2],
            mag_type: feature.properties.magType,
            alert: feature.properties.alert,
            tsunami: feature.properties.tsunami,
            url: feature.properties.url,
            felt_reports: feature.properties.felt,
            significance: feature.properties.sig
          },
          ingested_at: new Date()
        };

        const result = await Event.findOneAndUpdate(
          { _id: eventId },
          eventData,
          { upsert: true, new: true }
        );

        if (result.ingested_at.getTime() === eventData.ingested_at.getTime()) {
          inserted++;
        } else {
          updated++;
        }
      }

      console.log(`USGS: Processed ${inserted} new earthquakes, updated ${updated}`);
      return { inserted, updated };

    } catch (error) {
      console.error('USGS ingestion failed:', error);
      throw error;
    }
  }

  private static calculateBoundingBox(lng: number, lat: number, magnitude: number): [number, number, number, number] {
    // Calculate affected area based on earthquake magnitude
    // Rough approximation: each magnitude unit = ~50km radius impact
    const radiusKm = Math.max(10, magnitude * 50);
    const radiusDegrees = radiusKm / 111; // Approximate km to degrees conversion

    return [
      lng - radiusDegrees, // minLng
      lat - radiusDegrees, // minLat
      lng + radiusDegrees, // maxLng
      lat + radiusDegrees  // maxLat
    ];
  }

  static async getRecentEarthquakes(hours: number = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return Event.find({
      source: 'usgs',
      type: 'earthquake',
      starts_at: { $gte: since }
    }).sort({ starts_at: -1 });
  }
}