import express from 'express';
import { Event } from '../models/Event';
import { Subscription } from '../models/Subscription';

const router = express.Router();

// Prometheus-style metrics endpoint
router.get('/', async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Event metrics
    const totalEvents = await Event.countDocuments();
    const eventsLastHour = await Event.countDocuments({ ingested_at: { $gte: oneHourAgo } });
    const eventsLastDay = await Event.countDocuments({ ingested_at: { $gte: oneDayAgo } });

    // Events by source
    const eventsBySource = await Event.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    // Events by type
    const eventsByType = await Event.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]);

    // Subscription metrics
    const totalSubscriptions = await Subscription.countDocuments();
    const activeSubscriptions = await Subscription.countDocuments({
      created_at: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
    });

    // High severity events (last 24h)
    const highSeverityEvents = await Event.countDocuments({
      ingested_at: { $gte: oneDayAgo },
      severity: { $gte: 6.0 }
    });

    // Generate Prometheus format
    const metrics = [
      '# HELP ecoguard_events_total Total number of events ingested',
      '# TYPE ecoguard_events_total counter',
      `ecoguard_events_total ${totalEvents}`,
      '',
      '# HELP ecoguard_events_last_hour Events ingested in the last hour',
      '# TYPE ecoguard_events_last_hour gauge',
      `ecoguard_events_last_hour ${eventsLastHour}`,
      '',
      '# HELP ecoguard_events_last_day Events ingested in the last 24 hours',
      '# TYPE ecoguard_events_last_day gauge',
      `ecoguard_events_last_day ${eventsLastDay}`,
      '',
      '# HELP ecoguard_events_by_source Events by data source',
      '# TYPE ecoguard_events_by_source counter'
    ];

    eventsBySource.forEach(item => {
      metrics.push(`ecoguard_events_by_source{source="${item._id}"} ${item.count}`);
    });

    metrics.push('');
    metrics.push('# HELP ecoguard_events_by_type Events by disaster type');
    metrics.push('# TYPE ecoguard_events_by_type counter');

    eventsByType.forEach(item => {
      metrics.push(`ecoguard_events_by_type{type="${item._id}"} ${item.count}`);
    });

    metrics.push('');
    metrics.push('# HELP ecoguard_subscriptions_total Total active subscriptions');
    metrics.push('# TYPE ecoguard_subscriptions_total gauge');
    metrics.push(`ecoguard_subscriptions_total ${totalSubscriptions}`);
    metrics.push('');
    metrics.push('# HELP ecoguard_subscriptions_active Active subscriptions (last 30 days)');
    metrics.push('# TYPE ecoguard_subscriptions_active gauge');
    metrics.push(`ecoguard_subscriptions_active ${activeSubscriptions}`);
    metrics.push('');
    metrics.push('# HELP ecoguard_high_severity_events_24h High severity events (≥6.0) in last 24h');
    metrics.push('# TYPE ecoguard_high_severity_events_24h gauge');
    metrics.push(`ecoguard_high_severity_events_24h ${highSeverityEvents}`);
    metrics.push('');
    metrics.push('# HELP ecoguard_system_uptime_seconds System uptime in seconds');
    metrics.push('# TYPE ecoguard_system_uptime_seconds counter');
    metrics.push(`ecoguard_system_uptime_seconds ${process.uptime()}`);

    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics.join('\n'));

  } catch (error) {
    console.error('Metrics generation error:', error);
    res.status(500).send('# Error generating metrics\n');
  }
});

// JSON metrics endpoint for dashboards
router.get('/json', async (req, res) => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Comprehensive metrics in JSON format
    const metrics = {
      timestamp: now.toISOString(),
      system: {
        uptime_seconds: process.uptime(),
        memory_usage: process.memoryUsage(),
        node_version: process.version,
        environment: process.env.NODE_ENV || 'development'
      },
      events: {
        total: await Event.countDocuments(),
        last_hour: await Event.countDocuments({ ingested_at: { $gte: oneHourAgo } }),
        last_24h: await Event.countDocuments({ ingested_at: { $gte: oneDayAgo } }),
        high_severity_24h: await Event.countDocuments({
          ingested_at: { $gte: oneDayAgo },
          severity: { $gte: 6.0 }
        }),
        by_source: await Event.aggregate([
          { $group: { _id: '$source', count: { $sum: 1 } } }
        ]),
        by_type: await Event.aggregate([
          { $group: { _id: '$type', count: { $sum: 1 }, avg_severity: { $avg: '$severity' } } }
        ]),
        severity_distribution: await Event.aggregate([
          {
            $bucket: {
              groupBy: '$severity',
              boundaries: [0, 3, 5, 7, 9, 11],
              default: 'extreme',
              output: { count: { $sum: 1 } }
            }
          }
        ])
      },
      subscriptions: {
        total: await Subscription.countDocuments(),
        active_30d: await Subscription.countDocuments({
          created_at: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }
        }),
        by_channel: await Subscription.aggregate([
          { $unwind: '$channels' },
          { $group: { _id: '$channels', count: { $sum: 1 } } }
        ]),
        avg_radius: await Subscription.aggregate([
          { $group: { _id: null, avg_radius: { $avg: '$radius_km' } } }
        ])
      },
      ingestion: {
        sources_configured: [
          'usgs',
          'nasa-eonet', 
          'nasa-firms',
          'openweather',
          'openaq'
        ],
        last_ingestion: await Event.findOne({}, {}, { sort: { ingested_at: -1 } }).then(e => e?.ingested_at),
        ingestion_rate_per_hour: await Event.countDocuments({ ingested_at: { $gte: oneHourAgo } })
      }
    };

    res.json({
      success: true,
      metrics
    });

  } catch (error) {
    console.error('JSON metrics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate metrics'
    });
  }
});

// Health check with detailed status
router.get('/health', async (req, res) => {
  try {
    const checks = {
      database: false,
      recent_ingestion: false,
      subscriptions: false
    };

    // Database connectivity
    try {
      await Event.findOne().limit(1);
      checks.database = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Recent ingestion (last 30 minutes)
    try {
      const recentEvents = await Event.countDocuments({
        ingested_at: { $gte: new Date(Date.now() - 30 * 60 * 1000) }
      });
      checks.recent_ingestion = recentEvents > 0;
    } catch (error) {
      console.error('Ingestion health check failed:', error);
    }

    // Subscription system
    try {
      await Subscription.findOne().limit(1);
      checks.subscriptions = true;
    } catch (error) {
      console.error('Subscription health check failed:', error);
    }

    const allHealthy = Object.values(checks).every(check => check);
    const status = allHealthy ? 'healthy' : 'degraded';

    res.status(allHealthy ? 200 : 503).json({
      status,
      timestamp: new Date().toISOString(),
      checks,
      uptime: process.uptime(),
      version: '1.0.0'
    });

  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

export default router;