-- Fix approval_history.action field size (increase from VARCHAR(20) to VARCHAR(50))
-- Run this in pgAdmin
-- 
-- The action field needs to accommodate longer action names like:
-- - COMMERCIAL_DETAILS_SUBMITTED (28 chars)
-- - COMMERCIAL_APPROVED (18 chars)
-- - MATERIAL_DELIVERED (18 chars)
-- etc.

ALTER TABLE approval_history 
ALTER COLUMN action TYPE VARCHAR(50);

-- Verify change
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'approval_history' 
AND column_name = 'action';

