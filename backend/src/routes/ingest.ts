import express from 'express';
import { USGSService } from '../services/USGSService';
import { OpenWeatherService } from '../services/OpenWeatherService';
import { NASAService } from '../services/NASAService';
import { OpenAQService } from '../services/OpenAQService';
import { AlertService } from '../services/AlertService';

const router = express.Router();

// Middleware to verify ingestion token
const verifyIngestToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== process.env.INGEST_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

router.use(verifyIngestToken);

// USGS Earthquake Data Ingestion
router.post('/usgs', async (req, res) => {
  try {
    const startTime = Date.now();
    const result = await USGSService.ingestEarthquakes();
    const duration = Date.now() - startTime;

    // Trigger alert processing for new events
    if (result.inserted > 0) {
      AlertService.processNewEvents('earthquake').catch(console.error);
    }

    res.json({
      success: true,
      source: 'usgs',
      ...result,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('USGS ingestion error:', error);
    res.status(500).json({
      success: false,
      source: 'usgs',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// NASA EONET Events Ingestion
router.post('/eonet', async (req, res) => {
  try {
    const startTime = Date.now();
    const result = await NASAService.ingestEONETEvents();
    const duration = Date.now() - startTime;

    if (result.inserted > 0) {
      AlertService.processNewEvents().catch(console.error);
    }

    res.json({
      success: true,
      source: 'nasa-eonet',
      ...result,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('NASA EONET ingestion error:', error);
    res.status(500).json({
      success: false,
      source: 'nasa-eonet',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// NASA FIRMS Fire Data Ingestion
router.post('/firms', async (req, res) => {
  try {
    const startTime = Date.now();
    const countryCodes = req.body.countries || ['MYS', 'SGP', 'IDN', 'THA'];
    const result = await NASAService.ingestFIRMSData(countryCodes);
    const duration = Date.now() - startTime;

    if (result.inserted > 0) {
      AlertService.processNewEvents('fire').catch(console.error);
    }

    res.json({
      success: true,
      source: 'nasa-firms',
      countries: countryCodes,
      ...result,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('NASA FIRMS ingestion error:', error);
    res.status(500).json({
      success: false,
      source: 'nasa-firms',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// OpenWeather Alerts Ingestion
router.post('/openweather', async (req, res) => {
  try {
    const startTime = Date.now();
    const locations = OpenWeatherService.getMonitoringLocations();
    const result = await OpenWeatherService.ingestWeatherAlerts(locations);
    const duration = Date.now() - startTime;

    if (result.inserted > 0) {
      AlertService.processNewEvents('storm').catch(console.error);
    }

    res.json({
      success: true,
      source: 'openweather',
      locations_monitored: locations.length,
      ...result,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('OpenWeather ingestion error:', error);
    res.status(500).json({
      success: false,
      source: 'openweather',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// OpenAQ Air Quality Ingestion
router.post('/openaq', async (req, res) => {
  try {
    const startTime = Date.now();
    const countries = req.body.countries || ['MY', 'SG', 'ID', 'TH'];
    const result = await OpenAQService.ingestAirQualityData(countries);
    const duration = Date.now() - startTime;

    if (result.inserted > 0) {
      AlertService.processNewEvents('aqi').catch(console.error);
    }

    res.json({
      success: true,
      source: 'openaq',
      countries: countries,
      ...result,
      duration_ms: duration,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('OpenAQ ingestion error:', error);
    res.status(500).json({
      success: false,
      source: 'openaq',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Batch ingestion endpoint
router.post('/all', async (req, res) => {
  const results: any[] = [];
  const startTime = Date.now();

  try {
    // Run all ingestions in parallel for speed
    const [usgsResult, eonetResult, weatherResult, aqResult] = await Promise.allSettled([
      USGSService.ingestEarthquakes(),
      NASAService.ingestEONETEvents(),
      OpenWeatherService.ingestWeatherAlerts(OpenWeatherService.getMonitoringLocations()),
      OpenAQService.ingestAirQualityData(['MY', 'SG', 'ID', 'TH'])
    ]);

    if (usgsResult.status === 'fulfilled') {
      results.push({ source: 'usgs', success: true, ...usgsResult.value });
    } else {
      results.push({ source: 'usgs', success: false, error: usgsResult.reason?.message });
    }

    if (eonetResult.status === 'fulfilled') {
      results.push({ source: 'nasa-eonet', success: true, ...eonetResult.value });
    } else {
      results.push({ source: 'nasa-eonet', success: false, error: eonetResult.reason?.message });
    }

    if (weatherResult.status === 'fulfilled') {
      results.push({ source: 'openweather', success: true, ...weatherResult.value });
    } else {
      results.push({ source: 'openweather', success: false, error: weatherResult.reason?.message });
    }

    if (aqResult.status === 'fulfilled') {
      results.push({ source: 'openaq', success: true, ...aqResult.value });
    } else {
      results.push({ source: 'openaq', success: false, error: aqResult.reason?.message });
    }

    // Trigger alert processing for any new events
    const totalInserted = results.reduce((sum, r) => sum + (r.inserted || 0), 0);
    if (totalInserted > 0) {
      AlertService.processNewEvents().catch(console.error);
    }

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      batch_ingestion: true,
      total_sources: results.length,
      total_inserted: totalInserted,
      total_updated: results.reduce((sum, r) => sum + (r.updated || 0), 0),
      duration_ms: duration,
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch ingestion error:', error);
    res.status(500).json({
      success: false,
      batch_ingestion: true,
      error: error instanceof Error ? error.message : 'Unknown error',
      partial_results: results
    });
  }
});

// Health check for ingestion system
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    ingestion_system: 'operational',
    supported_sources: ['usgs', 'nasa-eonet', 'nasa-firms', 'openweather', 'openaq'],
    timestamp: new Date().toISOString()
  });
});

export default router;