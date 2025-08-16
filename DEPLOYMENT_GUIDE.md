# 🚀 EcoGuard Production Deployment

## Quick Deploy (5 minutes)

### 1. GitHub Setup
```bash
cd F:\PROJECTS\env
git init
git add .
git commit -m "Initial EcoGuard system"
```
Create repo at https://github.com/new → Push code

### 2. MongoDB Atlas (Free Database)
1. Go to https://cloud.mongodb.com
2. Sign up → Create free cluster
3. Get connection string
4. Replace in production .env

### 3. Deploy Backend (Render - Free)
1. Go to https://render.com
2. Connect GitHub → Select your repo
3. Choose "Web Service"
4. Root Directory: `backend`
5. Build Command: `npm install && npm run build`
6. Start Command: `npm start`
7. Add environment variables

### 4. Deploy Frontend (Vercel - Free)
1. Go to https://vercel.com
2. Import GitHub repo
3. Root Directory: `frontend`
4. Framework: Vite
5. Add environment variable: `VITE_API_BASE_URL=https://your-backend.onrender.com`

### 5. Get API Keys (Free)
- OpenWeather: https://openweathermap.org/api
- Generate VAPID keys: https://web-push-codelab.glitch.me/

## Environment Variables for Production

### Backend (.env)
```
NODE_ENV=production
MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/ecoguard
OPENWEATHER_API_KEY=your_real_key
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=mailto:your-email@domain.com
INGEST_TOKEN=secure-random-token-here
FRONTEND_URL=https://your-app.vercel.app
```

### Frontend (.env)
```
VITE_API_BASE_URL=https://your-backend.onrender.com
```

## Result
- Live URL: https://your-app.vercel.app
- API URL: https://your-backend.onrender.com
- Real-time monitoring system accessible worldwide!

## Cost: $0/month (Free tiers)