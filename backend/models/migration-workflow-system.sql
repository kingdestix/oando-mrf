-- migration-workflow-system.sql
-- Comprehensive Workflow System for MRF Approval Process
-- Run this in pgAdmin to implement the new workflow system

-- ===================================
-- 1. UPDATE USER ROLES AND ADD NEW ROLES
-- ===================================
-- First, increase the role column size to accommodate longer role names
ALTER TABLE users 
ALTER COLUMN role TYPE VARCHAR(50);

-- Drop existing constraint if it exists
ALTER TABLE users 
DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint with all roles
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN (
  'worker', 
  'technical_coordinator', 
  'assistant_manager', 
  'area_manager_land', 
  'area_manager_swamp', 
  'area_manager_phc', 
  'pod_planner', 
  'discipline_unit', 
  'discipline_manager', 
  'admin',
  'manager'  -- Keep old manager role for backward compatibility
));

-- Add workflow-specific columns to users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS approval_level INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS area_assignment VARCHAR(50), -- 'Land', 'Swamp', 'PHC POD', or NULL for all
ADD COLUMN IF NOT EXISTS discipline_assignment VARCHAR(100), -- Specific discipline or NULL for all
ADD COLUMN IF NOT EXISTS location_assignment VARCHAR(100); -- Specific location (e.g., 'KWALE', 'OGBOINBIRI') or NULL

COMMENT ON COLUMN users.approval_level IS 
'0=Worker, 1=Technical Coordinator, 2=Assistant Manager, 3=Area Manager, 4=POD Planner, 5=Discipline Unit, 6=Discipline Manager, 7=Admin';

COMMENT ON COLUMN users.area_assignment IS 
'Area assignment: Land, Swamp, PHC POD, or NULL for all areas';

COMMENT ON COLUMN users.discipline_assignment IS 
'Specific discipline assignment or NULL for all disciplines';

COMMENT ON COLUMN users.location_assignment IS 
'Specific location assignment (e.g., KWALE, OGBOINBIRI) or NULL for all locations';

-- ===================================
-- 2. UPDATE MATERIAL_REQUESTS WITH WORKFLOW FIELDS
-- ===================================
ALTER TABLE material_requests 
ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR(50) DEFAULT 'REQUESTOR_SUBMITTED',
ADD COLUMN IF NOT EXISTS area VARCHAR(50), -- 'Land Area', 'Swamp Area', 'PHC POD'
ADD COLUMN IF NOT EXISTS workflow_location VARCHAR(100); -- For location-specific workflows

-- Approval tracking columns
ALTER TABLE material_requests 
ADD COLUMN IF NOT EXISTS approved_by_technical_coordinator INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_date_technical_coordinator TIMESTAMP,
ADD COLUMN IF NOT EXISTS technical_coordinator_comments TEXT,

ADD COLUMN IF NOT EXISTS approved_by_assistant_manager INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_date_assistant_manager TIMESTAMP,
ADD COLUMN IF NOT EXISTS assistant_manager_comments TEXT,

ADD COLUMN IF NOT EXISTS approved_by_area_manager INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_date_area_manager TIMESTAMP,
ADD COLUMN IF NOT EXISTS area_manager_comments TEXT,

ADD COLUMN IF NOT EXISTS approved_by_pod_planner INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_date_pod_planner TIMESTAMP,
ADD COLUMN IF NOT EXISTS pod_planner_comments TEXT,
ADD COLUMN IF NOT EXISTS pod_routed_to_discipline VARCHAR(100), -- Which discipline unit

ADD COLUMN IF NOT EXISTS approved_by_discipline_unit INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_date_discipline_unit TIMESTAMP,
ADD COLUMN IF NOT EXISTS discipline_unit_comments TEXT,
ADD COLUMN IF NOT EXISTS contract_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS contract_validity DATE,
ADD COLUMN IF NOT EXISTS vendor_name_discipline VARCHAR(200),

ADD COLUMN IF NOT EXISTS approved_by_discipline_manager INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS approved_date_discipline_manager TIMESTAMP,
ADD COLUMN IF NOT EXISTS discipline_manager_comments TEXT,
ADD COLUMN IF NOT EXISTS quantity_adjustments JSONB; -- Store quantity reductions: {"line_id": 1, "original_qty": 50, "approved_qty": 20, "reason": "..."}

-- Rejection tracking
ALTER TABLE material_requests 
ADD COLUMN IF NOT EXISTS rejected_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS rejected_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS rejection_stage VARCHAR(50);

-- ===================================
-- 3. CREATE APPROVAL HISTORY TABLE (Enhanced)
-- ===================================
CREATE TABLE IF NOT EXISTS approval_history (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES material_requests(id) ON DELETE CASCADE,
    from_stage VARCHAR(50),
    to_stage VARCHAR(50),
    action VARCHAR(20) NOT NULL, -- APPROVED, REJECTED, ROUTED
    approved_by INTEGER REFERENCES users(id),
    approver_name VARCHAR(200),
    approver_role VARCHAR(50),
    approver_designation VARCHAR(100),
    comments TEXT,
    quantity_adjustments JSONB, -- For discipline manager quantity reductions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_history_request ON approval_history(request_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_date ON approval_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_history_approver ON approval_history(approved_by);

-- ===================================
-- 4. CREATE WORKFLOW STAGES TABLE
-- ===================================
CREATE TABLE IF NOT EXISTS workflow_stages (
    id SERIAL PRIMARY KEY,
    stage_code VARCHAR(50) UNIQUE NOT NULL,
    stage_name VARCHAR(100) NOT NULL,
    stage_order INTEGER NOT NULL,
    role_required VARCHAR(50), -- Which role can approve this stage
    description TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Insert workflow stages
INSERT INTO workflow_stages (stage_code, stage_name, stage_order, role_required, description) VALUES
('REQUESTOR_SUBMITTED', 'Request Submitted', 1, 'worker', 'Requestor has submitted the MRF'),
('TECHNICAL_COORDINATOR_REVIEW', 'Technical Coordinator Review', 2, 'technical_coordinator', 'Technical Coordinator reviews and approves/rejects'),
('ASSISTANT_MANAGER_REVIEW', 'Assistant Manager Review', 3, 'assistant_manager', 'Assistant Manager reviews and approves'),
('AREA_MANAGER_REVIEW', 'Area Manager Review', 4, 'area_manager_land', 'Area Manager (Land/Swamp/PHC) reviews and approves'),
('POD_PLANNER_REVIEW', 'POD Planner Review', 5, 'pod_planner', 'POD Planner accepts and routes to discipline unit'),
('DISCIPLINE_UNIT_REVIEW', 'Discipline Unit Review', 6, 'discipline_unit', 'Discipline unit reviews, fills contract details, uploads quotation'),
('DISCIPLINE_MANAGER_APPROVAL', 'Discipline Manager Final Approval', 7, 'discipline_manager', 'Discipline Manager final approval/rejection with quantity adjustments'),
('COMPLETED', 'Request Completed', 8, NULL, 'Request fully approved and processed'),
('REJECTED', 'Request Rejected', 99, NULL, 'Request rejected at any stage')
ON CONFLICT (stage_code) DO NOTHING;

-- ===================================
-- 5. CREATE LOCATION-SPECIFIC WORKFLOW RULES
-- ===================================
CREATE TABLE IF NOT EXISTS location_workflow_rules (
    id SERIAL PRIMARY KEY,
    location VARCHAR(100) NOT NULL,
    workflow_sequence JSONB NOT NULL, -- Array of stage codes in order
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Kwale workflow: REQUESTOR → MAINTENANCE_COORD → ASST_MANAGER_PROD → AREA_MANAGER_LAR → POD_PLANNER → DISCIPLINE_UNIT → DISCIPLINE_MANAGER
INSERT INTO location_workflow_rules (location, workflow_sequence) VALUES
('KWALE', '["REQUESTOR_SUBMITTED", "TECHNICAL_COORDINATOR_REVIEW", "ASSISTANT_MANAGER_REVIEW", "AREA_MANAGER_REVIEW", "POD_PLANNER_REVIEW", "DISCIPLINE_UNIT_REVIEW", "DISCIPLINE_MANAGER_APPROVAL", "COMPLETED"]'::jsonb)
ON CONFLICT DO NOTHING;

-- Ogboinbiri workflow: REQUESTOR → MAINTENANCE_COORD → PROD_MANAGER → AREA_MANAGER_SAR
INSERT INTO location_workflow_rules (location, workflow_sequence) VALUES
('OGBOINBIRI', '["REQUESTOR_SUBMITTED", "TECHNICAL_COORDINATOR_REVIEW", "ASSISTANT_MANAGER_REVIEW", "AREA_MANAGER_REVIEW", "COMPLETED"]'::jsonb)
ON CONFLICT DO NOTHING;

-- Default workflow for other locations
INSERT INTO location_workflow_rules (location, workflow_sequence) VALUES
('DEFAULT', '["REQUESTOR_SUBMITTED", "TECHNICAL_COORDINATOR_REVIEW", "ASSISTANT_MANAGER_REVIEW", "AREA_MANAGER_REVIEW", "POD_PLANNER_REVIEW", "DISCIPLINE_UNIT_REVIEW", "DISCIPLINE_MANAGER_APPROVAL", "COMPLETED"]'::jsonb)
ON CONFLICT DO NOTHING;

-- ===================================
-- 6. UPDATE EXISTING REQUESTS
-- ===================================
UPDATE material_requests 
SET workflow_stage = CASE 
    WHEN status = 'Pending' THEN 'REQUESTOR_SUBMITTED'
    WHEN status = 'Approved' THEN 'COMPLETED'
    WHEN status = 'Rejected' THEN 'REJECTED'
    ELSE 'REQUESTOR_SUBMITTED'
END
WHERE workflow_stage IS NULL;

-- ===================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- ===================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_requests_workflow_stage') THEN
        CREATE INDEX idx_requests_workflow_stage ON material_requests(workflow_stage);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_requests_area') THEN
        CREATE INDEX idx_requests_area ON material_requests(area);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_requests_workflow_location') THEN
        CREATE INDEX idx_requests_workflow_location ON material_requests(workflow_location);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_role') THEN
        CREATE INDEX idx_users_role ON users(role);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_area_assignment') THEN
        CREATE INDEX idx_users_area_assignment ON users(area_assignment);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_location_assignment') THEN
        CREATE INDEX idx_users_location_assignment ON users(location_assignment);
    END IF;
END $$;

-- ===================================
-- SUCCESS MESSAGE
-- ===================================
DO $$ 
BEGIN
    RAISE NOTICE '✅ Workflow system migration completed!';
    RAISE NOTICE '✅ New roles added: technical_coordinator, assistant_manager, area_manager_*, pod_planner, discipline_unit, discipline_manager';
    RAISE NOTICE '✅ Workflow stages created';
    RAISE NOTICE '✅ Location-specific workflows configured (Kwale, Ogboinbiri)';
    RAISE NOTICE '✅ Approval history tracking enabled';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Next steps:';
    RAISE NOTICE '1. Create test users with new roles (see test-roles.sql)';
    RAISE NOTICE '2. Update approval controller to use new workflow';
    RAISE NOTICE '3. Create role-based dashboards';
END $$;

