# 🔒 Security Setup Guide

## 1. Change Database Password in pgAdmin4

### Step-by-Step Instructions:

1. **Open pgAdmin4**
2. **Connect to your PostgreSQL server**
3. **Right-click on your PostgreSQL server** → **Properties**
4. Go to the **Connection** tab
5. **Change the password** in the password field
6. Click **Save**

### OR Change Password via SQL:

1. In pgAdmin4, open **Query Tool** (Tools → Query Tool)
2. Run this SQL command (replace `new_secure_password` with your new password):
```sql
ALTER USER postgres WITH PASSWORD 'new_secure_password';
```
3. Click **Execute** (F5)

### Update Your .env File:

After changing the password, update `backend/.env`:
```env
DB_PASSWORD=your_new_secure_password_here
```

---

## 2. Generate and Set JWT Secret

### Your New JWT Secret:
```
bc4fdff07e9f2d99cdd9d6deabd33601504d8d4bfdd940c59d04d8b8149e801acfb59e5b47a9c73db228fc9e3efbbea678b2455916a2a13ad706213dd896e732
```

### Update Your .env File:
```env
JWT_SECRET=bc4fdff07e9f2d99cdd9d6deabd33601504d8d4bfdd940c59d04d8b8149e801acfb59e5b47a9c73db228fc9e3efbbea678b2455916a2a13ad706213dd896e732
```

---

## 3. Change Email Password (Gmail)

Since your email password was exposed, you need to:

1. **Go to Gmail** → **Manage your Google Account**
2. **Security** → **2-Step Verification** (enable if not already)
3. **App Passwords** → **Generate new app password**
4. Use the generated app password in your `.env`:
```env
SMTP_PASS=your_new_app_password_here
```

**Note:** The old password `qmktowksyzqizgpy` is compromised - change it immediately!

---

## 4. Complete .env Template

Here's your complete secure `.env` file template:

```env
PORT=5000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=5432
DB_NAME=oando_mrf
DB_USER=postgres
DB_PASSWORD=YOUR_NEW_DB_PASSWORD_HERE

JWT_SECRET=bc4fdff07e9f2d99cdd9d6deabd33601504d8d4bfdd940c59d04d8b8149e801acfb59e5b47a9c73db228fc9e3efbbea678b2455916a2a13ad706213dd896e732
JWT_EXPIRE=7d

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=kingdestix@gmail.com
SMTP_PASS=YOUR_NEW_GMAIL_APP_PASSWORD_HERE
EMAIL_FROM="Procurement Oando <kingdestix@gmail.com>"

CORS_ORIGIN=http://localhost:5000
```

---

## ⚠️ IMPORTANT: Update All Environments

After changing passwords, update:
- ✅ Local development environment
- ✅ Staging environment (if you have one)
- ✅ Production environment (Render, Netlify, etc.)

---

## 🔐 Security Best Practices

1. **Never commit `.env` files** to git (already fixed ✅)
2. **Use different passwords** for development and production
3. **Rotate secrets regularly** (every 90 days)
4. **Use strong passwords** (minimum 16 characters, mix of letters, numbers, symbols)
5. **Enable 2FA** on all accounts (Gmail, database, etc.)

