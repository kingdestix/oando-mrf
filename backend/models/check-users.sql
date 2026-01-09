-- check-users.sql
-- SQL queries to check user status in database
-- Run these in pgAdmin to verify users

-- ===================================
-- 1. CHECK ALL USERS AND THEIR STATUS
-- ===================================
SELECT 
    id,
    user_id,
    first_name,
    last_name,
    email,
    role,
    is_active,
    approval_level,
    area_assignment,
    location_assignment,
    discipline_assignment,
    created_at
FROM users
ORDER BY created_at DESC;

-- ===================================
-- 2. CHECK SPECIFIC USER BY EMAIL
-- ===================================
SELECT 
    id,
    user_id,
    first_name,
    last_name,
    email,
    role,
    is_active,
    approval_level,
    password_hash IS NOT NULL as has_password,
    created_at
FROM users
WHERE email = 'requestor@oando.com';

-- ===================================
-- 3. CHECK ALL ACTIVE USERS
-- ===================================
SELECT 
    email,
    role,
    is_active,
    approval_level
FROM users
WHERE is_active = true
ORDER BY role, email;

-- ===================================
-- 4. CHECK ALL INACTIVE USERS
-- ===================================
SELECT 
    email,
    role,
    is_active
FROM users
WHERE is_active = false;

-- ===================================
-- 5. CHECK TEST USERS STATUS
-- ===================================
SELECT 
    user_id,
    email,
    role,
    is_active,
    approval_level,
    CASE 
        WHEN password_hash IS NULL THEN 'NO PASSWORD'
        WHEN LENGTH(password_hash) < 50 THEN 'INVALID HASH'
        ELSE 'HAS PASSWORD'
    END as password_status
FROM users
WHERE email IN (
    'requestor@oando.com',
    'worker@oando.com',
    'tech.coord@oando.com',
    'asst.mgr@oando.com',
    'lar.mgr@oando.com',
    'sar.mgr@oando.com',
    'phc.mgr@oando.com',
    'pod.planner@oando.com',
    'discipline.unit@oando.com',
    'discipline.mgr@oando.com',
    'admin@oando.com'
)
ORDER BY role;

-- ===================================
-- 6. ACTIVATE ALL TEST USERS (if needed)
-- ===================================
UPDATE users
SET is_active = true
WHERE email IN (
    'requestor@oando.com',
    'worker@oando.com',
    'tech.coord@oando.com',
    'asst.mgr@oando.com',
    'lar.mgr@oando.com',
    'sar.mgr@oando.com',
    'phc.mgr@oando.com',
    'pod.planner@oando.com',
    'discipline.unit@oando.com',
    'discipline.mgr@oando.com',
    'admin@oando.com'
);

-- ===================================
-- 7. VERIFY PASSWORD HASH FORMAT
-- ===================================
SELECT 
    email,
    role,
    SUBSTRING(password_hash, 1, 30) as hash_preview,
    LENGTH(password_hash) as hash_length,
    CASE 
        WHEN password_hash LIKE '$2b$10$%' THEN 'VALID BCRYPT'
        WHEN password_hash IS NULL THEN 'MISSING'
        ELSE 'INVALID FORMAT'
    END as hash_status
FROM users
WHERE email = 'requestor@oando.com';

-- ===================================
-- 8. CHECK USER WORKFLOW FIELDS
-- ===================================
SELECT 
    email,
    role,
    approval_level,
    area_assignment,
    location_assignment,
    discipline_assignment
FROM users
WHERE role IN (
    'technical_coordinator',
    'assistant_manager',
    'area_manager_land',
    'area_manager_swamp',
    'area_manager_phc',
    'pod_planner',
    'discipline_unit',
    'discipline_manager'
);

