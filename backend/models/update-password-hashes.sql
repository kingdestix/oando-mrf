-- update-password-hashes.sql
-- Update password hashes for all test users
-- Password: Test@2025
-- Hash: $2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO
-- Run this in pgAdmin on the oando_mrf database

-- ===================================
-- UPDATE PASSWORD HASHES FOR ALL TEST USERS
-- ===================================

-- Verified hash for password "Test@2025"
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

-- Verify the update
SELECT 
    email,
    role,
    is_active,
    SUBSTRING(password_hash, 1, 30) as hash_preview,
    CASE 
        WHEN password_hash = '$2b$10$hqHOJdvsqftvYQZlD8hWiugJRqgRIKLIFmMHMN7ea7eycEiWD6TBO' THEN '✅ UPDATED'
        ELSE '❌ NOT UPDATED'
    END as status
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
ORDER BY email;

-- ===================================
-- SUCCESS MESSAGE
-- ===================================
DO $$ 
BEGIN
    RAISE NOTICE '✅ Password hashes updated!';
    RAISE NOTICE '✅ All test users can now login with:';
    RAISE NOTICE '   Email: (their email address)';
    RAISE NOTICE '   Password: Test@2025';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Make sure you are connected to database: oando_mrf';
END $$;

