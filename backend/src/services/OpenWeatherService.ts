import fetch from 'node-fetch';
import { Event } from '../models/Event';

export class OpenWeatherService {
  private static readonly BASE_URL = 'https://api.openweathermap.org/data/2.5';
  private static readonly ONECALL_URL = 'https://api.openweathermap.org/data/3.0/onecall';
  private static readonly API_KEY = process.env.OPENWEATHER_API_KEY;

  static async ingestWeatherAlerts(locations: Array<{lat: number, lng: number, name: string}>): Promise<{ inserted: number; updated: number }> {
    if (!this.API_KEY) {
      throw new Error('OpenWeather API key not configured');
    }

    let inserted = 0;
    let updated = 0;

    for (const location of locations) {
      try {
        const url = `${this.ONECALL_URL}?lat=${location.lat}&lon=${location.lng}&appid=${this.API_KEY}&exclude=minutely,daily`;
        const response = await fetch(url);
        const data = await response.json() as any;

        // Process weather alerts
        if (data.alerts && data.alerts.length > 0) {
          for (const alert of data.alerts) {
            const eventId = `openweather-${location.name}-${alert.start}-${alert.event.replace(/\s+/g, '-')}`;
            
            const severity = this.calculateSeverity(alert.event, alert.description);
            
            const eventData = {
              _id: eventId,
              source: 'openweather',
              type: this.mapAlertType(alert.event),
              severity: severity,
              confidence: 0.85,
              geometry: {
                type: 'Point' as const,
                coordinates: [location.lng, location.lat]
              },
              area_bbox: this.calculateAlertBoundingBox(location.lng, location.lat, severity),
              starts_at: new Date(alert.start * 1000),
              ends_at: new Date(alert.end * 1000),
              properties: {
                event_name: alert.event,
                description: alert.description,
                sender_name: alert.sender_name,
                tags: alert.tags || [],
                location_name: location.name
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
        }

        // Process severe weather conditions from current weather
        const currentWeather = data.current;
        if (this.isSevereWeather(currentWeather)) {
          const eventId = `openweather-severe-${location.name}-${Date.now()}`;
          const severity = this.calculateWeatherSeverity(currentWeather);
          
          const eventData = {
            _id: eventId,
            source: 'openweather',
            type: 'storm' as const,
            severity: severity,
            confidence: 0.80,
            geometry: {
              type: 'Point' as const,
              coordinates: [location.lng, location.lat]
            },
            area_bbox: this.calculateAlertBoundingBox(location.lng, location.lat, severity),
            starts_at: new Date(),
            properties: {
              temperature: currentWeather.temp - 273.15, // Convert K to C
              feels_like: currentWeather.feels_like - 273.15,
              humidity: currentWeather.humidity,
              pressure: currentWeather.pressure,
              wind_speed: currentWeather.wind_speed,
              wind_deg: currentWeather.wind_deg,
              weather_main: currentWeather.weather[0].main,
              weather_description: currentWeather.weather[0].description,
              location_name: location.name
            },
            ingested_at: new Date()
          };

          await Event.findOneAndUpdate(
            { _id: eventId },
            eventData,
            { upsert: true, new: true }
          );
          inserted++;
        }

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`OpenWeather ingestion failed for ${location.name}:`, error);
      }
    }

    console.log(`OpenWeather: Processed ${inserted} new alerts, updated ${updated}`);
    return { inserted, updated };
  }

  private static mapAlertType(eventName: string): 'flood' | 'storm' | 'fire' | 'aqi' {
    const event = eventName.toLowerCase();
    if (event.includes('flood') || event.includes('rain')) return 'flood';
    if (event.includes('fire') || event.includes('smoke')) return 'fire';
    if (event.includes('air') || event.includes('pollution')) return 'aqi';
    return 'storm';
  }

  private static calculateSeverity(event: string, description: string): number {
    const text = (event + ' ' + description).toLowerCase();
    
    if (text.includes('extreme') || text.includes('severe') || text.includes('major')) return 8.0;
    if (text.includes('moderate') || text.includes('warning')) return 6.0;
    if (text.includes('minor') || text.includes('watch')) return 4.0;
    return 5.0;
  }

  private static isSevereWeather(weather: any): boolean {
    const windSpeed = weather.wind_speed || 0;
    const temp = weather.temp - 273.15; // Convert to Celsius
    const humidity = weather.humidity || 0;
    
    // Severe conditions thresholds
    return windSpeed > 15 || // > 54 km/h
           temp > 40 || temp < -10 || // Extreme temperatures
           humidity > 90; // Very high humidity
  }

  private static calculateWeatherSeverity(weather: any): number {
    const windSpeed = weather.wind_speed || 0;
    const temp = weather.temp - 273.15;
    
    let severity = 3.0;
    
    if (windSpeed > 25) severity += 2.0; // Hurricane force
    else if (windSpeed > 15) severity += 1.0; // Strong wind
    
    if (temp > 45 || temp < -20) severity += 2.0; // Extreme temp
    else if (temp > 40 || temp < -10) severity += 1.0; // Very hot/cold
    
    return Math.min(severity, 10.0);
  }

  private static calculateAlertBoundingBox(lng: number, lat: number, severity: number): [number, number, number, number] {
    const radiusKm = Math.max(5, severity * 10);
    const radiusDegrees = radiusKm / 111;

    return [
      lng - radiusDegrees,
      lat - radiusDegrees,
      lng + radiusDegrees,
      lat + radiusDegrees
    ];
  }

  // Major cities for weather monitoring
  static getMonitoringLocations() {
    return [
      { lat: 3.1390, lng: 101.6869, name: 'kuala-lumpur' },
      { lat: 1.3521, lng: 103.8198, name: 'singapore' },
      { lat: 5.4164, lng: 100.3327, name: 'penang' },
      { lat: 1.4927, lng: 103.7414, name: 'johor-bahru' },
      { lat: 3.8077, lng: 103.3260, name: 'kuantan' },
      { lat: 5.9804, lng: 116.0735, name: 'kota-kinabalu' },
      { lat: 1.5553, lng: 110.3592, name: 'kuching' },
      { lat: 4.2105, lng: 101.9758, name: 'ipoh' },
      { lat: 2.1896, lng: 102.2501, name: 'melaka' },
      { lat: 6.1254, lng: 102.2386, name: 'kota-bharu' }
    ];
  }
}