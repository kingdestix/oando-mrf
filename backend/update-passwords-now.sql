-- update-passwords-now.sql
-- RUN THIS IN PGADMIN RIGHT NOW!
-- Make sure you're connected to: oando_mrf database
-- Then copy and paste this entire file into Query Tool and execute

-- First, verify you're on the right database
SELECT current_database() as "Current Database";
-- Should show: oando_mrf

-- Update ALL password hashes
UPDATE users
SET password_hash = '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO',
    is_active = true,
    updated_at = CURRENT_TIMESTAMP
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

-- Verify the update worked
SELECT 
    email,
    role,
    is_active,
    CASE 
        WHEN password_hash = '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO' 
        THEN '✅ CORRECT'
        ELSE '❌ STILL WRONG'
    END as password_status
FROM users
WHERE email IN (
    'requestor@oando.com',
    'tech.coord@oando.com',
    'admin@oando.com'
)
ORDER BY email;

-- If you see ✅ CORRECT for all, you're done!
-- Password for all test users: Test@2025

