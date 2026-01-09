# Database Files Explained

This document explains all SQL migration files in `backend/models/` to help with debugging.

---

## 📁 Core Schema Files

### `database.sql`
**Purpose:** Base database schema - creates all core tables
**When to run:** First, before any other migrations
**Creates:**
- `users` table (user accounts)
- `material_requests` table (main request table)
- `material_request_lines` table (line items)
- `sites`, `disciplines`, `material_categories` (lookup tables)
- `attachments` table (file uploads)
- `import_jobs` table (bulk import tracking)
- `activity_logs` table (audit trail)

**Key Fields:**
- `quotation_reference VARCHAR(100)` - ⚠️ Too small! Run `fix-quotation-field-size.sql` after

---

## 🔄 Workflow Migration Files

### `migration-approval-workflow.sql`
**Purpose:** Adds multi-stage approval workflow system
**When to run:** After `database.sql`
**Adds:**
- `workflow_stage VARCHAR(50)` column to `material_requests`
- Approval tracking columns: `approved_by_technical_coordinator`, `approved_by_assistant_manager`, etc.
- Approval date columns: `approved_date_technical_coordinator`, etc.
- `approval_history` table (audit trail)
- `location_workflow_rules` table (custom workflows per location)

**Workflow Stages:**
- REQUESTOR_SUBMITTED → TECHNICAL_COORDINATOR_REVIEW → ASSISTANT_MANAGER_REVIEW → AREA_MANAGER_REVIEW → POD_PLANNER_REVIEW → DISCIPLINE_UNIT_REVIEW → DISCIPLINE_MANAGER_APPROVAL → COMMERCIAL_REVIEW → COMMERCIAL_APPROVED → MATERIAL_DELIVERY → MATERIAL_RECEIVED → CLOSED

---

### `migration-commercial-workflow.sql`
**Purpose:** Adds commercial workflow (quotation, DODM approval)
**When to run:** After `migration-approval-workflow.sql`
**Adds:**
- Commercial status columns: `commercial_status`, `commercial_approved_by`, `commercial_approved_date`
- Commercial fields: `contractor_name`, `contractor_quotation_date`, `mrf_sent_to_contractor_date`
- `commercial_view_log` table (tracks who viewed commercial details)

---

### `add-signature-columns.sql`
**Purpose:** Adds signature file path columns for each approver
**When to run:** After `migration-approval-workflow.sql`
**Adds:**
- `technical_coordinator_signature VARCHAR(500)`
- `assistant_manager_signature VARCHAR(500)`
- `area_manager_signature VARCHAR(500)`
- `pod_planner_signature VARCHAR(500)`
- `discipline_unit_signature VARCHAR(500)`
- `discipline_manager_signature VARCHAR(500)`
- `dodm_signature VARCHAR(500)`

**Note:** Stores file paths like `uploads/signatures/filename.png`

---

### `add-quotation-received-field.sql`
**Purpose:** Adds boolean flag to track if DU has received quotation
**When to run:** After `migration-commercial-workflow.sql`
**Adds:**
- `quotation_received BOOLEAN DEFAULT FALSE`

**Usage:** DU checks this before commercial details form appears

---

## 🔧 Fix Files

### `fix-quotation-field-size.sql`
**Purpose:** Increases field sizes that are too small
**When to run:** After all other migrations
**Fixes:**
- `quotation_reference VARCHAR(100)` → `VARCHAR(500)`
- `vendor_name VARCHAR(200)` → `VARCHAR(500)`
- `contractor_name VARCHAR(200)` → `VARCHAR(500)`
- `internal_reference VARCHAR(200)` → `TEXT`
- `blanket_order_number VARCHAR(100)` → `VARCHAR(200)`
- `call_off_number VARCHAR(100)` → `VARCHAR(200)`

**Why needed:** Quotation references can be long (e.g., "QUOTE-2025-001234-ABC-COMPANY-LONG-REFERENCE")

**Important:** This script drops and recreates the `v_request_analytics` view because it depends on `vendor_name`. The view is automatically recreated after column alterations.

---

### `fix-approval-history-action-size.sql`
**Purpose:** Increases `action` field size in `approval_history` table
**When to run:** After `migration-approval-workflow.sql`
**Fixes:**
- `approval_history.action VARCHAR(20)` → `VARCHAR(50)`

**Why needed:** Action values like "COMMERCIAL_DETAILS_SUBMITTED" (28 chars) exceed VARCHAR(20) limit

**Error if not run:** "value too long for type character varying(20)" when submitting commercial details

---

### `add-dodm-role.sql`
**Purpose:** Adds 'dodm' role to users table constraint
**When to run:** Before creating DODM user
**Fixes:**
- Drops old `users_role_check` constraint
- Adds new constraint including: 'dodm', 'maintenance_manager', 'assistant_discipline_manager'

**Why needed:** Without this, creating DODM user fails with "violates check constraint"

---

## 📊 Data Migration Files

### `migrate-completed-to-commercial-review.sql`
**Purpose:** Fixes requests incorrectly marked as COMPLETED
**When to run:** One-time fix for existing data
**Updates:**
- Changes `workflow_stage` from 'COMPLETED' to 'COMMERCIAL_REVIEW'
- Only for requests approved by DM but missing commercial details

**Why needed:** Old workflow incorrectly set stage to COMPLETED after DM approval

---

## 👤 User Creation Scripts

### `backend/scripts/create-dodm-user.sql`
**Purpose:** Creates DODM user account
**When to run:** After `add-dodm-role.sql`
**Creates:**
- User: DODM001
- Email: dodm@oando.com
- Password: Test@2025 (hash: `$2b$10$T29dxgmbx3yBnZPz0HTMwuTpE7qIzJOJMObT5I8lFkI.U7.SHOC.W`)
- Role: dodm

**Note:** Change email and password after first login!

---

## 🗂️ Other Files

### `database-migration.sql`
**Purpose:** Excel import compatibility (adds comments, fixes constraints)
**When to run:** If importing from Excel
**Fixes:**
- Adds column comments matching Excel headers
- Relaxes status constraints for Excel flexibility

---

### `inventory-schema.sql`
**Purpose:** Inventory management tables (if using inventory features)
**When to run:** Optional, only if using inventory module
**Creates:**
- Inventory stock tables
- Warehouse receipt/disbursement tables

---

## ⚠️ Common Errors & Solutions

### Error: "quotation_reference too long for VARCHAR(100)"
**Solution:** Run `fix-quotation-field-size.sql`

### Error: "violates check constraint users_role_check" when creating DODM
**Solution:** Run `add-dodm-role.sql` first

### Error: "column workflow_stage does not exist"
**Solution:** Run `migration-approval-workflow.sql`

### Error: "column quotation_received does not exist"
**Solution:** Run `add-quotation-received-field.sql`

### Error: "column commercial_approved_by does not exist"
**Solution:** Run `migration-commercial-workflow.sql`

---

## 📋 Migration Order (Complete)

Run these SQL files in pgAdmin in this exact order:

1. `database.sql` - Base schema
2. `migration-approval-workflow.sql` - Workflow system
3. `add-signature-columns.sql` - Signature support
4. `migration-commercial-workflow.sql` - Commercial workflow
5. `add-quotation-received-field.sql` - Quotation tracking
6. `add-dodm-role.sql` - DODM role support
7. `fix-approval-history-action-size.sql` - Fix action field size
8. `fix-quotation-field-size.sql` - Field size fixes
9. `migrate-completed-to-commercial-review.sql` - Data fix (one-time)

**Optional:**
- `inventory-schema.sql` - If using inventory
- `database-migration.sql` - If importing from Excel

---

## 🔍 Debugging Database Issues

### Check if column exists:
```sql
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'material_requests' 
AND column_name = 'quotation_reference';
```

### Check constraint:
```sql
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'users_role_check';
```

### Check workflow stages:
```sql
SELECT workflow_stage, COUNT(*) 
FROM material_requests 
GROUP BY workflow_stage;
```

### Check DODM user:
```sql
SELECT id, user_id, email, role, is_active 
FROM users 
WHERE role = 'dodm';
```

---

**Last Updated:** December 2025

