# 🚀 Deployment Quick Reference

## What Was Done

I've set up your project for deployment to **Render (backend)** and **Netlify (frontend)**. Here's what was created:

### ✅ Files Created

1. **`render.yaml`** - Backend deployment config for Render
   - Tells Render how to build and run your backend
   - Configures PostgreSQL database
   - Sets up environment variables

2. **`netlify.toml`** - Frontend deployment config for Netlify
   - Tells Netlify to serve files from `frontend/` directory
   - Sets up security headers and caching

3. **`DEPLOYMENT_SETUP.md`** - Complete deployment guide
   - Step-by-step instructions
   - Troubleshooting tips
   - Environment variables reference

### ✅ Already Configured

- **Frontend API URL:** Already set to `https://oando-mrf.onrender.com/api` in `frontend/assets/js/app.js`
- **Backend CORS:** Configured to accept requests from `https://oando-mrf.netlify.app`

---

## 🎯 Next Steps (What You Need to Do)

### 1. Push to GitHub
```bash
git add .
git commit -m "Add deployment configuration"
git push origin main
```

### 2. Deploy Backend (Render)
1. Go to https://dashboard.render.com
2. Click "New +" → "Blueprint" (or "Web Service")
3. Connect GitHub repo
4. Render will auto-detect `render.yaml` OR manually configure:
   - Build: `cd backend && npm install`
   - Start: `cd backend && npm start`
5. Create PostgreSQL database in Render
6. Add environment variables (see DEPLOYMENT_SETUP.md)
7. Run database migrations
8. Wait for deployment

### 3. Deploy Frontend (Netlify)
1. Go to https://app.netlify.com
2. Click "Add new site" → "Import from Git"
3. Connect GitHub repo
4. Configure:
   - Base directory: `frontend`
   - Build command: (leave empty)
   - Publish directory: `frontend`
5. Click "Deploy"
6. Wait for deployment

### 4. Update Backend CORS (if needed)
- In Render dashboard, update `FRONTEND_URL` to your Netlify URL
- Backend will auto-redeploy

---

## 📋 Environment Variables Needed in Render

After creating the database, add these in Render dashboard:

```
NODE_ENV=production
PORT=10000
DB_HOST=<from database>
DB_PORT=5432
DB_NAME=oando_mrf
DB_USER=<from database>
DB_PASSWORD=<from database>
JWT_SECRET=<generate: openssl rand -base64 32>
FRONTEND_URL=https://oando-mrf.netlify.app
```

---

## 🔗 Your URLs

- **Backend:** https://oando-mrf.onrender.com
- **Frontend:** https://oando-mrf.netlify.app

Both are already configured in the code! ✅

---

## 📖 Full Instructions

See **`DEPLOYMENT_SETUP.md`** for complete step-by-step guide with troubleshooting.

---

**That's it! Your project is ready to deploy.** 🎉

