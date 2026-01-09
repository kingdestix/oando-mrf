-- test-roles.sql
-- Test Users for Workflow System Testing
-- Password for all test users: Test@2025
-- IMPORTANT: All users login with EMAIL and PASSWORD (not username)
-- Run this after migration-workflow-system.sql

-- ===================================
-- TEST USERS WITH DIFFERENT ROLES
-- ===================================

-- 1. REQUESTOR (Worker)
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, area_assignment, location_assignment) VALUES
('REQ001', 'John', 'Requestor', 'requestor@oando.com', '$2b$10$rd5y8HSqFU7qEuPCM5OddeFMVqTBTk48zNrE7grbl1b4TAOhQ2jDa', 'worker', 'Production Coordinator', 'KWALE', 'Production', NULL, 'KWALE'),
('REQ002', 'Mary', 'Worker', 'worker@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'worker', 'Maintenance Technician', 'OGBOINBIRI', 'Maintenance', NULL, 'OGBOINBIRI')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  area_assignment = EXCLUDED.area_assignment,
  location_assignment = EXCLUDED.location_assignment;

-- 2. TECHNICAL COORDINATOR (Maintenance Coordinator)
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, area_assignment) VALUES
('TECH001', 'David', 'Coordinator', 'tech.coord@oando.com', '$2b$10$rd5y8HSqFU7qEuPCM5OddeFMVqTBTk48zNrE7grbl1b4TAOhQ2jDa', 'technical_coordinator', 'Maintenance Coordinator', 'Head Office', 'Maintenance', 1, NULL)
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level;

-- 3. ASSISTANT MANAGER (Production)
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, area_assignment) VALUES
('ASST001', 'Sarah', 'Manager', 'asst.mgr@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'assistant_manager', 'Assistant Manager Production', 'Head Office', 'Production', 2, NULL)
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level;

-- 4. AREA MANAGERS
-- Land Area Manager (LAR)
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, area_assignment) VALUES
('LAR001', 'Michael', 'LAR Manager', 'lar.mgr@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'area_manager_land', 'Area Manager LAR', 'Head Office', 'Operations', 3, 'Land')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  area_assignment = EXCLUDED.area_assignment;

-- Swamp Area Manager (SAR)
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, area_assignment) VALUES
('SAR001', 'Patricia', 'SAR Manager', 'sar.mgr@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'area_manager_swamp', 'Area Manager SAR', 'Head Office', 'Operations', 3, 'Swamp')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  area_assignment = EXCLUDED.area_assignment;

-- PHC POD Area Manager
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, area_assignment) VALUES
('PHC001', 'Robert', 'PHC Manager', 'phc.mgr@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'area_manager_phc', 'Area Manager PHC POD', 'PHC', 'Operations', 3, 'PHC POD')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  area_assignment = EXCLUDED.area_assignment;

-- 5. POD PLANNER
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level) VALUES
('POD001', 'Jennifer', 'Planner', 'pod.planner@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'pod_planner', 'POD Planner', 'PHC', 'POD', 4)
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level;

-- 6. DISCIPLINE UNIT (Rotating Equipment)
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DISC001', 'James', 'Engineer', 'discipline.unit@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_unit', 'Rotating Equipment Engineer', 'PHC', 'Engineering', 5, 'ROTATING EQUIPMENT')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  discipline_assignment = EXCLUDED.discipline_assignment;

-- 7. DISCIPLINE MANAGER
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DISC002', 'Linda', 'Manager', 'discipline.mgr@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_manager', 'Discipline Manager', 'PHC', 'Engineering', 6, NULL)
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level;

-- 8. ADMIN (Keep existing or create new)
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level) VALUES
('ADMIN001', 'System', 'Administrator', 'admin@oando.com', '$2b$10$60jfcQH3Yv74JO4.61thXOBC2eUqdWddnT03vfE4plYP6YQarBH/W', 'admin', 'System Administrator', 'Head Office', 'IT', 7)
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level;

-- ===================================
-- SUMMARY
-- ===================================
DO $$ 
BEGIN
    RAISE NOTICE '✅ Test users created!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 TEST USER CREDENTIALS (Login with EMAIL and PASSWORD)';
    RAISE NOTICE 'Password for all test users: Test@2025';
    RAISE NOTICE '';
    RAISE NOTICE 'REQUESTORS:';
    RAISE NOTICE '  Email: requestor@oando.com (KWALE)';
    RAISE NOTICE '  Email: worker@oando.com (OGBOINBIRI)';
    RAISE NOTICE '';
    RAISE NOTICE 'APPROVERS:';
    RAISE NOTICE '  Email: tech.coord@oando.com (Technical Coordinator)';
    RAISE NOTICE '  Email: asst.mgr@oando.com (Assistant Manager)';
    RAISE NOTICE '  Email: lar.mgr@oando.com (Land Area Manager)';
    RAISE NOTICE '  Email: sar.mgr@oando.com (Swamp Area Manager)';
    RAISE NOTICE '  Email: phc.mgr@oando.com (PHC POD Manager)';
    RAISE NOTICE '  Email: pod.planner@oando.com (POD Planner)';
    RAISE NOTICE '  Email: discipline.unit@oando.com (Discipline Unit)';
    RAISE NOTICE '  Email: discipline.mgr@oando.com (Discipline Manager)';
    RAISE NOTICE '  Email: admin@oando.com (Admin)';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 TESTING WORKFLOW:';
    RAISE NOTICE '1. Login with requestor@oando.com and create a request for KWALE';
    RAISE NOTICE '2. Login with tech.coord@oando.com to approve as Technical Coordinator';
    RAISE NOTICE '3. Login with asst.mgr@oando.com to approve as Assistant Manager';
    RAISE NOTICE '4. Login with lar.mgr@oando.com to approve as Area Manager';
    RAISE NOTICE '5. Login with pod.planner@oando.com to route to discipline unit';
    RAISE NOTICE '6. Login with discipline.unit@oando.com to fill contract details and upload quotation';
    RAISE NOTICE '7. Login with discipline.mgr@oando.com for final approval';
END $$;

