-- verify-database-connection.sql
-- Run this FIRST to verify you're on the correct database
-- Run in pgAdmin

-- ===================================
-- STEP 1: CHECK CURRENT DATABASE
-- ===================================
SELECT 
    current_database() as "Current Database",
    current_user as "Current User",
    version() as "PostgreSQL Version";

-- ⚠️ IMPORTANT: Make sure "Current Database" shows: oando_mrf
-- If it shows a different database, you need to:
-- 1. In pgAdmin, expand "Databases"
-- 2. Find "oando_mrf" database
-- 3. Right-click and select "Connect"
-- 4. Then run your migrations

-- ===================================
-- STEP 2: LIST ALL DATABASES
-- ===================================
SELECT 
    datname as "Database Name",
    pg_size_pretty(pg_database_size(datname)) as "Size"
FROM pg_database
WHERE datistemplate = false
ORDER BY datname;

-- ===================================
-- STEP 3: CHECK IF TABLES EXIST IN CURRENT DATABASE
-- ===================================
SELECT 
    table_name,
    CASE 
        WHEN table_name IN ('users', 'material_requests', 'material_request_lines', 'approval_history') 
        THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('users', 'material_requests', 'material_request_lines', 'approval_history', 'workflow_stages', 'location_workflow_rules')
ORDER BY table_name;

-- ===================================
-- STEP 4: CHECK USER COUNT
-- ===================================
SELECT 
    COUNT(*) as "Total Users",
    COUNT(*) FILTER (WHERE is_active = true) as "Active Users",
    COUNT(*) FILTER (WHERE is_active = false) as "Inactive Users"
FROM users;

-- ===================================
-- STEP 5: CHECK TEST USERS
-- ===================================
SELECT 
    email,
    role,
    is_active,
    approval_level
FROM users
WHERE email LIKE '%@oando.com'
ORDER BY email;

