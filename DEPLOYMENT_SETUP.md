# 🚀 Quick Deployment Setup Guide

This guide explains what was set up for deploying your Oando MRF system to Render (backend) and Netlify (frontend).

## 📁 Files Created

### 1. `render.yaml` - Backend Deployment Configuration
**Location:** Root directory  
**Purpose:** Tells Render how to deploy your backend service

**What it does:**
- Configures a Node.js web service
- Sets up build and start commands
- Defines environment variables needed
- Configures PostgreSQL database

**Important:** After creating the database in Render, you'll need to manually add these environment variables in the Render dashboard:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (from your PostgreSQL database)
- `JWT_SECRET` (generate a strong random string)

### 2. `netlify.toml` - Frontend Deployment Configuration
**Location:** Root directory  
**Purpose:** Tells Netlify how to deploy your frontend

**What it does:**
- Sets base directory to `frontend`
- Configures redirects for client-side routing
- Adds security headers
- Sets up caching for static assets

### 3. Frontend API Configuration
**File:** `frontend/assets/js/app.js` (Line 7)  
**Current Setting:** `https://oando-mrf.onrender.com/api`

✅ **Already configured correctly!** The frontend is set to use your Render backend URL.

---

## 🎯 Deployment Steps

### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "Add deployment configuration files"
git push origin main
```

### Step 2: Deploy Backend to Render

1. **Go to [Render Dashboard](https://dashboard.render.com)**
2. **Click "New +" → "Blueprint"** (or "Web Service" if Blueprint not available)
3. **Connect your GitHub repository**
4. **If using Blueprint:** Render will automatically detect `render.yaml` and create services
5. **If using Web Service manually:**
   - Name: `oando-mrf-backend`
   - Environment: `Node`
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && npm start`
   - Root Directory: Leave empty

6. **Create PostgreSQL Database:**
   - Click "New +" → "PostgreSQL"
   - Name: `oando-mrf-db`
   - Plan: Free
   - Region: Same as your web service
   - Click "Create Database"

7. **Set Environment Variables in Render:**
   - Go to your web service → "Environment" tab
   - Add these variables:
     ```
     NODE_ENV=production
     PORT=10000
     DB_HOST=<from database dashboard>
     DB_PORT=5432
     DB_NAME=oando_mrf
     DB_USER=<from database dashboard>
     DB_PASSWORD=<from database dashboard>
     JWT_SECRET=<generate with: openssl rand -base64 32>
     FRONTEND_URL=https://oando-mrf.netlify.app
     ```

8. **Run Database Migrations:**
   - Connect to your database using a PostgreSQL client
   - Run the SQL files from `backend/models/` directory
   - Start with `database.sql`, then run migration files in order

9. **Wait for deployment** (usually 2-5 minutes)
10. **Copy your backend URL** (e.g., `https://oando-mrf.onrender.com`)

### Step 3: Deploy Frontend to Netlify

1. **Go to [Netlify Dashboard](https://app.netlify.com)**
2. **Click "Add new site" → "Import an existing project"**
3. **Connect to GitHub** and select your repository
4. **Configure build settings:**
   - Branch to deploy: `main`
   - Base directory: `frontend`
   - Build command: Leave **empty** (static site)
   - Publish directory: `frontend`
5. **Click "Deploy site"**
6. **Wait for deployment** (usually 1-2 minutes)
7. **Copy your frontend URL** (e.g., `https://oando-mrf.netlify.app`)

### Step 4: Update Backend CORS (if needed)

1. Go back to Render dashboard
2. Edit your backend service
3. Update `FRONTEND_URL` environment variable to your Netlify URL
4. Save (Render will auto-redeploy)

---

## ✅ Verification Checklist

After deployment, verify:

- [ ] Backend is running (visit `https://oando-mrf.onrender.com/api/health` or similar)
- [ ] Frontend loads (visit `https://oando-mrf.netlify.app`)
- [ ] Frontend can connect to backend (check browser console for errors)
- [ ] Database migrations completed
- [ ] Admin user created (use `backend/createAdmin.js` or SQL)
- [ ] Login works
- [ ] CORS errors resolved

---

## 🔧 Environment Variables Reference

### Backend (Render)
```
NODE_ENV=production
PORT=10000
DB_HOST=<your-db-host>
DB_PORT=5432
DB_NAME=oando_mrf
DB_USER=<your-db-user>
DB_PASSWORD=<your-db-password>
JWT_SECRET=<strong-random-string>
FRONTEND_URL=https://oando-mrf.netlify.app
```

### Frontend
No environment variables needed - API URL is hardcoded in `frontend/assets/js/app.js`

---

## 📝 Important Notes

1. **Free Tier Limitations:**
   - Render: Service spins down after 15 min inactivity (first request takes ~30s to wake up)
   - Netlify: Always on, 100GB bandwidth/month
   - Render PostgreSQL: 1GB storage, 90-day retention

2. **File Uploads:**
   - Render free tier has ephemeral storage (files deleted on restart)
   - For production, consider cloud storage (AWS S3, Cloudinary)

3. **Database:**
   - Make sure to run all migration files in order
   - Keep database credentials secure (never commit to git)

4. **Security:**
   - Generate a strong `JWT_SECRET` (use `openssl rand -base64 32`)
   - Use strong database passwords
   - HTTPS is automatic on both platforms

---

## 🐛 Troubleshooting

### Backend won't start
- Check Render logs: Service → "Logs" tab
- Verify all environment variables are set
- Check database connection (verify credentials)

### Frontend can't connect to backend
- Verify `FRONTEND_URL` in Render matches Netlify URL exactly
- Check CORS settings in `backend/server.js`
- Verify backend URL in `frontend/assets/js/app.js` (line 7)

### Database connection errors
- Verify all DB_* environment variables are correct
- Check that database is in same region as web service
- Ensure migrations have been run

### 500 Internal Server Error
- Check Render logs for specific error
- Verify `JWT_SECRET` is set
- Check database connection

---

## 📞 Your URLs

- **Backend:** `https://oando-mrf.onrender.com`
- **Frontend:** `https://oando-mrf.netlify.app`

Both are already configured in the code! 🎉

---

## 🔄 Updating After Deployment

### To update backend:
1. Make changes locally
2. Commit and push to GitHub
3. Render auto-deploys on push

### To update frontend:
1. Make changes locally
2. Commit and push to GitHub
3. Netlify auto-deploys on push

---

**That's it! Your application is ready for temporary hosting on Render and Netlify.**

