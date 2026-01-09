# Database Schema Summary for Oando MRF System

## MATERIAL_REQUESTS TABLE (Complete Definition)

```sql
CREATE TABLE material_requests (
    id SERIAL PRIMARY KEY,
    
    -- Request Identification
    mrf_number VARCHAR(50) UNIQUE NOT NULL,
    request_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM request_date)::INTEGER) STORED,
    
    -- Requestor Information
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    user_code VARCHAR(50) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    office_extension VARCHAR(50),
    asset VARCHAR(100) NOT NULL, -- Location/Asset
    department VARCHAR(100),
    
    -- Request Details
    unit_tag VARCHAR(100),
    discipline VARCHAR(100) NOT NULL, -- Material Group
    material_category VARCHAR(100),
    criticality VARCHAR(20) CHECK (criticality IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    work_order_no VARCHAR(100),
    work_order_type VARCHAR(100),
    reason TEXT NOT NULL,
    service_material VARCHAR(50) DEFAULT 'Material',
    
    -- Internal Tracking
    internal_reference VARCHAR(200), -- Staff following up within department
    follow_up_by VARCHAR(200), -- Same as internal reference
    status VARCHAR(30) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Ordered', 'Delivered', 'Completed', 'Cancelled')),
    status_notes TEXT,
    action_pending TEXT,
    
    -- Vendor/Procurement
    vendor_name VARCHAR(200), -- Contractor who submitted quotation
    contractor_name VARCHAR(200), -- Same as vendor
    blanket_order_number VARCHAR(100),
    call_off_number VARCHAR(100),
    purchase_order_no VARCHAR(100),
    
    -- Quotation
    quotation_status VARCHAR(30) DEFAULT 'Not Submitted' CHECK (
        quotation_status IN ('Not Submitted', 'Pending', 'Approved', 'Rejected')
    ),
    quotation_reference VARCHAR(100),
    quotation_approval_date DATE,
    quotation_amount_usd DECIMAL(15,2),
    quotation_amount_eur DECIMAL(15,2),
    quotation_amount_ngn DECIMAL(15,2),
    
    -- Delivery
    estimated_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Approval Workflow
    issued_by VARCHAR(100),
    issued_date TIMESTAMP,
    checked_by VARCHAR(100),
    checked_date TIMESTAMP,
    approved_by VARCHAR(100), -- Manager who approved
    approved_date TIMESTAMP,
    manager_name VARCHAR(100), -- Same as approved_by
    
    -- Notes
    notes TEXT,
    remarks TEXT,
    other TEXT,
    
    -- System
    import_batch_id VARCHAR(50),
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**NOTE:** This is the BASE table. Additional columns are added via migrations:
- `workflow_stage` (from migration-approval-workflow.sql)
- `quotation_received` (from add-quotation-received-field.sql)
- Signature columns (from add-signature-columns.sql)
- Commercial workflow columns (from migration-commercial-workflow.sql)
- Approval tracking columns (from migration-approval-workflow.sql)

---

## OTHER DATABASE TABLES (Summary)

### 1. **users**
- User accounts with authentication
- Fields: id, user_id, first_name, last_name, email, password_hash, role, designation, office_extension, location, department, is_active
- Roles: worker, manager, admin, technical_coordinator, assistant_manager, area_manager_*, pod_planner, discipline_unit, discipline_manager, dodm

### 2. **material_request_lines**
- Line items for each material request (one-to-many with material_requests)
- Fields: id, request_id (FK), line_no, material_description, oem_model, part_number, quantity, quantity_unit, received_quantity, certification_required, expected_delivery_date, actual_delivery_date, unit_price_usd/eur/ngn, total_price_usd/ngn, line_notes
- Unique constraint: (request_id, line_no)

### 3. **sites**
- Lookup table for site locations
- Fields: id, site_name, is_active

### 4. **disciplines**
- Lookup table for material disciplines/groups
- Fields: id, group_name, is_active

### 5. **material_categories**
- Lookup table for material categories
- Fields: id, category_name, is_active

### 6. **attachments**
- File attachments linked to requests
- Fields: id, request_id (FK), file_name, file_path, file_type, file_size, uploaded_by (FK to users), uploaded_at, category, status, notes

### 7. **import_jobs**
- Tracks bulk import operations
- Fields: id, file_name, file_path, status, total_records, successful_records, failed_records, error_log, imported_by (FK), imported_at

### 8. **activity_logs**
- Audit trail of system activities
- Fields: id, user_id (FK), action, entity_type, entity_id, details, ip_address, user_agent, created_at

### 9. **approval_history** (from migration-approval-workflow.sql)
- Audit trail of all approval/rejection actions
- Fields: id, request_id (FK), stage, action_type (APPROVED/REJECTED), user_id (FK), comments, signature_path, created_at

### 10. **commercial_view_log** (from migration-commercial-workflow.sql)
- Tracks who viewed commercial information
- Fields: id, request_id (FK), viewed_by (FK), viewed_at, role

---

## MIGRATION FILES TO RUN (In Order)

1. **database.sql** - Base schema (all tables above)
2. **migration-approval-workflow.sql** - Adds workflow_stage, approval tracking columns, approval_history table
3. **add-signature-columns.sql** - Adds signature file path columns for each approver
4. **migration-commercial-workflow.sql** - Adds commercial workflow columns, commercial_view_log table
5. **add-quotation-received-field.sql** - Adds quotation_received boolean flag

---

## KEY RELATIONSHIPS

- `material_requests.user_id` → `users.id` (Requestor)
- `material_requests.created_by` → `users.id` (Creator)
- `material_request_lines.request_id` → `material_requests.id` (Line items)
- `attachments.request_id` → `material_requests.id` (Files)
- `approval_history.request_id` → `material_requests.id` (Audit trail)
- `approval_history.user_id` → `users.id` (Approver)

---

## IMPORTANT NOTES

- `material_requests.workflow_stage` tracks current approval stage (added via migration)
- `material_requests.quotation_received` boolean flag (added via migration) - DU must check this before commercial form appears
- Signature columns store file paths (e.g., "uploads/signatures/filename.png")
- Approval tracking uses both old columns (approved_by, approved_date) and new columns (approved_by_discipline_manager, approved_date_discipline_manager, etc.)
- All timestamps use TIMESTAMP type with CURRENT_TIMESTAMP defaults

