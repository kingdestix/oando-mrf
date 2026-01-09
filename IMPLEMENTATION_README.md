# Oando MRF System - Implementation Guide
## Complete Technical Documentation for Application Team

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Installation & Setup](#installation--setup)
5. [Database Configuration](#database-configuration)
6. [Environment Configuration](#environment-configuration)
7. [Security Configuration](#security-configuration)
8. [Deployment Guide](#deployment-guide)
9. [API Documentation](#api-documentation)
10. [Troubleshooting](#troubleshooting)
11. [Maintenance](#maintenance)

---

## System Overview

### What is the Oando MRF System?

The Oando MRF (Material Request Form) System is an enterprise-grade web application that digitizes and automates the entire material procurement workflow from request creation through multi-stage approvals to material delivery and financial reporting.

### Key Capabilities

- **Multi-Stage Approval Workflow**: 9 distinct approval stages with role-based routing
- **Commercial Management**: Separate workflow for contractor quotations and commercial approvals
- **Analytics Dashboard**: Real-time insights, trend analysis, and exportable reports
- **Document Management**: PDF generation, quotation tracking, digital signatures
- **Role-Based Access Control**: 9 user roles with specific permissions and data visibility
- **Audit Trail**: Complete activity logging and approval history tracking

### Technology Stack

- **Backend**: Node.js 16+, Express.js, PostgreSQL 12+
- **Frontend**: Vanilla JavaScript, HTML5, CSS3 (no framework dependencies)
- **Authentication**: JWT (JSON Web Tokens)
- **Security**: Helmet.js, bcrypt, express-rate-limit
- **PDF Generation**: PDFKit
- **Reports**: docx library for Word documents
- **Charts**: Chart.js

---

## Architecture

### Project Structure

```
mrf project/
├── backend/
│   ├── config/
│   │   └── database.js          # Database connection pool
│   ├── controllers/              # Business logic layer
│   │   ├── adminController.js
│   │   ├── analyticsController.js
│   │   ├── approvalController.js
│   │   ├── authController.js
│   │   ├── dodmController.js
│   │   ├── exportController.js
│   │   ├── importController.js
│   │   ├── inventoryController.js
│   │   ├── podReportController.js
│   │   ├── profileController.js
│   │   ├── quotationController.js
│   │   └── requestController.js
│   ├── middleware/
│   │   ├── auth.js              # Authentication & authorization
│   │   └── upload.js            # File upload handling
│   ├── models/                  # SQL migration files
│   │   ├── database.sql         # Base schema
│   │   ├── migration-*.sql      # Workflow migrations
│   │   └── add-*.sql            # Feature additions
│   ├── routes/                  # API route definitions
│   │   ├── admin.js
│   │   ├── analytics.js
│   │   ├── approval.js
│   │   ├── auth.js
│   │   ├── dodm.js
│   │   ├── exports.js
│   │   ├── imports.js
│   │   ├── inventory.js
│   │   ├── pod.js
│   │   ├── profile.js
│   │   ├── quotations.js
│   │   └── requests.js
│   ├── utils/                   # Utility functions
│   │   ├── analyticsExporter.js
│   │   ├── email.js
│   │   ├── fuzzySearch.js
│   │   ├── invoiceGenerator.js
│   │   ├── locationNormalizer.js
│   │   ├── pdfGenerator.js
│   │   ├── requestNumber.js
│   │   └── validation.js
│   ├── uploads/                 # File storage
│   │   ├── attachments/
│   │   ├── exports/
│   │   ├── imports/
│   │   ├── pdfs/
│   │   └── signatures/
│   ├── server.js                # Application entry point
│   └── package.json
├── frontend/
│   ├── *.html                   # Page templates
│   └── assets/
│       ├── css/
│       │   └── styles.css
│       ├── js/
│       │   ├── app.js           # Core application logic
│       │   ├── auth.js
│       │   ├── admin-dashboard.js
│       │   ├── analytics.js
│       │   ├── approval-dashboard.js
│       │   └── [other page scripts]
│       └── images/
└── README.md
```

### Database Schema Overview

**Core Tables:**
- `users` - User accounts with roles and permissions
- `material_requests` - Main request table with workflow tracking
- `material_request_lines` - Line items (one-to-many with requests)
- `approval_history` - Complete audit trail
- `attachments` - File uploads (quotations, signatures, documents)
- `activity_logs` - User activity tracking
- `inventory_*` - Inventory management tables

**Key Relationships:**
- `material_requests.user_id` → `users.id`
- `material_request_lines.request_id` → `material_requests.id`
- `approval_history.request_id` → `material_requests.id`
- `attachments.request_id` → `material_requests.id`

---

## Prerequisites

### Server Requirements

- **Operating System**: Linux (Ubuntu 20.04+), Windows Server, or macOS
- **Node.js**: Version 16.0.0 or higher
- **npm**: Version 7.0.0 or higher (comes with Node.js)
- **PostgreSQL**: Version 12.0 or higher
- **RAM**: Minimum 2GB (4GB recommended)
- **Storage**: 10GB free space (for database and file uploads)
- **Network**: HTTPS recommended for production

### Development Tools (Optional)

- **pgAdmin**: PostgreSQL administration tool
- **Postman**: API testing
- **Git**: Version control

### Browser Requirements (Client)

- Chrome 90+, Firefox 88+, Edge 90+, Safari 14+
- JavaScript enabled
- Modern browser with ES6+ support

---

## Installation & Setup

### Step 1: Clone/Download Project

```bash
# If using Git
git clone [repository-url]
cd "mrf project"

# Or extract downloaded ZIP file
```

### Step 2: Install Backend Dependencies

```bash
cd backend
npm install
```

**Expected Output:**
- All dependencies installed in `backend/node_modules/`
- `package-lock.json` updated

**Key Dependencies:**
- `express` - Web framework
- `pg` - PostgreSQL client
- `jsonwebtoken` - JWT authentication
- `bcrypt` - Password hashing
- `helmet` - Security headers
- `express-rate-limit` - Rate limiting
- `multer` - File uploads
- `pdfkit` - PDF generation
- `docx` - Word document generation

### Step 3: Install Frontend Dependencies (if any)

```bash
cd ../frontend
# Frontend uses CDN resources, no npm install needed
```

### Step 4: Database Setup

#### 4.1 Create PostgreSQL Database

```sql
-- Connect to PostgreSQL as superuser
CREATE DATABASE oando_mrf;
CREATE USER oando_admin WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE oando_mrf TO oando_admin;
```

#### 4.2 Run Migration Files (IN ORDER)

**Critical:** Run migrations in the exact order listed below:

```bash
# Connect to database using psql or pgAdmin
psql -U oando_admin -d oando_mrf -f backend/models/database.sql
psql -U oando_admin -d oando_mrf -f backend/models/migration-approval-workflow.sql
psql -U oando_admin -d oando_mrf -f backend/models/add-signature-columns.sql
psql -U oando_admin -d oando_mrf -f backend/models/migration-commercial-workflow.sql
psql -U oando_admin -d oando_mrf -f backend/models/add-quotation-received-field.sql
psql -U oando_admin -d oando_mrf -f backend/models/add-dodm-role.sql
psql -U oando_admin -d oando_mrf -f backend/models/fix-approval-history-action-size.sql
psql -U oando_admin -d oando_mrf -f backend/models/fix-quotation-field-size.sql
```

**Or using pgAdmin:**
1. Right-click database → Query Tool
2. Open each SQL file
3. Execute in order
4. Verify no errors

**Verification:**
```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;

-- Should see: users, material_requests, material_request_lines, approval_history, etc.
```

### Step 5: Create Initial Admin User

**Option 1: Using Script**
```bash
cd backend
node createAdmin.js
# Follow prompts to create admin user
```

**Option 2: Using SQL**
```sql
-- Hash password first (use bcrypt hash generator or script)
-- Password: Test@2025 (change immediately after first login)
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, is_active)
VALUES ('ADMIN001', 'Admin', 'User', 'admin@oando.com', '$2b$10$[hashed_password]', 'admin', true);
```

**Option 3: Using Signup Page**
1. Start server
2. Navigate to signup page
3. Create admin account

---

## Database Configuration

### Connection Pool Settings

**File:** `backend/config/database.js`

```javascript
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,                    // Maximum connections
  idleTimeoutMillis: 30000,    // Close idle connections after 30s
  connectionTimeoutMillis: 10000 // Connection timeout
});
```

### Database Backup

**Create Backup:**
```bash
pg_dump -U oando_admin -d oando_mrf -F c -f backup_$(date +%Y%m%d).dump
```

**Restore Backup:**
```bash
pg_restore -U oando_admin -d oando_mrf backup_20250106.dump
```

### Database Maintenance

**Regular Tasks:**
- Weekly backups
- Monthly VACUUM ANALYZE
- Monitor connection pool usage
- Check for slow queries

```sql
-- Vacuum and analyze
VACUUM ANALYZE;

-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Environment Configuration

### Create `.env` File

**File:** `backend/.env`

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=oando_mrf
DB_USER=oando_admin
DB_PASSWORD=your_secure_password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars
JWT_EXPIRE=7d

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Email Configuration (Optional - for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@oando.com
```

### Production Environment Variables

**Critical Security Settings:**

```env
NODE_ENV=production
JWT_SECRET=[Generate strong random string, min 32 characters]
DB_PASSWORD=[Strong database password]
FRONTEND_URL=https://your-domain.com
```

**Generate Secure JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Environment-Specific Settings

**Development:**
- `NODE_ENV=development`
- Detailed error messages
- Console logging enabled
- No SSL for database

**Production:**
- `NODE_ENV=production`
- Generic error messages
- Minimal logging
- SSL for database connections
- HTTPS for frontend

---

## Security Configuration

### 1. Authentication & Authorization

**JWT Token Configuration:**
- **Expiration**: 7 days (configurable via `JWT_EXPIRE`)
- **Secret**: Must be strong and unique (min 32 characters)
- **Algorithm**: HS256 (default)

**Password Security:**
- **Hashing**: bcrypt with 10 rounds
- **Minimum Length**: 6 characters (enforced)
- **Storage**: Never stored in plain text

**File:** `backend/controllers/authController.js`
```javascript
const password_hash = await bcrypt.hash(password, 10);
const isValidPassword = await bcrypt.compare(password, user.password_hash);
```

### 2. SQL Injection Prevention

**All queries use parameterized statements:**

```javascript
// ✅ CORRECT - Parameterized
await query('SELECT * FROM users WHERE email = $1', [email]);

// ❌ WRONG - String concatenation (NEVER DO THIS)
await query(`SELECT * FROM users WHERE email = '${email}'`);
```

**All database queries in the codebase use parameterized queries.**

### 3. Input Validation

**Validation Middleware:**
- Email format validation
- Required field checks
- Data type validation
- Length limits

**File:** `backend/utils/validation.js`

### 4. Rate Limiting

**Configuration:** `backend/server.js`

```javascript
// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,  // 1 minute
  max: 100,                  // 100 requests per minute
});

// Analytics gets higher limit
const analyticsLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,                  // 200 requests per minute
});
```

### 5. Security Headers (Helmet.js)

**Configuration:** `backend/server.js`

- Content Security Policy (CSP)
- XSS Protection
- Frame Options
- Content Type Sniffing Prevention

### 6. File Upload Security

**Restrictions:**
- File type validation
- File size limits (configured in multer)
- Secure file storage
- Filename sanitization

**File:** `backend/middleware/upload.js`

### 7. CORS Configuration

**Production Setup:**
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://your-domain.com',
  credentials: true
}));
```

### 8. Environment Variable Security

**Never commit `.env` file to Git:**
- Add to `.gitignore`
- Use different secrets for dev/prod
- Rotate secrets periodically

---

## Deployment Guide

### Option 1: Traditional Server Deployment

#### 1.1 Prepare Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 16+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Verify installations
node --version
npm --version
psql --version
```

#### 1.2 Deploy Application

```bash
# Clone/download project
cd /var/www
git clone [repository-url] oando-mrf
cd oando-mrf

# Install dependencies
cd backend
npm install --production

# Create .env file
nano .env
# [Paste production environment variables]
```

#### 1.3 Setup Database

```bash
# Create database and user
sudo -u postgres psql
CREATE DATABASE oando_mrf;
CREATE USER oando_admin WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE oando_mrf TO oando_admin;
\q

# Run migrations
psql -U oando_admin -d oando_mrf -f backend/models/database.sql
# [Run all migration files in order]
```

#### 1.4 Setup Process Manager (PM2)

```bash
# Install PM2
sudo npm install -g pm2

# Start application
cd backend
pm2 start server.js --name oando-mrf

# Save PM2 configuration
pm2 save
pm2 startup

# Monitor
pm2 logs oando-mrf
pm2 status
```

#### 1.5 Setup Reverse Proxy (Nginx)

**File:** `/etc/nginx/sites-available/oando-mrf`

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/oando-mrf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Option 2: Cloud Platform Deployment (Render, Heroku, etc.)

#### 2.1 Render.com Deployment

1. **Create Account** → Connect GitHub repository
2. **Create Web Service:**
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && node server.js`
   - Environment Variables: Add all from `.env`
3. **Create PostgreSQL Database:**
   - Create new PostgreSQL database
   - Copy connection string
   - Update `DB_HOST`, `DB_USER`, `DB_PASSWORD` in environment variables
4. **Run Migrations:**
   - Use Render shell or local connection
   - Run all migration files

#### 2.2 Environment Variables (Cloud)

Set in platform dashboard:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`
- `NODE_ENV=production`
- `FRONTEND_URL`
- `PORT` (usually auto-set by platform)

### Post-Deployment Checklist

- [ ] Database migrations completed
- [ ] Environment variables configured
- [ ] Admin user created
- [ ] HTTPS configured (production)
- [ ] Firewall rules configured
- [ ] Database backups scheduled
- [ ] Monitoring setup
- [ ] Error logging configured
- [ ] Test login functionality
- [ ] Test request creation
- [ ] Test approval workflow

---

## API Documentation

### Authentication Endpoints

#### POST `/api/auth/login`
**Request:**
```json
{
  "email": "user@oando.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@oando.com",
    "role": "worker",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

#### POST `/api/auth/register`
**Request:**
```json
{
  "user_id": "EMP001",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@oando.com",
  "password": "SecurePass123",
  "role": "worker",
  "designation": "Engineer",
  "location": "Lagos"
}
```

### Request Endpoints

#### GET `/api/requests`
**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `status` - Filter by status
- `location` - Filter by location

**Headers:**
```
Authorization: Bearer <token>
```

#### POST `/api/requests`
**Request:**
```json
{
  "asset": "OB/OB",
  "discipline": "Mechanical",
  "reason_for_request": "Maintenance work",
  "criticality": "High",
  "lines": [
    {
      "material_description": "Valve",
      "quantity": 5,
      "quantity_unit": "pcs",
      "oem_model": "Model XYZ"
    }
  ]
}
```

### Approval Endpoints

#### GET `/api/approval/pending`
Get pending approvals for current user's role.

#### POST `/api/approval/:id/approve`
**Request:**
```json
{
  "comments": "Approved",
  "signature": "base64_encoded_image" // Optional
}
```

#### POST `/api/approval/:id/reject`
**Request:**
```json
{
  "comments": "Rejected - insufficient information",
  "reason": "Missing specifications"
}
```

### Analytics Endpoints

#### GET `/api/analytics/summary`
**Query Parameters:**
- `from` - Start date (YYYY-MM-DD)
- `to` - End date (YYYY-MM-DD)
- `location` - Filter by location
- `discipline` - Filter by discipline

#### GET `/api/analytics/top-materials`
**Query Parameters:**
- `limit` - Number of results (default: 10)
- `from`, `to` - Date range
- `location`, `discipline` - Filters

**Full API documentation available in code comments.**

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Error

**Error:** `Connection refused` or `timeout`

**Solutions:**
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Verify connection details in `.env`
- Check firewall rules
- Verify database exists: `psql -U oando_admin -d oando_mrf -c "SELECT 1"`

#### 2. JWT Token Expired

**Error:** `Token expired`

**Solutions:**
- User needs to login again
- Check `JWT_EXPIRE` setting
- Verify `JWT_SECRET` hasn't changed

#### 3. 500 Internal Server Error

**Check:**
- Server logs: `pm2 logs oando-mrf` or console output
- Database logs
- Verify all migrations completed
- Check file permissions on `uploads/` directory

#### 4. Rate Limit Error (429)

**Error:** `Too many requests`

**Solutions:**
- Wait 1 minute
- Increase limits in `server.js` if needed
- Check for client-side infinite loops

#### 5. File Upload Fails

**Check:**
- `uploads/` directory exists and is writable
- File size limits
- File type restrictions
- Disk space available

#### 6. PDF Generation Fails

**Check:**
- PDFKit dependencies installed
- Font files available (if using custom fonts)
- Sufficient memory
- Check server logs for specific error

### Debug Mode

**Enable detailed logging:**
```javascript
// In server.js, set:
process.env.NODE_ENV = 'development';
```

**Check logs:**
```bash
# PM2 logs
pm2 logs oando-mrf

# Or console output if running directly
node backend/server.js
```

---

## Maintenance

### Regular Tasks

#### Daily
- Monitor error logs
- Check system uptime
- Verify backups completed

#### Weekly
- Review user activity logs
- Check database size
- Review performance metrics
- Test backup restoration

#### Monthly
- Database VACUUM ANALYZE
- Security updates
- Review and rotate secrets
- Performance optimization
- User access review

### Backup Strategy

**Database Backups:**
```bash
# Daily automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d)
pg_dump -U oando_admin -d oando_mrf -F c -f /backups/oando_mrf_$DATE.dump
# Keep last 30 days
find /backups -name "oando_mrf_*.dump" -mtime +30 -delete
```

**File Backups:**
```bash
# Backup uploads directory
tar -czf /backups/uploads_$(date +%Y%m%d).tar.gz backend/uploads/
```

### Performance Optimization

**Database:**
- Regular VACUUM ANALYZE
- Index optimization
- Query performance monitoring
- Connection pool tuning

**Application:**
- Monitor memory usage
- Review slow endpoints
- Optimize queries
- Cache frequently accessed data

### Security Updates

**Regular Updates:**
- Node.js and npm packages: `npm audit` and `npm update`
- PostgreSQL updates
- Security patches
- Dependency vulnerability scanning

**Run Security Audit:**
```bash
cd backend
npm audit
npm audit fix
```

---

## Support & Contact

**For Implementation Issues:**
1. Check this documentation
2. Review error logs
3. Check database connectivity
4. Verify environment configuration

**For User Support:**
- Refer to USER_GUIDE.md
- Contact system administrator
- Check activity logs

---

**Version:** 1.0.0  
**Last Updated:** January 2025  
**Maintained By:** [Your Team Name]

