# ⚡ Quick Deployment Checklist

## 🎯 Files to Change (Only 1 file!)

### 1. `frontend/assets/js/app.js` - Line 7

**BEFORE:**
```javascript
: 'https://oando-mrf.onrender.com/api'; // ← PASTE YOUR RENDER URL HERE
```

**AFTER (Update with your Render URL):**
```javascript
: 'https://your-backend-name.onrender.com/api';
```

**Example:**
```javascript
: 'https://oando-mrf-backend.onrender.com/api';
```

---

## 📋 Deployment Steps Summary

### 1. Git Commit
```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Render (Backend)
- Create Web Service
- Root Directory: (leave empty)
- Build: `cd backend && npm install`
- Start: `cd backend && npm start`
- Add environment variables (see DEPLOYMENT.md)
- Create PostgreSQL database
- Run migrations

### 3. Netlify (Frontend)
- Connect GitHub repo
- Base directory: `frontend`
- Build command: (leave empty)
- Publish directory: `frontend`
- Deploy!

### 4. Update Backend
- Set `FRONTEND_URL` in Render to your Netlify URL

---

## 🔑 Environment Variables for Render

```
NODE_ENV=production
PORT=10000
DB_HOST=<from-render-postgres>
DB_PORT=5432
DB_NAME=oando_mrf
DB_USER=<from-render-postgres>
DB_PASSWORD=<from-render-postgres>
JWT_SECRET=<generate-strong-random-string>
FRONTEND_URL=<your-netlify-url>
```

---

## 📍 Where to Find Your URLs

**Render Backend URL:**
- Render Dashboard → Your Service → Copy URL from top

**Netlify Frontend URL:**
- Netlify Dashboard → Your Site → Copy URL from top

**Database Connection:**
- Render Dashboard → Your Database → "Connect" tab → Copy connection string

---

**Full guide:** See `DEPLOYMENT.md` for detailed instructions.

