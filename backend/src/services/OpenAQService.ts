import fetch from 'node-fetch';
import { Event } from '../models/Event';

export class OpenAQService {
  private static readonly BASE_URL = 'https://api.openaq.org/v2';
  private static readonly API_KEY = process.env.OPENAQ_API_KEY; // Optional, higher rate limits with key

  static async ingestAirQualityData(countries: string[] = ['MY', 'SG', 'ID', 'TH']): Promise<{ inserted: number; updated: number }> {
    let totalInserted = 0;
    let totalUpdated = 0;

    for (const country of countries) {
      try {
        // Get latest measurements for the country
        const headers: any = { 'Content-Type': 'application/json' };
        if (this.API_KEY) headers['X-API-Key'] = this.API_KEY;

        const url = `${this.BASE_URL}/latest?limit=1000&country=${country}&parameter=pm25,pm10,o3,no2,so2,co`;
        const response = await fetch(url, { headers });
        const data = await response.json() as any;

        if (!data.results) continue;

        // Group measurements by location
        const locationGroups = new Map<string, any[]>();
        
        for (const measurement of data.results) {
          if (!measurement.coordinates || !measurement.value) continue;
          
          const locationKey = `${measurement.coordinates.latitude.toFixed(4)}-${measurement.coordinates.longitude.toFixed(4)}`;
          
          if (!locationGroups.has(locationKey)) {
            locationGroups.set(locationKey, []);
          }
          locationGroups.get(locationKey)!.push(measurement);
        }

        // Process each location
        for (const [locationKey, measurements] of locationGroups) {
          const primaryMeasurement = measurements[0];
          const lat = primaryMeasurement.coordinates.latitude;
          const lng = primaryMeasurement.coordinates.longitude;

          // Calculate AQI and overall air quality
          const aqiData = this.calculateAQI(measurements);
          
          // Only create events for unhealthy air quality (AQI > 100)
          if (aqiData.aqi <= 100) continue;

          const eventId = `openaq-${country}-${locationKey}-${new Date().toISOString().split('T')[0]}`;
          
          const eventData = {
            _id: eventId,
            source: 'openaq',
            type: 'aqi' as const,
            severity: this.aqiToSeverity(aqiData.aqi),
            confidence: 0.85,
            geometry: {
              type: 'Point' as const,
              coordinates: [lng, lat]
            },
            area_bbox: this.calculateAQIBoundingBox(lng, lat, aqiData.aqi),
            starts_at: new Date(primaryMeasurement.date.utc),
            properties: {
              aqi: aqiData.aqi,
              aqi_category: aqiData.category,
              primary_pollutant: aqiData.primaryPollutant,
              location_name: primaryMeasurement.location,
              city: primaryMeasurement.city,
              country: primaryMeasurement.country,
              measurements: this.processMeasurements(measurements),
              source_name: primaryMeasurement.sourceName,
              mobile: primaryMeasurement.mobile || false
            },
            ingested_at: new Date()
          };

          const result = await Event.findOneAndUpdate(
            { _id: eventId },
            eventData,
            { upsert: true, new: true }
          );

          if (result.ingested_at.getTime() === eventData.ingested_at.getTime()) {
            totalInserted++;
          } else {
            totalUpdated++;
          }
        }

        // Rate limiting between countries
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`OpenAQ ingestion failed for ${country}:`, error);
      }
    }

    console.log(`OpenAQ: Processed ${totalInserted} new AQI events, updated ${totalUpdated}`);
    return { inserted: totalInserted, updated: totalUpdated };
  }

  private static calculateAQI(measurements: any[]): { aqi: number; category: string; primaryPollutant: string } {
    let maxAQI = 0;
    let primaryPollutant = 'pm25';

    const pollutantAQIs: { [key: string]: number } = {};

    for (const measurement of measurements) {
      const parameter = measurement.parameter.toLowerCase();
      const value = measurement.value;
      const unit = measurement.unit;

      let aqi = 0;

      switch (parameter) {
        case 'pm25':
          aqi = this.pm25ToAQI(value, unit);
          break;
        case 'pm10':
          aqi = this.pm10ToAQI(value, unit);
          break;
        case 'o3':
          aqi = this.o3ToAQI(value, unit);
          break;
        case 'no2':
          aqi = this.no2ToAQI(value, unit);
          break;
        case 'so2':
          aqi = this.so2ToAQI(value, unit);
          break;
        case 'co':
          aqi = this.coToAQI(value, unit);
          break;
      }

      pollutantAQIs[parameter] = aqi;

      if (aqi > maxAQI) {
        maxAQI = aqi;
        primaryPollutant = parameter;
      }
    }

    return {
      aqi: Math.round(maxAQI),
      category: this.aqiToCategory(maxAQI),
      primaryPollutant
    };
  }

  private static pm25ToAQI(concentration: number, unit: string): number {
    // Convert to µg/m³ if needed
    let c = concentration;
    if (unit === 'ppm') c = c * 1000; // Rough conversion

    // US EPA PM2.5 AQI breakpoints
    if (c <= 12.0) return this.linearInterpolation(c, 0, 12.0, 0, 50);
    if (c <= 35.4) return this.linearInterpolation(c, 12.1, 35.4, 51, 100);
    if (c <= 55.4) return this.linearInterpolation(c, 35.5, 55.4, 101, 150);
    if (c <= 150.4) return this.linearInterpolation(c, 55.5, 150.4, 151, 200);
    if (c <= 250.4) return this.linearInterpolation(c, 150.5, 250.4, 201, 300);
    if (c <= 350.4) return this.linearInterpolation(c, 250.5, 350.4, 301, 400);
    return Math.min(500, this.linearInterpolation(c, 350.5, 500.4, 401, 500));
  }

  private static pm10ToAQI(concentration: number, unit: string): number {
    let c = concentration;
    if (unit === 'ppm') c = c * 1000;

    if (c <= 54) return this.linearInterpolation(c, 0, 54, 0, 50);
    if (c <= 154) return this.linearInterpolation(c, 55, 154, 51, 100);
    if (c <= 254) return this.linearInterpolation(c, 155, 254, 101, 150);
    if (c <= 354) return this.linearInterpolation(c, 255, 354, 151, 200);
    if (c <= 424) return this.linearInterpolation(c, 355, 424, 201, 300);
    if (c <= 504) return this.linearInterpolation(c, 425, 504, 301, 400);
    return Math.min(500, this.linearInterpolation(c, 505, 604, 401, 500));
  }

  private static o3ToAQI(concentration: number, unit: string): number {
    // Convert to ppm if needed
    let c = concentration;
    if (unit === 'µg/m³') c = c / 1960; // Rough conversion at 25°C

    // 8-hour average O3 (ppm)
    if (c <= 0.054) return this.linearInterpolation(c, 0, 0.054, 0, 50);
    if (c <= 0.070) return this.linearInterpolation(c, 0.055, 0.070, 51, 100);
    if (c <= 0.085) return this.linearInterpolation(c, 0.071, 0.085, 101, 150);
    if (c <= 0.105) return this.linearInterpolation(c, 0.086, 0.105, 151, 200);
    if (c <= 0.200) return this.linearInterpolation(c, 0.106, 0.200, 201, 300);
    return Math.min(500, 301);
  }

  private static no2ToAQI(concentration: number, unit: string): number {
    let c = concentration;
    if (unit === 'ppm') c = c * 1880; // Convert ppm to µg/m³

    // Simplified NO2 AQI (µg/m³)
    if (c <= 40) return this.linearInterpolation(c, 0, 40, 0, 50);
    if (c <= 80) return this.linearInterpolation(c, 41, 80, 51, 100);
    if (c <= 180) return this.linearInterpolation(c, 81, 180, 101, 150);
    if (c <= 280) return this.linearInterpolation(c, 181, 280, 151, 200);
    if (c <= 400) return this.linearInterpolation(c, 281, 400, 201, 300);
    return Math.min(500, 301);
  }

  private static so2ToAQI(concentration: number, unit: string): number {
    let c = concentration;
    if (unit === 'ppm') c = c * 2620; // Convert ppm to µg/m³

    if (c <= 35) return this.linearInterpolation(c, 0, 35, 0, 50);
    if (c <= 75) return this.linearInterpolation(c, 36, 75, 51, 100);
    if (c <= 185) return this.linearInterpolation(c, 76, 185, 101, 150);
    if (c <= 304) return this.linearInterpolation(c, 186, 304, 151, 200);
    if (c <= 604) return this.linearInterpolation(c, 305, 604, 201, 300);
    return Math.min(500, 301);
  }

  private static coToAQI(concentration: number, unit: string): number {
    let c = concentration;
    if (unit === 'µg/m³') c = c / 1150; // Convert µg/m³ to ppm

    if (c <= 4.4) return this.linearInterpolation(c, 0, 4.4, 0, 50);
    if (c <= 9.4) return this.linearInterpolation(c, 4.5, 9.4, 51, 100);
    if (c <= 12.4) return this.linearInterpolation(c, 9.5, 12.4, 101, 150);
    if (c <= 15.4) return this.linearInterpolation(c, 12.5, 15.4, 151, 200);
    if (c <= 30.4) return this.linearInterpolation(c, 15.5, 30.4, 201, 300);
    return Math.min(500, 301);
  }

  private static linearInterpolation(x: number, x1: number, x2: number, y1: number, y2: number): number {
    return ((y2 - y1) / (x2 - x1)) * (x - x1) + y1;
  }

  private static aqiToCategory(aqi: number): string {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Moderate';
    if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
    if (aqi <= 200) return 'Unhealthy';
    if (aqi <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }

  private static aqiToSeverity(aqi: number): number {
    if (aqi <= 50) return 2.0;
    if (aqi <= 100) return 4.0;
    if (aqi <= 150) return 6.0;
    if (aqi <= 200) return 7.5;
    if (aqi <= 300) return 9.0;
    return 10.0;
  }

  private static processMeasurements(measurements: any[]): { [key: string]: any } {
    const processed: { [key: string]: any } = {};
    
    for (const measurement of measurements) {
      processed[measurement.parameter] = {
        value: measurement.value,
        unit: measurement.unit,
        lastUpdated: measurement.date.utc
      };
    }
    
    return processed;
  }

  private static calculateAQIBoundingBox(lng: number, lat: number, aqi: number): [number, number, number, number] {
    // Higher AQI = larger affected area
    const radiusKm = Math.max(5, Math.min(50, aqi / 4));
    const radiusDegrees = radiusKm / 111;

    return [
      lng - radiusDegrees,
      lat - radiusDegrees,
      lng + radiusDegrees,
      lat + radiusDegrees
    ];
  }
}