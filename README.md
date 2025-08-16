# EcoGuard - Environmental Disaster Alert System

## 🌍 Overview
EcoGuard is an AI-powered environmental disaster early warning platform that monitors real-time data, predicts disaster risks using machine learning, and sends geotargeted alerts to individuals and organizations.

## 🏗️ Architecture
```
ecoguard/
├── backend/          # Node.js + Express API server
├── frontend/         # React + Vite PWA client
├── ml/              # ML models and notebooks
├── .github/         # CI/CD workflows
└── docs/            # Documentation
```

## 🚀 Tech Stack
- **Backend**: Node.js, Express, Socket.IO, MongoDB Atlas
- **Frontend**: React, Vite, Leaflet, PWA
- **ML/AI**: Python, XGBoost, Hugging Face Spaces
- **Deployment**: Render/Railway (backend), Vercel/Netlify (frontend)
- **Data Sources**: USGS, NASA EONET, OpenWeather, OpenAQ

## 🎯 Features
- Real-time disaster monitoring (earthquakes, floods, air quality, storms)
- AI-powered risk prediction
- Geofenced alert system
- Multi-channel notifications (Web Push, SMS, Email)
- Interactive risk visualization
- Offline-capable PWA

## 📋 Development Status
See [PROJECT_LOG.md](./PROJECT_LOG.md) for detailed progress tracking.

## 🔧 Quick Start
1. Clone repository
2. Setup backend: `cd backend && npm install`
3. Setup frontend: `cd frontend && npm install`
4. Configure environment variables
5. Run development servers

## 📊 Zero-Cost Deployment
This project is designed to run entirely on free tiers:
- MongoDB Atlas (Free 500MB)
- Render/Railway (Free hosting)
- Vercel/Netlify (Free static hosting)
- Hugging Face Spaces (Free ML hosting)
- GitHub Actions (Free CI/CD)

## 📄 License
MIT License - See LICENSE file for details