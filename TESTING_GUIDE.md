# EcoGuard Backend Testing Guide

## 🚀 Quick Setup & Test

### 1. Environment Setup
```bash
cd F:\PROJECTS\env\backend
npm install
```

### 2. Create .env file
```bash
# Copy .env.example to .env
copy .env.example .env
```

### 3. Configure .env (REQUIRED)
```env
NODE_ENV=development
PORT=8080
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/ecoguard
OPENWEATHER_API_KEY=your_key_here
INGEST_TOKEN=test-token-123
```

### 4. Get Free API Keys (5 minutes)
- **MongoDB Atlas**: https://cloud.mongodb.com (Free 500MB)
- **OpenWeather**: https://openweathermap.org/api (Free 1000 calls/day)
- **NASA**: Uses DEMO_KEY (no signup needed)

### 5. Start Server
```bash
npm run dev
```

## 🧪 Test Real Data (Live APIs)

### Test 1: Health Check
```bash
curl http://localhost:8080/v1/status
```

### Test 2: Ingest Real USGS Earthquakes
```bash
curl -X POST http://localhost:8080/v1/ingest/usgs \
  -H "Authorization: Bearer test-token-123"
```

### Test 3: Get Live Events
```bash
curl "http://localhost:8080/v1/events?limit=5"
```

### Test 4: Risk Assessment (Your Location)
```bash
curl "http://localhost:8080/v1/risk/now?lat=3.139&lng=101.687"
```

### Test 5: Metrics
```bash
curl http://localhost:8080/v1/metrics/json
```

## 🔥 Full Data Ingestion Test
```bash
# Ingest from all sources
curl -X POST http://localhost:8080/v1/ingest/all \
  -H "Authorization: Bearer test-token-123"
```

## 📊 Expected Results
- **USGS**: 10-50 earthquakes globally
- **NASA EONET**: 5-20 active disasters
- **OpenWeather**: Weather alerts for 10 cities
- **Risk Assessment**: Real severity scores

## 🐛 Troubleshooting
- **MongoDB Error**: Check connection string
- **API Errors**: Verify API keys
- **No Events**: Normal if no recent disasters
- **Rate Limits**: Wait 1 minute between tests