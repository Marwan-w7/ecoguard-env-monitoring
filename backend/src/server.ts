import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as IOServer } from 'socket.io';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new IOServer(server, { 
  cors: { 
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  } 
});

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // limit each IP to 120 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Import routes
import ingestRoutes from './routes/ingest';
import eventsRoutes from './routes/events';
import subscriptionsRoutes from './routes/subscriptions';
import riskRoutes from './routes/risk';
import metricsRoutes from './routes/metrics';

// Health check endpoint
app.get('/v1/status', (req, res) => {
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    service: 'ecoguard-api',
    version: '1.0.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use('/v1/ingest', ingestRoutes);
app.use('/v1/events', eventsRoutes);
app.use('/v1/subscriptions', subscriptionsRoutes);
app.use('/v1/risk', riskRoutes);
app.use('/v1/metrics', metricsRoutes);

// API Documentation endpoint
app.get('/v1/docs', (req, res) => {
  res.json({
    name: 'EcoGuard Environmental Disaster Alert API',
    version: '1.0.0',
    description: 'Real-time environmental monitoring and disaster prediction system',
    endpoints: {
      health: 'GET /v1/status',
      events: {
        list: 'GET /v1/events',
        get: 'GET /v1/events/:id',
        near: 'GET /v1/events/near/:lat/:lng',
        stats: 'GET /v1/events/stats/summary',
        realtime: 'GET /v1/events/feed/realtime'
      },
      subscriptions: {
        create: 'POST /v1/subscriptions',
        get: 'GET /v1/subscriptions/:id',
        update: 'PUT /v1/subscriptions/:id',
        delete: 'DELETE /v1/subscriptions/:id',
        test: 'POST /v1/subscriptions/:id/test-alert'
      },
      risk: {
        current: 'GET /v1/risk/now?lat=&lng=',
        forecast: 'GET /v1/risk/forecast?lat=&lng=',
        heatmap: 'GET /v1/risk/heatmap?bbox=',
        trends: 'GET /v1/risk/trends?lat=&lng='
      },
      ingestion: {
        usgs: 'POST /v1/ingest/usgs',
        eonet: 'POST /v1/ingest/eonet',
        openweather: 'POST /v1/ingest/openweather',
        openaq: 'POST /v1/ingest/openaq',
        all: 'POST /v1/ingest/all'
      }
    },
    data_sources: [
      'USGS Earthquake Hazards Program',
      'NASA EONET (Earth Observatory Natural Event Tracker)',
      'NASA FIRMS (Fire Information for Resource Management System)',
      'OpenWeather API',
      'OpenAQ Air Quality API'
    ],
    websocket: 'wss://api.ecoguard.com/ws'
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`WebSocket connected: ${socket.id}`);
  
  socket.on('subscribe', (data) => {
    const { channels } = data;
    if (channels && Array.isArray(channels)) {
      channels.forEach(channel => socket.join(channel));
      console.log(`Socket ${socket.id} subscribed to channels:`, channels);
    }
  });

  socket.on('disconnect', () => {
    console.log(`WebSocket disconnected: ${socket.id}`);
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

const PORT = process.env.PORT || 8080;
const MONGO_URL = process.env.MONGO_URL;

async function startServer() {
  try {
    // Try to connect to MongoDB (optional for testing)
    if (MONGO_URL) {
      try {
        await mongoose.connect(MONGO_URL);
        console.log('✅ Connected to MongoDB');
      } catch (error) {
        console.log('⚠️ MongoDB connection failed - running without database');
        console.log('   Some features will be disabled');
      }
    } else {
      console.log('⚠️ No MongoDB URL - running without database');
    }

    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 EcoGuard API server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/v1/status`);
      console.log(`📖 API docs: http://localhost:${PORT}/v1/docs`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await mongoose.connection.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Export for testing
export { app, io };

// Start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  startServer();
}