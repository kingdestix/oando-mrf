-- add-signature-fields.sql
-- Add signature fields to material_requests table for each approval level

ALTER TABLE material_requests 
ADD COLUMN IF NOT EXISTS technical_coordinator_signature VARCHAR(500), -- Path to signature file
ADD COLUMN IF NOT EXISTS assistant_manager_signature VARCHAR(500),
ADD COLUMN IF NOT EXISTS area_manager_signature VARCHAR(500),
ADD COLUMN IF NOT EXISTS pod_planner_signature VARCHAR(500),
ADD COLUMN IF NOT EXISTS discipline_unit_signature VARCHAR(500),
ADD COLUMN IF NOT EXISTS discipline_manager_signature VARCHAR(500);

-- Add contract amount fields for discipline unit
ALTER TABLE material_requests
ADD COLUMN IF NOT EXISTS contract_amount_usd NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS contract_amount_eur NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS contract_amount_ngn NUMERIC(15,2);

COMMENT ON COLUMN material_requests.technical_coordinator_signature IS 'File path to uploaded signature image';
COMMENT ON COLUMN material_requests.assistant_manager_signature IS 'File path to uploaded signature image';
COMMENT ON COLUMN material_requests.area_manager_signature IS 'File path to uploaded signature image';
COMMENT ON COLUMN material_requests.pod_planner_signature IS 'File path to uploaded signature image';
COMMENT ON COLUMN material_requests.discipline_unit_signature IS 'File path to uploaded signature image';
COMMENT ON COLUMN material_requests.discipline_manager_signature IS 'File path to uploaded signature image';

