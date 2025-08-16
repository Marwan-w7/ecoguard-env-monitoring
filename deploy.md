# 🚀 Deploy EcoGuard in 10 Minutes

## Step 1: Create GitHub Repository
```bash
# In F:\PROJECTS\env
git init
git add .
git commit -m "EcoGuard environmental monitoring system"
```
Go to https://github.com/new → Create "ecoguard" repo → Push code

## Step 2: Deploy Backend (Render)
1. Go to https://render.com → Sign up with GitHub
2. Click "New" → "Web Service"
3. Connect your GitHub repo
4. Settings:
   - **Name**: ecoguard-api
   - **Root Directory**: backend
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add Environment Variables:
   ```
   NODE_ENV=production
   MONGO_URL=mongodb://localhost:27017/ecoguard
   INGEST_TOKEN=secure-token-123
   OPENWEATHER_API_KEY=demo_key
   ```
6. Click "Create Web Service"

## Step 3: Deploy Frontend (Vercel)
1. Go to https://vercel.com → Sign up with GitHub
2. Click "New Project" → Import your repo
3. Settings:
   - **Root Directory**: frontend
   - **Framework**: Vite
4. Add Environment Variable:
   ```
   VITE_API_BASE_URL=https://ecoguard-api.onrender.com
   ```
5. Click "Deploy"

## Step 4: Test Live System
- Frontend: https://your-app.vercel.app
- Backend: https://ecoguard-api.onrender.com/v1/status

## Result: Live Environmental Monitoring System! 🌍

**Free hosting forever** - No credit card needed!