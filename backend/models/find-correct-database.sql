-- find-correct-database.sql
-- Run this in pgAdmin to find the correct database

-- ===================================
-- 1. LIST ALL DATABASES
-- ===================================
SELECT datname, datdba, encoding, datcollate, datctype, datacl
FROM pg_database
WHERE datistemplate = false
ORDER BY datname;

-- ===================================
-- 2. CHECK CURRENT DATABASE
-- ===================================
SELECT 
    current_database() as current_db,
    current_user as current_user,
    version() as postgres_version;

-- ===================================
-- 3. CHECK WHICH DATABASE HAS USERS TABLE
-- ===================================
-- You'll need to connect to each database and run:
SELECT 
    current_database() as database_name,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) as has_users_table,
    EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'material_requests'
    ) as has_requests_table
FROM current_database();

-- ===================================
-- 4. CHECK DATABASE FROM CONNECTION STRING
-- ===================================
-- Your app connects to database: oando_mrf
-- Check if this database exists:
SELECT datname 
FROM pg_database 
WHERE datname = 'oando_mrf';

-- ===================================
-- 5. IF DATABASE DOESN'T EXIST, CREATE IT
-- ===================================
-- CREATE DATABASE oando_mrf;

-- ===================================
-- 6. SWITCH TO CORRECT DATABASE
-- ===================================
-- In pgAdmin:
-- 1. Right-click on "Databases"
-- 2. Click "Refresh"
-- 3. Find "oando_mrf" database
-- 4. Right-click and select "Connect"
-- 5. Then run your migrations

