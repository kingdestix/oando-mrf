-- create-discipline-users.sql
-- Create Discipline Managers and Discipline Units for all 6 disciplines
-- Password for all users: Test@2025
-- Run this after test-roles.sql

-- ===================================
-- DISCIPLINE UNITS (6 disciplines)
-- ===================================

-- 1. ROTATING EQUIPMENT Discipline Unit
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DU_ROT001', 'James', 'Rotating', 'du.rotating@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_unit', 'Rotating Equipment Engineer', 'PHC', 'Engineering', 5, 'ROTATING EQUIPMENT')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  discipline_assignment = EXCLUDED.discipline_assignment;

-- 2. POWER GENERATION Discipline Unit
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DU_PWR001', 'Sarah', 'Power', 'du.power@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_unit', 'Power Generation Engineer', 'PHC', 'Engineering', 5, 'POWER GENERATION')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  discipline_assignment = EXCLUDED.discipline_assignment;

-- 3. METERING AND AUTOMATION Discipline Unit
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DU_MET001', 'Michael', 'Metering', 'du.metering@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_unit', 'Metering & Automation Engineer', 'PHC', 'Engineering', 5, 'METERING AND AUTOMATION')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  discipline_assignment = EXCLUDED.discipline_assignment;

-- 4. ASSET INTEGRITY Discipline Unit
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DU_ASSET001', 'Patricia', 'Asset', 'du.asset@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_unit', 'Asset Integrity Engineer', 'PHC', 'Engineering', 5, 'ASSET INTEGRITY')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  discipline_assignment = EXCLUDED.discipline_assignment;

-- 5. ESP Discipline Unit
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DU_ESP001', 'Robert', 'ESP', 'du.esp@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_unit', 'ESP Engineer', 'PHC', 'Engineering', 5, 'ESP')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  discipline_assignment = EXCLUDED.discipline_assignment;

-- 6. PRODUCTION Discipline Unit
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DU_PROD001', 'Jennifer', 'Production', 'du.production@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_unit', 'Production Engineer', 'PHC', 'Engineering', 5, 'PRODUCTION')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  discipline_assignment = EXCLUDED.discipline_assignment;

-- ===================================
-- DISCIPLINE MANAGERS (6 disciplines)
-- ===================================

-- 1. ROTATING EQUIPMENT Discipline Manager
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DM_ROT001', 'David', 'Rotating Mgr', 'dm.rotating@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_manager', 'Rotating Equipment Manager', 'PHC', 'Engineering', 6, 'ROTATING EQUIPMENT')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  discipline_assignment = EXCLUDED.discipline_assignment;

-- 2. POWER GENERATION Discipline Manager
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DM_PWR001', 'Linda', 'Power Mgr', 'dm.power@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_manager', 'Power Generation Manager', 'PHC', 'Engineering', 6, 'POWER GENERATION')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  discipline_assignment = EXCLUDED.discipline_assignment;

-- 3. METERING AND AUTOMATION Discipline Manager
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DM_MET001', 'Thomas', 'Metering Mgr', 'dm.metering@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_manager', 'Metering & Automation Manager', 'PHC', 'Engineering', 6, 'METERING AND AUTOMATION')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  discipline_assignment = EXCLUDED.discipline_assignment;

-- 4. ASSET INTEGRITY Discipline Manager
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DM_ASSET001', 'Mary', 'Asset Mgr', 'dm.asset@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_manager', 'Asset Integrity Manager', 'PHC', 'Engineering', 6, 'ASSET INTEGRITY')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  discipline_assignment = EXCLUDED.discipline_assignment;

-- 5. ESP Discipline Manager
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DM_ESP001', 'Christopher', 'ESP Mgr', 'dm.esp@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_manager', 'ESP Manager', 'PHC', 'Engineering', 6, 'ESP')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  discipline_assignment = EXCLUDED.discipline_assignment;

-- 6. PRODUCTION Discipline Manager
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department, approval_level, discipline_assignment) VALUES
('DM_PROD001', 'Elizabeth', 'Production Mgr', 'dm.production@oando.com', '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO', 'discipline_manager', 'Production Manager', 'PHC', 'Engineering', 6, 'PRODUCTION')
ON CONFLICT (user_id) DO UPDATE SET 
  role = EXCLUDED.role,
  approval_level = EXCLUDED.approval_level,
  discipline_assignment = EXCLUDED.discipline_assignment;

-- ===================================
-- UPDATE EXISTING DISCIPLINE MANAGER (if exists)
-- ===================================
-- Update the existing discipline manager to have a discipline assignment
UPDATE users 
SET discipline_assignment = 'ROTATING EQUIPMENT'
WHERE email = 'discipline.mgr@oando.com' AND role = 'discipline_manager' AND discipline_assignment IS NULL;

-- ===================================
-- SUMMARY
-- ===================================
DO $$ 
BEGIN
    RAISE NOTICE '✅ Discipline Users Created!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 DISCIPLINE UNIT LOGIN CREDENTIALS';
    RAISE NOTICE 'Password for all: Test@2025';
    RAISE NOTICE '';
    RAISE NOTICE '1. ROTATING EQUIPMENT:';
    RAISE NOTICE '   Email: du.rotating@oando.com';
    RAISE NOTICE '';
    RAISE NOTICE '2. POWER GENERATION:';
    RAISE NOTICE '   Email: du.power@oando.com';
    RAISE NOTICE '';
    RAISE NOTICE '3. METERING AND AUTOMATION:';
    RAISE NOTICE '   Email: du.metering@oando.com';
    RAISE NOTICE '';
    RAISE NOTICE '4. ASSET INTEGRITY:';
    RAISE NOTICE '   Email: du.asset@oando.com';
    RAISE NOTICE '';
    RAISE NOTICE '5. ESP:';
    RAISE NOTICE '   Email: du.esp@oando.com';
    RAISE NOTICE '';
    RAISE NOTICE '6. PRODUCTION:';
    RAISE NOTICE '   Email: du.production@oando.com';
    RAISE NOTICE '';
    RAISE NOTICE '📋 DISCIPLINE MANAGER LOGIN CREDENTIALS';
    RAISE NOTICE 'Password for all: Test@2025';
    RAISE NOTICE '';
    RAISE NOTICE '1. ROTATING EQUIPMENT:';
    RAISE NOTICE '   Email: dm.rotating@oando.com';
    RAISE NOTICE '';
    RAISE NOTICE '2. POWER GENERATION:';
    RAISE NOTICE '   Email: dm.power@oando.com';
    RAISE NOTICE '';
    RAISE NOTICE '3. METERING AND AUTOMATION:';
    RAISE NOTICE '   Email: dm.metering@oando.com';
    RAISE NOTICE '';
    RAISE NOTICE '4. ASSET INTEGRITY:';
    RAISE NOTICE '   Email: dm.asset@oando.com';
    RAISE NOTICE '';
    RAISE NOTICE '5. ESP:';
    RAISE NOTICE '   Email: dm.esp@oando.com';
    RAISE NOTICE '';
    RAISE NOTICE '6. PRODUCTION:';
    RAISE NOTICE '   Email: dm.production@oando.com';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 HOW IT WORKS:';
    RAISE NOTICE '- Each Discipline Unit sees only requests for their assigned discipline';
    RAISE NOTICE '- Each Discipline Manager sees only requests for their assigned discipline';
    RAISE NOTICE '- When POD routes a request, it goes to the Discipline Unit for that discipline';
    RAISE NOTICE '- Discipline Unit reviews and routes to Discipline Manager';
    RAISE NOTICE '- Discipline Manager approves and generates MRF PDF';
END $$;

