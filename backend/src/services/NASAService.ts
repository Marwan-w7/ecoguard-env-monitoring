import fetch from 'node-fetch';
import { Event } from '../models/Event';

export class NASAService {
  private static readonly EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events';
  private static readonly FIRMS_URL = 'https://firms.modaps.eosdis.nasa.gov/api/country/csv';
  private static readonly API_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';

  static async ingestEONETEvents(): Promise<{ inserted: number; updated: number }> {
    try {
      const response = await fetch(`${this.EONET_URL}?status=open&limit=100`);
      const data = await response.json() as any;
      
      let inserted = 0;
      let updated = 0;

      for (const event of data.events) {
        // Skip events without recent geometry
        if (!event.geometry || event.geometry.length === 0) continue;

        const latestGeometry = event.geometry[event.geometry.length - 1];
        const eventId = `nasa-eonet-${event.id}`;
        
        const eventType = this.mapEONETCategory(event.categories[0].id);
        const severity = this.calculateEONETSeverity(event.categories[0].id, event.title);

        const eventData = {
          _id: eventId,
          source: 'nasa-eonet',
          type: eventType,
          severity: severity,
          confidence: 0.90,
          geometry: {
            type: latestGeometry.type as 'Point' | 'Polygon',
            coordinates: latestGeometry.coordinates
          },
          area_bbox: this.calculateBoundingBoxFromGeometry(latestGeometry),
          starts_at: new Date(latestGeometry.date),
          properties: {
            title: event.title,
            description: event.description || '',
            category: event.categories[0].title,
            category_id: event.categories[0].id,
            link: event.link,
            closed: event.closed || null,
            magnitudeValue: event.magnitudeValue || null,
            magnitudeUnit: event.magnitudeUnit || null
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

      console.log(`NASA EONET: Processed ${inserted} new events, updated ${updated}`);
      return { inserted, updated };

    } catch (error) {
      console.error('NASA EONET ingestion failed:', error);
      throw error;
    }
  }

  static async ingestFIRMSData(countryCodes: string[] = ['MYS', 'SGP', 'IDN', 'THA']): Promise<{ inserted: number; updated: number }> {
    let totalInserted = 0;
    let totalUpdated = 0;

    for (const countryCode of countryCodes) {
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];

        const url = `${this.FIRMS_URL}/${this.API_KEY}/VIIRS_SNPP_NRT/${countryCode}/1/${dateStr}`;
        const response = await fetch(url);
        const csvText = await response.text();

        if (csvText.includes('No data')) continue;

        const lines = csvText.split('\n');
        const headers = lines[0].split(',');
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = lines[i].split(',');
          const fireData: any = {};
          
          headers.forEach((header, index) => {
            fireData[header.trim()] = values[index]?.trim();
          });

          if (!fireData.latitude || !fireData.longitude) continue;

          const lat = parseFloat(fireData.latitude);
          const lng = parseFloat(fireData.longitude);
          const confidence = parseFloat(fireData.confidence || '50');
          const brightness = parseFloat(fireData.brightness || '300');

          // Only process high-confidence fires
          if (confidence < 30) continue;

          const eventId = `nasa-firms-${countryCode}-${fireData.acq_date}-${lat.toFixed(4)}-${lng.toFixed(4)}`;
          
          const severity = this.calculateFireSeverity(brightness, confidence);

          const eventData = {
            _id: eventId,
            source: 'nasa-firms',
            type: 'fire' as const,
            severity: severity,
            confidence: confidence / 100,
            geometry: {
              type: 'Point' as const,
              coordinates: [lng, lat]
            },
            area_bbox: this.calculateFireBoundingBox(lng, lat, brightness),
            starts_at: new Date(`${fireData.acq_date}T${fireData.acq_time || '12:00:00'}Z`),
            properties: {
              brightness: brightness,
              scan: parseFloat(fireData.scan || '1'),
              track: parseFloat(fireData.track || '1'),
              satellite: fireData.satellite || 'VIIRS',
              instrument: fireData.instrument || 'VIIRS',
              version: fireData.version || '2.0NRT',
              bright_t31: parseFloat(fireData.bright_t31 || '0'),
              frp: parseFloat(fireData.frp || '0'), // Fire Radiative Power
              daynight: fireData.daynight || 'D',
              country_code: countryCode
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
        console.error(`NASA FIRMS ingestion failed for ${countryCode}:`, error);
      }
    }

    console.log(`NASA FIRMS: Processed ${totalInserted} new fires, updated ${totalUpdated}`);
    return { inserted: totalInserted, updated: totalUpdated };
  }

  private static mapEONETCategory(categoryId: number): 'earthquake' | 'flood' | 'storm' | 'fire' | 'aqi' {
    switch (categoryId) {
      case 6: return 'earthquake'; // Earthquakes
      case 8: return 'fire'; // Wildfires
      case 9: return 'flood'; // Floods
      case 10: return 'storm'; // Severe Storms
      case 12: return 'storm'; // Volcanoes -> storm (ash/debris)
      case 13: return 'aqi'; // Dust and Haze
      case 14: return 'aqi'; // Smoke
      case 15: return 'storm'; // Water Color
      case 16: return 'storm'; // Manmade
      case 17: return 'storm'; // Sea and Lake Ice
      case 18: return 'storm'; // Snow
      case 19: return 'storm'; // Temperature Extremes
      default: return 'storm';
    }
  }

  private static calculateEONETSeverity(categoryId: number, title: string): number {
    let baseSeverity = 5.0;
    
    // Category-based severity
    switch (categoryId) {
      case 6: baseSeverity = 7.0; break; // Earthquakes
      case 8: baseSeverity = 6.5; break; // Wildfires
      case 9: baseSeverity = 7.5; break; // Floods
      case 10: baseSeverity = 6.0; break; // Severe Storms
      case 12: baseSeverity = 8.0; break; // Volcanoes
    }

    // Title-based modifiers
    const titleLower = title.toLowerCase();
    if (titleLower.includes('major') || titleLower.includes('severe')) baseSeverity += 1.0;
    if (titleLower.includes('extreme') || titleLower.includes('catastrophic')) baseSeverity += 2.0;
    if (titleLower.includes('minor') || titleLower.includes('small')) baseSeverity -= 1.0;

    return Math.max(1.0, Math.min(10.0, baseSeverity));
  }

  private static calculateFireSeverity(brightness: number, confidence: number): number {
    let severity = 3.0;
    
    // Brightness-based severity (typical range: 300-400K)
    if (brightness > 380) severity += 3.0;
    else if (brightness > 350) severity += 2.0;
    else if (brightness > 320) severity += 1.0;
    
    // Confidence-based modifier
    if (confidence > 80) severity += 1.0;
    else if (confidence < 50) severity -= 1.0;
    
    return Math.max(1.0, Math.min(10.0, severity));
  }

  private static calculateBoundingBoxFromGeometry(geometry: any): [number, number, number, number] {
    if (geometry.type === 'Point') {
      const [lng, lat] = geometry.coordinates;
      const radius = 0.1; // ~11km
      return [lng - radius, lat - radius, lng + radius, lat + radius];
    }
    
    if (geometry.type === 'Polygon') {
      const coords = geometry.coordinates[0];
      const lngs = coords.map((c: number[]) => c[0]);
      const lats = coords.map((c: number[]) => c[1]);
      return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
    }
    
    return [0, 0, 0, 0];
  }

  private static calculateFireBoundingBox(lng: number, lat: number, brightness: number): [number, number, number, number] {
    // Larger fires have bigger impact radius
    const radiusKm = Math.max(2, (brightness - 300) / 20);
    const radiusDegrees = radiusKm / 111;

    return [
      lng - radiusDegrees,
      lat - radiusDegrees,
      lng + radiusDegrees,
      lat + radiusDegrees
    ];
  }
}