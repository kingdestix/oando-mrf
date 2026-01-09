-- Migration: Update COMPLETED requests to COMMERCIAL_REVIEW if they were approved by DM
-- This fixes requests that were incorrectly marked as COMPLETED instead of COMMERCIAL_REVIEW

-- Update requests that:
-- 1. Are at COMPLETED stage
-- 2. Have been approved by discipline manager (DM approved them)
-- 3. Don't have commercial details filled yet (no quotation_reference or contractor_name)
-- 4. Should go to DU for commercial processing

UPDATE material_requests
SET 
  workflow_stage = 'COMMERCIAL_REVIEW',
  status = 'Approved',
  commercial_status = 'COMMERCIAL_REVIEW',
  updated_at = CURRENT_TIMESTAMP
WHERE 
  workflow_stage = 'COMPLETED'
  AND approved_by_discipline_manager IS NOT NULL
  AND (quotation_reference IS NULL OR quotation_reference = '')
  AND (contractor_name IS NULL OR contractor_name = '')
  AND status != 'Rejected';

-- Show how many were updated
SELECT 
  COUNT(*) as updated_count,
  discipline,
  COUNT(*) FILTER (WHERE workflow_stage = 'COMMERCIAL_REVIEW') as now_at_commercial_review
FROM material_requests
WHERE 
  approved_by_discipline_manager IS NOT NULL
  AND (quotation_reference IS NULL OR quotation_reference = '')
GROUP BY discipline;

