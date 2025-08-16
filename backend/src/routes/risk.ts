import express from 'express';
import { AlertService } from '../services/AlertService';
import { Event } from '../models/Event';

const router = express.Router();

// Get current risk assessment for a location
router.get('/now', async (req, res) => {
  try {
    const { lat, lng, radius_km = 50 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    const radius = Number(radius_km);

    if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates'
      });
    }

    const riskAssessment = await AlertService.assessCurrentRisk(latitude, longitude, radius);

    res.json({
      success: true,
      risk_assessment: riskAssessment
    });

  } catch (error) {
    console.error('Risk assessment error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assess current risk',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get risk forecast for a location (placeholder for ML integration)
router.get('/forecast', async (req, res) => {
  try {
    const { lat, lng, type, horizon_hours = 6 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    const hours = Number(horizon_hours);

    // For now, return a basic forecast based on recent trends
    // This will be replaced with actual ML model predictions
    const recentEvents = await Event.find({
      geometry: {
        $near: {
          $geometry: { type: 'Point', coordinates: [longitude, latitude] },
          $maxDistance: 100000 // 100km
        }
      },
      starts_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      ...(type && { type: type as string })
    }).limit(20);

    // Simple trend analysis
    const eventsByType: { [key: string]: any[] } = {};
    recentEvents.forEach(event => {
      if (!eventsByType[event.type]) eventsByType[event.type] = [];
      eventsByType[event.type].push(event);
    });

    const forecasts = Object.entries(eventsByType).map(([eventType, events]) => {
      const avgSeverity = events.reduce((sum, e) => sum + e.severity, 0) / events.length;
      const trend = events.length > 5 ? 'increasing' : events.length > 2 ? 'stable' : 'decreasing';
      
      // Simple probability calculation based on recent activity
      let probability = Math.min(0.8, events.length * 0.1);
      if (trend === 'increasing') probability *= 1.2;
      if (trend === 'decreasing') probability *= 0.8;

      return {
        type: eventType,
        probability: Math.round(probability * 100) / 100,
        confidence: 0.6, // Lower confidence for rule-based forecast
        expected_severity: Math.round(avgSeverity * 10) / 10,
        trend: trend,
        recent_events: events.length,
        valid_until: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
      };
    });

    res.json({
      success: true,
      location: { lat: latitude, lng: longitude },
      forecast_horizon_hours: hours,
      forecasts: forecasts,
      model_type: 'trend_analysis', // Will change to 'ml_model' when implemented
      generated_at: new Date().toISOString(),
      note: 'This is a basic trend-based forecast. ML models will provide more accurate predictions.'
    });

  } catch (error) {
    console.error('Risk forecast error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate risk forecast'
    });
  }
});

// Get risk heatmap data for a region
router.get('/heatmap', async (req, res) => {
  try {
    const { bbox, resolution = 0.1, type } = req.query;

    if (!bbox) {
      return res.status(400).json({
        success: false,
        error: 'Bounding box (bbox) is required'
      });
    }

    const [west, south, east, north] = (bbox as string).split(',').map(Number);
    const gridResolution = Number(resolution);

    if (!west || !south || !east || !north) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bounding box format. Use: west,south,east,north'
      });
    }

    // Generate grid points
    const gridPoints = [];
    for (let lat = south; lat <= north; lat += gridResolution) {
      for (let lng = west; lng <= east; lng += gridResolution) {
        gridPoints.push({ lat, lng });
      }
    }

    // Limit grid size to prevent performance issues
    if (gridPoints.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Grid too large. Reduce area or increase resolution.'
      });
    }

    // Calculate risk for each grid point
    const heatmapData = await Promise.all(
      gridPoints.map(async (point) => {
        try {
          const risk = await AlertService.assessCurrentRisk(point.lat, point.lng, 25);
          return {
            lat: point.lat,
            lng: point.lng,
            risk_score: risk.risk_score,
            risk_level: risk.overall_risk,
            dominant_risk: Object.entries(risk.risks)
              .sort(([,a], [,b]) => (b as any).score - (a as any).score)[0][0]
          };
        } catch {
          return {
            lat: point.lat,
            lng: point.lng,
            risk_score: 0,
            risk_level: 'unknown',
            dominant_risk: 'none'
          };
        }
      })
    );

    res.json({
      success: true,
      heatmap: {
        bbox: [west, south, east, north],
        resolution: gridResolution,
        grid_points: heatmapData.length,
        data: heatmapData
      },
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Heatmap generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate risk heatmap'
    });
  }
});

// Get risk trends for a location over time
router.get('/trends', async (req, res) => {
  try {
    const { lat, lng, days = 7 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required'
      });
    }

    const latitude = Number(lat);
    const longitude = Number(lng);
    const daysPeriod = Number(days);

    // Get events for the specified period
    const since = new Date(Date.now() - daysPeriod * 24 * 60 * 60 * 1000);
    
    const events = await Event.find({
      geometry: {
        $near: {
          $geometry: { type: 'Point', coordinates: [longitude, latitude] },
          $maxDistance: 50000 // 50km radius
        }
      },
      starts_at: { $gte: since }
    }).sort({ starts_at: 1 });

    // Group events by day and type
    const dailyRisks: { [date: string]: { [type: string]: number } } = {};
    
    for (let i = 0; i < daysPeriod; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      dailyRisks[dateStr] = {
        earthquake: 0,
        flood: 0,
        storm: 0,
        fire: 0,
        aqi: 0
      };
    }

    // Calculate daily risk scores
    events.forEach(event => {
      const dateStr = event.starts_at.toISOString().split('T')[0];
      if (dailyRisks[dateStr]) {
        const distance = calculateDistance(
          latitude, longitude,
          event.geometry.coordinates[1], event.geometry.coordinates[0]
        );
        const distanceDecay = Math.max(0.1, 1 - (distance / 50));
        const riskContribution = event.severity * distanceDecay;
        
        dailyRisks[dateStr][event.type] = Math.max(
          dailyRisks[dateStr][event.type],
          riskContribution
        );
      }
    });

    // Convert to time series format
    const timeSeries = Object.entries(dailyRisks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, risks]) => ({
        date,
        risks,
        overall_risk: Math.max(...Object.values(risks))
      }));

    res.json({
      success: true,
      location: { lat: latitude, lng: longitude },
      period_days: daysPeriod,
      trends: timeSeries,
      summary: {
        avg_risk: timeSeries.reduce((sum, day) => sum + day.overall_risk, 0) / timeSeries.length,
        max_risk: Math.max(...timeSeries.map(day => day.overall_risk)),
        total_events: events.length
      },
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Risk trends error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate risk trends'
    });
  }
});

// Helper function
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default router;