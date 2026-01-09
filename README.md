# Oando MRF System - Material Request Form Management

Enterprise-grade Material Request Form (MRF) management system for Oando Energy. Complete workflow from request creation through multi-stage approvals to material delivery and financial reporting.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- PostgreSQL 12+
- pgAdmin (for database management)

### Installation

1. **Clone/Download the project**
```bash
cd "mrf project"
```

2. **Install Dependencies**
```bash
npm install
cd backend
npm install
```

3. **Database Setup**
   - Open pgAdmin
   - Create a new database: `oando_mrf`
   - Run SQL files in this order:
     1. `backend/models/database.sql` (base schema)
     2. `backend/models/migration-approval-workflow.sql` (workflow system)
     3. `backend/models/add-signature-columns.sql` (signature support)
     4. `backend/models/migration-commercial-workflow.sql` (commercial workflow)
     5. `backend/models/add-quotation-received-field.sql` (quotation tracking)
     6. `backend/models/add-dodm-role.sql` (DODM role support)
     7. `backend/models/fix-approval-history-action-size.sql` (fix action field)
     8. `backend/models/fix-quotation-field-size.sql` (fix field sizes)

4. **Configure Environment**
   - Create `backend/.env`:
   ```env
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=oando_mrf
   DB_USER=postgres
   DB_PASSWORD=your_password
   JWT_SECRET=your-secret-key-change-in-production
   PORT=5000
   ```

5. **Start Server**
```bash
cd backend
node server.js
```

6. **Access Application**
   - Open browser: `http://localhost:5000`
   - Default admin: Check `backend/createAdmin.js` or create via signup

---

## 📋 System Architecture

### Technology Stack
- **Backend:** Node.js, Express.js, PostgreSQL
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **PDF Generation:** PDFKit
- **Word Reports:** docx library
- **File Uploads:** Multer
- **Authentication:** JWT

### Project Structure
```
mrf project/
├── backend/
│   ├── controllers/     # Business logic
│   ├── routes/          # API endpoints
│   ├── models/          # SQL migrations
│   ├── utils/           # Utilities (PDF, email, etc.)
│   ├── middleware/      # Auth, upload handlers
│   └── server.js        # Entry point
├── frontend/
│   ├── *.html          # Page templates
│   └── assets/
│       ├── css/        # Stylesheets
│       ├── js/         # Client-side logic
│       └── images/     # Logos, assets
└── README.md           # This file
```

---

## 🔄 Complete Workflow

### Stage Flow
1. **REQUESTOR_SUBMITTED** → Worker creates MRF
2. **TECHNICAL_COORDINATOR_REVIEW** → Tech Coordinator approves
3. **ASSISTANT_MANAGER_REVIEW** → Assistant Manager approves
4. **AREA_MANAGER_REVIEW** → Area Manager (Land/Swamp/PHC) approves
5. **POD_PLANNER_REVIEW** → POD routes to discipline
6. **DISCIPLINE_UNIT_REVIEW** → DU reviews
7. **DISCIPLINE_MANAGER_APPROVAL** → DM approves → **Moves to COMMERCIAL_REVIEW**
8. **COMMERCIAL_REVIEW** → DU workflow:
   - Downloads MRF PDF
   - Sends to contractor
   - Marks "MRF sent"
   - Marks "Quotation received"
   - Fills commercial details
   - Uploads quotation PDF
   - Submits to DODM
9. **COMMERCIAL_APPROVED** → DODM approves commercial
10. **MATERIAL_DELIVERY** → Materials in transit
11. **MATERIAL_RECEIVED** → Requestor confirms receipt
12. **CLOSED** → MRF completed

---

## 👥 User Roles & Permissions

| Role | Can Approve | Can View Commercial | Dashboard |
|------|------------|-------------------|-----------|
| **worker** (Requestor) | No | No | Worker Dashboard |
| **technical_coordinator** | Tech Coord Stage | No | Approval Dashboard |
| **assistant_manager** | Asst Mgr Stage | No | Approval Dashboard |
| **area_manager_*** | Area Manager Stage | No | Approval Dashboard |
| **pod_planner** | POD Stage | Yes | Approval Dashboard + Analytics |
| **discipline_unit** | DU Stage | Yes | Approval Dashboard (Commercial) |
| **discipline_manager** | DM Stage | Yes | Approval Dashboard |
| **dodm** | Commercial Stage | Yes | Approval Dashboard + Stats |
| **admin** | All | Yes | Admin Dashboard |

---

## 🗄️ Database Schema

### Core Tables

**material_requests** - Main request table
- Key fields: `mrf_number`, `workflow_stage`, `quotation_reference` (VARCHAR(500)), `quotation_amount_usd/eur/ngn`, `contractor_name`, `commercial_approved_by`, `commercial_approved_date`
- Workflow tracking: `approved_by_technical_coordinator`, `approved_by_discipline_manager`, etc.
- Signature paths: `technical_coordinator_signature`, `discipline_manager_signature`, etc.

**material_request_lines** - Line items (one-to-many)
- Fields: `material_description`, `quantity`, `unit_price_usd/eur/ngn`, `total_price_usd/ngn`

**users** - User accounts
- Roles: worker, technical_coordinator, assistant_manager, area_manager_land/swamp/phc, pod_planner, discipline_unit, discipline_manager, dodm, admin
- Constraints: `users_role_check` includes all roles

**approval_history** - Audit trail
- Tracks all approval/rejection actions with timestamps

**attachments** - File uploads
- Stores quotation PDFs, signatures, documents

### Migration Files (Run in Order)
1. `database.sql` - Base schema
2. `migration-approval-workflow.sql` - Workflow system
3. `add-signature-columns.sql` - Signature support
4. `migration-commercial-workflow.sql` - Commercial workflow
5. `add-quotation-received-field.sql` - Quotation tracking
6. `add-dodm-role.sql` - DODM role
7. `fix-quotation-field-size.sql` - Field size fixes

---

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get current user

### Requests
- `GET /api/requests` - List requests (filtered by role)
- `POST /api/requests` - Create new request
- `GET /api/requests/:id` - Get request details
- `PUT /api/requests/:id` - Update request
- `GET /api/requests/:id/pdf` - Download MRF PDF

### Approval Workflow
- `GET /api/approval/pending` - Get pending approvals
- `POST /api/approval/:id/approve` - Approve request
- `POST /api/approval/:id/reject` - Reject request
- `GET /api/approval/:id/history` - Get approval history

### Commercial Workflow (DU)
- `POST /api/approval/:id/mark-sent-to-contractor` - Mark MRF sent
- `POST /api/approval/:id/mark-quotation-received` - Mark quotation received
- `POST /api/approval/:id/submit-contractor-quotation` - Submit commercial details

### DODM
- `GET /api/dodm/stats` - Get DODM statistics
- `GET /api/dodm/approved` - Get approved requests (for tracking)
- `POST /api/approval/:id/approve-commercial` - Approve commercial

### POD Reports
- `GET /api/pod/report?period=weekly|monthly&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - Generate Word report

---

## 🐛 Common Issues & Fixes

### "quotation_reference too long for VARCHAR"
**Fix:** Run `backend/models/fix-quotation-field-size.sql` to increase field size to VARCHAR(500)

### "DODM cannot login"
**Fix:** 
1. Run `backend/models/add-dodm-role.sql` to add role to constraint
2. Run `backend/scripts/create-dodm-user.sql` to create DODM user
3. Login: `dodm@oando.com` / `Test@2025`

### "429 Too Many Requests"
**Fix:** Rate limiting is configured. Wait 1 minute or increase limits in `backend/server.js`

### "Cannot access whereClause before initialization"
**Fix:** Already fixed in latest code - ensure you have latest `approvalController.js`

---

## 📊 Key Features

- ✅ Multi-stage approval workflow
- ✅ Role-based access control
- ✅ PDF generation with signatures
- ✅ Commercial details management
- ✅ Quotation tracking
- ✅ Material delivery confirmation
- ✅ Financial reporting (POD)
- ✅ Analytics dashboard (POD only)
- ✅ Excel import/export
- ✅ Audit trail (approval history)

---

## 📝 Development Notes

### Adding New Roles
1. Add role to `users_role_check` constraint in database
2. Add role to `ROLE_STAGE_MAP` in `approvalController.js`
3. Add role to `canViewCommercialDetails()` check
4. Update frontend role checks

### Database Migrations
- Always test migrations on a copy first
- Run migrations in order (see list above)
- Backup database before major migrations

### PDF Generation
- Commercial section hidden from field workers
- Signatures displayed with approver names
- "Approved" text inside signature boxes

---

## 🔐 Security

- JWT authentication on all API routes
- Password hashing with bcrypt (10 rounds)
- Role-based access control
- File upload validation
- SQL injection prevention (parameterized queries)
- Rate limiting on API endpoints

---

## 🚀 Deployment

For deploying to production (Render + Netlify), see:
- **`DEPLOYMENT.md`** - Complete step-by-step deployment guide
- **`QUICK_DEPLOY.md`** - Quick reference checklist

### Quick Start Deployment:
1. Update `frontend/assets/js/app.js` (line 7) with your Render backend URL
2. Follow `DEPLOYMENT.md` for detailed instructions

---

## 📞 Support

For issues or questions:
1. Check `USER_GUIDE.md` for user instructions
2. Review database schema in `DATABASE_SCHEMA_SUMMARY.md`
3. Check server logs for error details
4. Verify database migrations are applied

---

**Version:** 1.0.0  
**Last Updated:** December 2025

