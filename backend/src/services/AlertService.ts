import webpush from 'web-push';
import { Event } from '../models/Event';
import { Subscription } from '../models/Subscription';
import { io } from '../server';

// Configure VAPID keys for web push (skip if invalid for testing)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && 
    process.env.VAPID_PUBLIC_KEY.length > 20) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:alerts@ecoguard.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    console.log('✅ Web Push configured');
  } catch (error) {
    console.log('⚠️ Web Push disabled (invalid VAPID keys)');
  }
} else {
  console.log('⚠️ Web Push disabled (no VAPID keys)');
}

export class AlertService {
  private static readonly SEVERITY_THRESHOLDS = {
    earthquake: 4.0,
    flood: 5.0,
    storm: 6.0,
    fire: 5.5,
    aqi: 6.0 // AQI > 150 (Unhealthy)
  };

  static async processNewEvents(eventType?: string): Promise<void> {
    try {
      // Get recent events (last 10 minutes)
      const since = new Date(Date.now() - 10 * 60 * 1000);
      
      const query: any = {
        ingested_at: { $gte: since },
        severity: { $gte: 4.0 } // Only process significant events
      };
      
      if (eventType) {
        query.type = eventType;
      }

      const recentEvents = await Event.find(query);
      
      if (recentEvents.length === 0) return;

      console.log(`Processing ${recentEvents.length} recent events for alerts`);

      for (const event of recentEvents) {
        await this.processEventAlerts(event);
      }

    } catch (error) {
      console.error('Error processing new events for alerts:', error);
    }
  }

  private static async processEventAlerts(event: any): Promise<void> {
    try {
      // Find subscriptions within the event's impact area
      const affectedSubscriptions = await this.findAffectedSubscriptions(event);
      
      if (affectedSubscriptions.length === 0) return;

      console.log(`Event ${event._id} affects ${affectedSubscriptions.length} subscriptions`);

      // Generate alert content
      const alertContent = this.generateAlertContent(event);

      // Send alerts through all channels
      const alertPromises = affectedSubscriptions.map(subscription => 
        this.sendAlert(subscription, event, alertContent)
      );

      await Promise.allSettled(alertPromises);

      // Broadcast to WebSocket clients
      io.emit('events:global', {
        type: 'new_event',
        event: {
          id: event._id,
          type: event.type,
          severity: event.severity,
          location: event.geometry.coordinates,
          message: alertContent.title
        }
      });

    } catch (error) {
      console.error(`Error processing alerts for event ${event._id}:`, error);
    }
  }

  private static async findAffectedSubscriptions(event: any): Promise<any[]> {
    // Use MongoDB geospatial query to find subscriptions within impact area
    const [minLng, minLat, maxLng, maxLat] = event.area_bbox;
    
    return Subscription.find({
      location: {
        $geoWithin: {
          $box: [[minLng, minLat], [maxLng, maxLat]]
        }
      },
      channels: { $exists: true, $ne: [] }
    });
  }

  private static generateAlertContent(event: any): { title: string; body: string; action: string } {
    const severity = event.severity;
    const type = event.type;
    const location = this.getLocationDescription(event);

    let title = '';
    let body = '';
    let action = '';

    switch (type) {
      case 'earthquake':
        const magnitude = severity.toFixed(1);
        title = `M${magnitude} Earthquake ${location}`;
        body = `A magnitude ${magnitude} earthquake occurred ${location}. ${this.getEarthquakeGuidance(severity)}`;
        action = severity >= 6.0 ? 'Take immediate shelter' : 'Stay alert for aftershocks';
        break;

      case 'flood':
        title = `Flood Alert ${location}`;
        body = `Flooding conditions detected ${location}. ${this.getFloodGuidance(severity)}`;
        action = 'Avoid low-lying areas and flooded roads';
        break;

      case 'storm':
        title = `Severe Weather ${location}`;
        body = `Severe weather conditions ${location}. ${this.getStormGuidance(event.properties)}`;
        action = 'Stay indoors and avoid travel';
        break;

      case 'fire':
        title = `Wildfire Alert ${location}`;
        body = `Active wildfire detected ${location}. ${this.getFireGuidance(event.properties)}`;
        action = 'Monitor evacuation routes and air quality';
        break;

      case 'aqi':
        const aqi = event.properties.aqi || Math.round(severity * 25);
        title = `Air Quality Alert ${location}`;
        body = `Air quality is ${event.properties.aqi_category || 'unhealthy'} (AQI: ${aqi}) ${location}`;
        action = 'Limit outdoor activities, use masks if necessary';
        break;

      default:
        title = `Environmental Alert ${location}`;
        body = `Environmental hazard detected ${location}`;
        action = 'Stay informed and follow local guidance';
    }

    return { title, body, action };
  }

  private static getLocationDescription(event: any): string {
    if (event.properties.place) return `near ${event.properties.place}`;
    if (event.properties.location_name) return `in ${event.properties.location_name}`;
    if (event.properties.city) return `in ${event.properties.city}`;
    
    const [lng, lat] = event.geometry.coordinates;
    return `at ${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E`;
  }

  private static getEarthquakeGuidance(magnitude: number): string {
    if (magnitude >= 7.0) return 'Major earthquake - expect significant damage.';
    if (magnitude >= 6.0) return 'Strong earthquake - potential for damage.';
    if (magnitude >= 5.0) return 'Moderate earthquake - may be widely felt.';
    return 'Light earthquake - minimal damage expected.';
  }

  private static getFloodGuidance(severity: number): string {
    if (severity >= 8.0) return 'Severe flooding expected - evacuate if advised.';
    if (severity >= 6.0) return 'Significant flooding possible - avoid travel.';
    return 'Minor flooding possible - exercise caution.';
  }

  private static getStormGuidance(properties: any): string {
    const windSpeed = properties.wind_speed;
    if (windSpeed && windSpeed > 25) return 'Hurricane-force winds possible.';
    if (windSpeed && windSpeed > 15) return 'Strong winds and heavy rain expected.';
    return 'Severe weather conditions developing.';
  }

  private static getFireGuidance(properties: any): string {
    const brightness = properties.brightness;
    if (brightness && brightness > 380) return 'High-intensity fire detected.';
    return 'Active fire in the area.';
  }

  private static async sendAlert(subscription: any, event: any, content: any): Promise<void> {
    const alertId = `alert-${event._id}-${subscription._id}-${Date.now()}`;

    try {
      // Send Web Push notification
      if (subscription.channels.includes('webpush') && subscription.push) {
        await this.sendWebPush(subscription.push, content, event);
        
        // Also send to WebSocket if connected
        io.to(`alerts:${subscription._id}`).emit('alert', {
          id: alertId,
          type: event.type,
          severity: event.severity,
          title: content.title,
          body: content.body,
          action: content.action,
          location: event.geometry.coordinates,
          timestamp: new Date().toISOString()
        });
      }

      // TODO: Add SMS and Email sending here
      // if (subscription.channels.includes('sms') && subscription.phone) {
      //   await this.sendSMS(subscription.phone, content);
      // }
      
      // if (subscription.channels.includes('email') && subscription.email) {
      //   await this.sendEmail(subscription.email, content);
      // }

      console.log(`Alert sent to subscription ${subscription._id} for event ${event._id}`);

    } catch (error) {
      console.error(`Failed to send alert to subscription ${subscription._id}:`, error);
    }
  }

  private static async sendWebPush(pushSubscription: any, content: any, event: any): Promise<void> {
    const payload = JSON.stringify({
      title: content.title,
      body: content.body,
      icon: '/icons/alert-icon.png',
      badge: '/icons/badge-icon.png',
      tag: `ecoguard-${event.type}`,
      data: {
        eventId: event._id,
        eventType: event.type,
        severity: event.severity,
        action: content.action,
        url: `/?event=${event._id}`
      },
      actions: [
        {
          action: 'view',
          title: 'View Details'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      requireInteraction: event.severity >= 7.0
    });

    await webpush.sendNotification(pushSubscription, payload);
  }

  // Real-time risk assessment for a location
  static async assessCurrentRisk(lat: number, lng: number, radiusKm: number = 50): Promise<any> {
    try {
      // Find recent events within radius
      const recentEvents = await Event.find({
        geometry: {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: radiusKm * 1000 // Convert km to meters
          }
        },
        starts_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      }).sort({ severity: -1 }).limit(10);

      const riskAssessment = {
        location: { lat, lng },
        timestamp: new Date().toISOString(),
        overall_risk: 'low',
        risk_score: 0,
        active_events: recentEvents.length,
        risks: {
          earthquake: { level: 'low', score: 0, events: [] as any[] },
          flood: { level: 'low', score: 0, events: [] as any[] },
          storm: { level: 'low', score: 0, events: [] as any[] },
          fire: { level: 'low', score: 0, events: [] as any[] },
          aqi: { level: 'low', score: 0, events: [] as any[] }
        }
      };

      // Categorize events by type and calculate risk scores
      for (const event of recentEvents) {
        const distance = this.calculateDistance(lat, lng, event.geometry.coordinates[1], event.geometry.coordinates[0]);
        const timeDecay = this.calculateTimeDecay(event.starts_at);
        const distanceDecay = this.calculateDistanceDecay(distance, radiusKm);
        
        const adjustedSeverity = event.severity * timeDecay * distanceDecay;
        
        if (riskAssessment.risks[event.type as keyof typeof riskAssessment.risks]) {
          const risk = riskAssessment.risks[event.type as keyof typeof riskAssessment.risks];
          risk.events.push({
            id: event._id,
            severity: event.severity,
            distance_km: Math.round(distance),
            age_hours: Math.round((Date.now() - event.starts_at.getTime()) / (1000 * 60 * 60))
          });
          
          risk.score = Math.max(risk.score, adjustedSeverity);
        }
      }

      // Calculate overall risk and levels
      let maxScore = 0;
      for (const [type, risk] of Object.entries(riskAssessment.risks)) {
        risk.level = this.scoreToLevel(risk.score);
        maxScore = Math.max(maxScore, risk.score);
      }

      riskAssessment.risk_score = Math.round(maxScore * 10) / 10;
      riskAssessment.overall_risk = this.scoreToLevel(maxScore);

      return riskAssessment;

    } catch (error) {
      console.error('Error assessing current risk:', error);
      throw error;
    }
  }

  private static calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private static calculateTimeDecay(eventTime: Date): number {
    const hoursAgo = (Date.now() - eventTime.getTime()) / (1000 * 60 * 60);
    return Math.max(0.1, Math.exp(-hoursAgo / 12)); // Decay over 12 hours
  }

  private static calculateDistanceDecay(distance: number, maxRadius: number): number {
    return Math.max(0.1, 1 - (distance / maxRadius));
  }

  private static scoreToLevel(score: number): string {
    if (score >= 7.0) return 'very high';
    if (score >= 5.5) return 'high';
    if (score >= 4.0) return 'moderate';
    if (score >= 2.0) return 'low';
    return 'very low';
  }
}