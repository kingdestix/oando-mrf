-- migration-commercial-workflow.sql
-- Commercial workflow after Discipline Manager approval

-- ===================================
-- 1. ADD NEW WORKFLOW STAGES
-- ===================================
-- After DISCIPLINE_MANAGER_APPROVAL, the workflow continues:
-- DISCIPLINE_MANAGER_APPROVAL → COMMERCIAL_REVIEW → COMMERCIAL_APPROVED → MATERIAL_DELIVERY → MATERIAL_RECEIVED → CLOSED

-- ===================================
-- 2. ADD NEW ROLES
-- ===================================
-- DODM: Divisional Operations & Development Manager (can approve commercial)
-- maintenance_manager: Maintenance Manager (view-only for commercial)
-- assistant_discipline_manager: Assistant Discipline Manager (view-only for commercial)

-- ===================================
-- 3. ADD COMMERCIAL WORKFLOW COLUMNS
-- ===================================
ALTER TABLE material_requests 
ADD COLUMN IF NOT EXISTS commercial_status VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS commercial_approved_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS commercial_approved_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS commercial_approver_signature VARCHAR(500),
ADD COLUMN IF NOT EXISTS material_delivered_to_du BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS material_delivered_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS material_received_by_requisitor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS material_received_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS requisitor_delivery_approval BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS requisitor_delivery_comments TEXT,
ADD COLUMN IF NOT EXISTS contractor_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS contractor_quotation_date DATE,
ADD COLUMN IF NOT EXISTS mrf_sent_to_contractor_date DATE;

COMMENT ON COLUMN material_requests.commercial_status IS 'COMMERCIAL_REVIEW, COMMERCIAL_APPROVED, MATERIAL_DELIVERY, MATERIAL_RECEIVED';
COMMENT ON COLUMN material_requests.requisitor_delivery_approval IS 'TRUE = All materials received, FALSE = Some materials missing, NULL = Not yet reviewed';

-- ===================================
-- 4. UPDATE WORKFLOW STAGE TO INCLUDE COMMERCIAL STAGES
-- ===================================
-- The workflow_stage column already exists, we just need to use new values:
-- DISCIPLINE_MANAGER_APPROVAL → COMMERCIAL_REVIEW → COMMERCIAL_APPROVED → MATERIAL_DELIVERY → MATERIAL_RECEIVED → CLOSED

-- ===================================
-- 5. ADD VIEW-ONLY TRACKING FOR COMMERCIAL
-- ===================================
CREATE TABLE IF NOT EXISTS commercial_view_log (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES material_requests(id) ON DELETE CASCADE,
    viewed_by INTEGER REFERENCES users(id),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role VARCHAR(50)
);

CREATE INDEX idx_commercial_view_request ON commercial_view_log(request_id);
CREATE INDEX idx_commercial_view_user ON commercial_view_log(viewed_by);

