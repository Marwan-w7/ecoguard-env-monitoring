import express from 'express';
import { Event } from '../models/Event';
import { AlertService } from '../services/AlertService';

const router = express.Router();

// Get events with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const {
      bbox,
      type,
      since,
      until,
      severity_min,
      severity_max,
      limit = 100,
      offset = 0,
      source
    } = req.query;

    // Build query
    const query: any = {};

    // Bounding box filter (west,south,east,north)
    if (bbox) {
      const [west, south, east, north] = (bbox as string).split(',').map(Number);
      if (west && south && east && north) {
        query.geometry = {
          $geoWithin: {
            $box: [[west, south], [east, north]]
          }
        };
      }
    }

    // Event type filter
    if (type) {
      const types = (type as string).split(',');
      query.type = { $in: types };
    }

    // Source filter
    if (source) {
      const sources = (source as string).split(',');
      query.source = { $in: sources };
    }

    // Time range filter
    if (since || until) {
      query.starts_at = {};
      if (since) query.starts_at.$gte = new Date(since as string);
      if (until) query.starts_at.$lte = new Date(until as string);
    }

    // Severity range filter
    if (severity_min || severity_max) {
      query.severity = {};
      if (severity_min) query.severity.$gte = Number(severity_min);
      if (severity_max) query.severity.$lte = Number(severity_max);
    }

    // Execute query with pagination
    const events = await Event.find(query)
      .sort({ starts_at: -1, severity: -1 })
      .limit(Number(limit))
      .skip(Number(offset))
      .lean();

    // Get total count for pagination
    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      events: events.map(event => ({
        id: event._id,
        type: event.type,
        source: event.source,
        severity: event.severity,
        confidence: event.confidence,
        geometry: event.geometry,
        area_bbox: event.area_bbox,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        properties: event.properties,
        ingested_at: event.ingested_at
      })),
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        has_more: total > Number(offset) + Number(limit)
      },
      filters_applied: {
        bbox: bbox || null,
        type: type || null,
        source: source || null,
        since: since || null,
        until: until || null,
        severity_range: [severity_min || null, severity_max || null]
      }
    });

  } catch (error) {
    console.error('Events query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch events',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get single event by ID
router.get('/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findById(eventId).lean();
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    res.json({
      success: true,
      event: {
        id: event._id,
        type: event.type,
        source: event.source,
        severity: event.severity,
        confidence: event.confidence,
        geometry: event.geometry,
        area_bbox: event.area_bbox,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        properties: event.properties,
        ingested_at: event.ingested_at
      }
    });

  } catch (error) {
    console.error('Event fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch event'
    });
  }
});

// Get events near a location
router.get('/near/:lat/:lng', async (req, res) => {
  try {
    const { lat, lng } = req.params;
    const { 
      radius_km = 50, 
      hours = 24, 
      limit = 20,
      type,
      severity_min = 3.0
    } = req.query;

    const latitude = Number(lat);
    const longitude = Number(lng);
    const radiusMeters = Number(radius_km) * 1000;
    const since = new Date(Date.now() - Number(hours) * 60 * 60 * 1000);

    // Build query
    const query: any = {
      geometry: {
        $near: {
          $geometry: { type: 'Point', coordinates: [longitude, latitude] },
          $maxDistance: radiusMeters
        }
      },
      starts_at: { $gte: since },
      severity: { $gte: Number(severity_min) }
    };

    if (type) {
      const types = (type as string).split(',');
      query.type = { $in: types };
    }

    const events = await Event.find(query)
      .limit(Number(limit))
      .lean();

    // Calculate distances
    const eventsWithDistance = events.map(event => {
      const [eventLng, eventLat] = event.geometry.coordinates;
      const distance = calculateDistance(latitude, longitude, eventLat, eventLng);
      
      return {
        id: event._id,
        type: event.type,
        source: event.source,
        severity: event.severity,
        geometry: event.geometry,
        starts_at: event.starts_at,
        properties: event.properties,
        distance_km: Math.round(distance * 10) / 10
      };
    });

    res.json({
      success: true,
      location: { lat: latitude, lng: longitude },
      search_radius_km: Number(radius_km),
      time_window_hours: Number(hours),
      events: eventsWithDistance,
      total_found: eventsWithDistance.length
    });

  } catch (error) {
    console.error('Near events query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nearby events'
    });
  }
});

// Get event statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const since = new Date(Date.now() - Number(hours) * 60 * 60 * 1000);

    // Aggregate statistics
    const stats = await Event.aggregate([
      { $match: { starts_at: { $gte: since } } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          avg_severity: { $avg: '$severity' },
          max_severity: { $max: '$severity' },
          latest: { $max: '$starts_at' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const totalEvents = await Event.countDocuments({ starts_at: { $gte: since } });
    
    // Get severity distribution
    const severityStats = await Event.aggregate([
      { $match: { starts_at: { $gte: since } } },
      {
        $bucket: {
          groupBy: '$severity',
          boundaries: [0, 3, 5, 7, 9, 11],
          default: 'other',
          output: {
            count: { $sum: 1 },
            avg_severity: { $avg: '$severity' }
          }
        }
      }
    ]);

    res.json({
      success: true,
      time_window_hours: Number(hours),
      total_events: totalEvents,
      by_type: stats,
      by_severity: severityStats,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Stats query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate statistics'
    });
  }
});

// Get real-time event feed (last 10 minutes)
router.get('/feed/realtime', async (req, res) => {
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000); // Last 10 minutes
    
    const recentEvents = await Event.find({
      ingested_at: { $gte: since },
      severity: { $gte: 3.0 }
    })
    .sort({ ingested_at: -1 })
    .limit(50)
    .lean();

    res.json({
      success: true,
      feed_type: 'realtime',
      time_window_minutes: 10,
      events: recentEvents.map(event => ({
        id: event._id,
        type: event.type,
        source: event.source,
        severity: event.severity,
        geometry: event.geometry,
        starts_at: event.starts_at,
        ingested_at: event.ingested_at,
        properties: {
          title: event.properties.title || event.properties.place || `${event.type} event`,
          description: event.properties.description || ''
        }
      })),
      total: recentEvents.length,
      last_updated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Realtime feed error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch realtime feed'
    });
  }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default router;