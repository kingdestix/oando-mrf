-- migration-approval-workflow.sql
-- Run this in pgAdmin to add approval workflow

-- ===================================
-- 1. ADD WORKFLOW COLUMNS
-- ===================================
ALTER TABLE material_requests 
ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR(50) DEFAULT 'MRF_CREATED',
ADD COLUMN IF NOT EXISTS has_blanket_order BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS blanket_order_ref VARCHAR(200),
ADD COLUMN IF NOT EXISTS proforma_invoice_ref VARCHAR(200),
ADD COLUMN IF NOT EXISTS proforma_amount_usd DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS proforma_amount_ngn DECIMAL(15,2),
ADD COLUMN IF NOT EXISTS proforma_submitted_date DATE,
ADD COLUMN IF NOT EXISTS compliance_status VARCHAR(20) DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS compliance_notes TEXT,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejection_stage VARCHAR(50),
ADD COLUMN IF NOT EXISTS rescheduled_date DATE,
ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;

-- ===================================
-- 2. ADD APPROVAL TRACKING COLUMNS
-- ===================================
ALTER TABLE material_requests
ADD COLUMN IF NOT EXISTS approved_by_supervisor VARCHAR(100),
ADD COLUMN IF NOT EXISTS approved_by_manager VARCHAR(100),
ADD COLUMN IF NOT EXISTS approved_by_area_manager VARCHAR(100),
ADD COLUMN IF NOT EXISTS approved_date_supervisor TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_date_manager TIMESTAMP,
ADD COLUMN IF NOT EXISTS approved_date_area_manager TIMESTAMP,
ADD COLUMN IF NOT EXISTS supervisor_comments TEXT,
ADD COLUMN IF NOT EXISTS manager_comments TEXT,
ADD COLUMN IF NOT EXISTS area_manager_comments TEXT;

-- ===================================
-- 3. CREATE APPROVAL HISTORY TABLE
-- ===================================
CREATE TABLE IF NOT EXISTS approval_history (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES material_requests(id) ON DELETE CASCADE,
    from_stage VARCHAR(50),
    to_stage VARCHAR(50),
    action VARCHAR(20), -- APPROVED, REJECTED, RESCHEDULED
    approved_by INTEGER REFERENCES users(id),
    approver_name VARCHAR(200),
    approver_role VARCHAR(50),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_approval_history_request ON approval_history(request_id);
CREATE INDEX idx_approval_history_date ON approval_history(created_at DESC);

-- ===================================
-- 4. ADD USER ROLES (Keep existing admin role, add approval levels)
-- ===================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS approval_level INTEGER DEFAULT 0;
-- 0 = worker, 1 = supervisor, 2 = manager, 3 = area_manager, 4 = admin

COMMENT ON COLUMN users.approval_level IS 
'0=Worker, 1=Supervisor, 2=Assistant Manager, 3=Area Manager, 4=Admin';

-- ===================================
-- 5. WORKFLOW STAGE ENUM (For validation)
-- ===================================
COMMENT ON COLUMN material_requests.workflow_stage IS 
'MRF_CREATED → MRF_APPROVED → BLANKET_CHECK → QUOTATION_REQUESTED → QUOTATION_SUBMITTED → QUOTATION_APPROVED → PROFORMA_SUBMITTED → PROFORMA_APPROVED → SHIPPED → COMPLIANCE_CHECK → RECEIVED → CLOSED | REJECTED';

-- ===================================
-- 6. UPDATE EXISTING RECORDS
-- ===================================
UPDATE material_requests 
SET workflow_stage = CASE 
    WHEN status = 'Pending' THEN 'MRF_CREATED'
    WHEN status = 'Approved' THEN 'MRF_APPROVED'
    WHEN status = 'Rejected' THEN 'REJECTED'
    WHEN status = 'Ordered' THEN 'SHIPPED'
    WHEN status = 'Delivered' THEN 'RECEIVED'
    WHEN status = 'Completed' THEN 'CLOSED'
    ELSE 'MRF_CREATED'
END
WHERE workflow_stage IS NULL OR workflow_stage = 'MRF_CREATED';

-- ===================================
-- SUCCESS MESSAGE
-- ===================================
DO $$ 
BEGIN
    RAISE NOTICE '✅ Approval workflow schema installed!';
    RAISE NOTICE '📊 New tables: approval_history';
    RAISE NOTICE '🔧 New columns: workflow_stage, approval tracking, compliance';
    RAISE NOTICE '👥 User approval_level added (0=worker, 1=supervisor, 2=manager, 3=area_manager, 4=admin)';
END $$;