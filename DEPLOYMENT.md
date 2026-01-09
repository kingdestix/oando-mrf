# 🚀 Deployment Guide - Oando MRF System

Complete guide for deploying the MRF system to **Render (Backend)** and **Netlify (Frontend)**.

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Git Setup & Commit](#git-setup--commit)
3. [Backend Deployment (Render)](#backend-deployment-render)
4. [Frontend Deployment (Netlify)](#frontend-deployment-netlify)
5. [Post-Deployment Configuration](#post-deployment-configuration)
6. [Troubleshooting](#troubleshooting)

---

## ✅ Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] GitHub account and repository created
- [ ] Render account (free tier available)
- [ ] Netlify account (free tier available)
- [ ] All code changes committed locally
- [ ] Database migrations ready
- [ ] Environment variables documented

---

## 🔧 Git Setup & Commit

### Step 1: Initialize Git (if not already done)

```bash
cd "mrf project"
git init
```

### Step 2: Add All Files

```bash
git add .
```

### Step 3: Create Initial Commit

```bash
git commit -m "Initial commit: Oando MRF System with complete workflow"
```

### Step 4: Create GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it: `oando-mrf-system` (or your preferred name)
3. **DO NOT** initialize with README, .gitignore, or license
4. Copy the repository URL (e.g., `https://github.com/yourusername/oando-mrf-system.git`)

### Step 5: Connect and Push

```bash
git remote add origin https://github.com/yourusername/oando-mrf-system.git
git branch -M main
git push -u origin main
```

---

## 🖥️ Backend Deployment (Render)

### Step 1: Create Render Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account and select your repository

### Step 2: Configure Service Settings

**Name:** `oando-mrf-backend` (or your preferred name)

**Environment:** `Node`

**Build Command:**
```bash
cd backend && npm install
```

**Start Command:**
```bash
cd backend && npm start
```

**Root Directory:** Leave empty (Render will use repo root)

### Step 3: Add Environment Variables

In Render dashboard, go to **"Environment"** tab and add:

| Key | Value | Notes |
|-----|-------|-------|
| `NODE_ENV` | `production` | Required |
| `PORT` | `10000` | Render auto-assigns, but set this |
| `DB_HOST` | `your-render-db-host` | From Render Postgres (see below) |
| `DB_PORT` | `5432` | Default PostgreSQL port |
| `DB_NAME` | `oando_mrf` | Your database name |
| `DB_USER` | `your-db-user` | From Render Postgres |
| `DB_PASSWORD` | `your-db-password` | From Render Postgres |
| `JWT_SECRET` | `your-super-secret-jwt-key-change-this` | **Generate a strong random string** |
| `FRONTEND_URL` | `https://your-netlify-app.netlify.app` | **Update after Netlify deployment** |

### Step 4: Create Render PostgreSQL Database

1. In Render dashboard, click **"New +"** → **"PostgreSQL"**
2. Name: `oando-mrf-db`
3. Plan: **Free** (for temporary hosting)
4. Region: Choose closest to you
5. Click **"Create Database"**
6. Wait for database to be created
7. Copy the **Internal Database URL** (format: `postgresql://user:password@host:port/dbname`)
8. Use these values in your environment variables above

### Step 5: Run Database Migrations

After database is created, you need to run your SQL migrations:

**Option A: Using Render Shell (Recommended)**
1. In Render dashboard, click on your database
2. Go to **"Connect"** tab
3. Copy the **External Connection String**
4. Use a PostgreSQL client (pgAdmin, DBeaver, or psql) to connect
5. Run all migration files in order (see README.md for list)

**Option B: Using psql Command Line**
```bash
# Install PostgreSQL client if needed
# Then connect:
psql "postgresql://user:password@host:port/dbname"

# Run migrations:
\i backend/models/database.sql
\i backend/models/migration-approval-workflow.sql
# ... (continue with all migration files)
```

### Step 6: Deploy

1. Click **"Create Web Service"** in Render
2. Render will automatically:
   - Clone your repo
   - Run `npm install` in backend folder
   - Start the server
3. Wait for deployment to complete (usually 2-5 minutes)
4. Copy your **Render service URL** (e.g., `https://oando-mrf-backend.onrender.com`)

---

## 🌐 Frontend Deployment (Netlify)

### Step 1: Update API URL in Frontend

**⚠️ IMPORTANT: Update this file before deploying!**

**File:** `frontend/assets/js/app.js`

**Line 7:** Change the API URL to your Render backend URL:

```javascript
const API_BASE_DEFAULT = 
  window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : 'https://your-render-backend-url.onrender.com/api'; // ← UPDATE THIS
```

**Example:**
```javascript
const API_BASE_DEFAULT = 
  window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : 'https://oando-mrf-backend.onrender.com/api';
```

### Step 2: Commit the Change

```bash
git add frontend/assets/js/app.js
git commit -m "Update API URL for production deployment"
git push
```

### Step 3: Create Netlify Site

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect to GitHub and select your repository

### Step 4: Configure Build Settings

**Branch to deploy:** `main` (or your default branch)

**Base directory:** `frontend`

**Build command:** Leave **empty** (static site, no build needed)

**Publish directory:** `frontend`

### Step 5: Deploy

1. Click **"Deploy site"**
2. Netlify will deploy your frontend
3. Wait for deployment (usually 1-2 minutes)
4. Copy your **Netlify site URL** (e.g., `https://oando-mrf.netlify.app`)

### Step 6: Update Backend CORS

1. Go back to Render dashboard
2. Edit your backend service
3. Update the `FRONTEND_URL` environment variable:
   ```
   FRONTEND_URL=https://your-netlify-app.netlify.app
   ```
4. Save and redeploy (Render will auto-redeploy)

---

## 🔄 Post-Deployment Configuration

### 1. Update Backend CORS (if needed)

If you get CORS errors, check `backend/server.js` line 48-51:

```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
```

Make sure `FRONTEND_URL` is set correctly in Render environment variables.

### 2. Create Admin User

After deployment, you need to create an admin user. You can:

**Option A: Use the API directly**
```bash
curl -X POST https://your-backend.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@oando.com",
    "password": "YourSecurePassword123!",
    "first_name": "Admin",
    "last_name": "User",
    "role": "admin"
  }'
```

**Option B: Create via SQL**
```sql
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
VALUES (
  'admin@oando.com',
  '$2b$10$YourHashedPasswordHere', -- Use bcrypt to hash password
  'Admin',
  'User',
  'admin',
  true
);
```

### 3. Test the Deployment

1. Visit your Netlify URL
2. Try logging in with your admin account
3. Test creating a request
4. Check browser console for any errors
5. Check Render logs for backend errors

---

## 📝 Files You Need to Change

### ✅ Before Deployment

1. **`frontend/assets/js/app.js`** (Line 7)
   - Update API URL to your Render backend URL
   - Change: `https://oando-mrf.onrender.com/api` → `https://your-backend-url.onrender.com/api`

### ✅ After Backend Deployment

2. **Render Environment Variables:**
   - `FRONTEND_URL` - Update with your Netlify URL after frontend deploys

### ✅ Optional (for custom domains)

3. **`backend/server.js`** (Line 49)
   - Update CORS origin if using custom domain

---

## 🐛 Troubleshooting

### Issue: "Failed to fetch" errors in browser

**Solution:**
- Check that `FRONTEND_URL` in Render matches your Netlify URL exactly
- Verify CORS is configured correctly in `backend/server.js`
- Check browser console for specific error messages

### Issue: Database connection errors

**Solution:**
- Verify all database environment variables in Render are correct
- Check that database migrations have been run
- Ensure database is in the same region as your backend service

### Issue: 500 Internal Server Error

**Solution:**
- Check Render logs: Go to your service → "Logs" tab
- Verify all environment variables are set
- Check that `JWT_SECRET` is set (required for authentication)

### Issue: Frontend shows "API Error"

**Solution:**
- Verify `frontend/assets/js/app.js` has correct Render URL
- Check that backend is running (visit Render service URL in browser)
- Verify CORS allows your Netlify domain

### Issue: File uploads not working

**Solution:**
- Render free tier has ephemeral storage (files deleted on restart)
- Consider using cloud storage (AWS S3, Cloudinary) for production
- For temporary hosting, files will persist until service restarts

### Issue: Slow response times

**Solution:**
- Render free tier spins down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds to wake up
- Consider upgrading to paid tier for always-on service

---

## 🔐 Security Checklist

Before going live:

- [ ] Change `JWT_SECRET` to a strong random string (use: `openssl rand -base64 32`)
- [ ] Use strong database passwords
- [ ] Enable HTTPS (automatic on Render & Netlify)
- [ ] Review CORS settings
- [ ] Set up proper error logging
- [ ] Consider adding rate limiting (already configured)

---

## 📊 Monitoring

### Render Logs
- Go to your service → "Logs" tab
- Monitor for errors and performance issues

### Netlify Logs
- Go to your site → "Functions" → "Logs"
- Check for frontend errors

### Database Monitoring
- Render PostgreSQL dashboard shows connection stats
- Monitor database size (free tier: 1GB limit)

---

## 🔄 Updating Your Deployment

### To update backend:
1. Make changes locally
2. Commit and push to GitHub
3. Render auto-deploys on push

### To update frontend:
1. Make changes locally
2. Update `frontend/assets/js/app.js` if API URL changed
3. Commit and push to GitHub
4. Netlify auto-deploys on push

---

## 💰 Free Tier Limits

### Render
- **Web Service:** 750 hours/month (enough for 24/7)
- **PostgreSQL:** 1GB storage, 90-day retention
- **Spins down** after 15 min inactivity (wakes on request)

### Netlify
- **Bandwidth:** 100GB/month
- **Build minutes:** 300/month
- **Always on** (no spin-down)

---

## 📞 Quick Reference

### Your URLs (fill these in after deployment):

- **Backend API:** `https://________________.onrender.com`
- **Frontend:** `https://________________.netlify.app`
- **Database:** `postgresql://________________` (keep secret!)

### Important Files:
- API URL: `frontend/assets/js/app.js` (line 7)
- Backend config: `backend/server.js`
- Environment: Render dashboard → Environment tab

---

## ✅ Deployment Checklist

- [ ] Git repository created and code pushed
- [ ] Render backend service created
- [ ] Render PostgreSQL database created
- [ ] Database migrations run
- [ ] Environment variables set in Render
- [ ] Backend deployed and running
- [ ] API URL updated in `frontend/assets/js/app.js`
- [ ] Frontend deployed to Netlify
- [ ] `FRONTEND_URL` updated in Render
- [ ] Admin user created
- [ ] Test login works
- [ ] Test request creation works
- [ ] CORS errors resolved

---

**🎉 Congratulations! Your MRF system is now live!**

For issues, check the logs in Render and Netlify dashboards.

