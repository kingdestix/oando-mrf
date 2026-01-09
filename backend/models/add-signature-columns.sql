-- add-signature-columns.sql
-- Add signature columns to material_requests table if they don't exist
-- Run this in pgAdmin to ensure signature columns are available

-- Add signature columns for each approval level
ALTER TABLE material_requests 
ADD COLUMN IF NOT EXISTS technical_coordinator_signature VARCHAR(500),
ADD COLUMN IF NOT EXISTS assistant_manager_signature VARCHAR(500),
ADD COLUMN IF NOT EXISTS area_manager_signature VARCHAR(500),
ADD COLUMN IF NOT EXISTS pod_planner_signature VARCHAR(500),
ADD COLUMN IF NOT EXISTS discipline_unit_signature VARCHAR(500),
ADD COLUMN IF NOT EXISTS discipline_manager_signature VARCHAR(500);

-- Add contract amount fields for discipline unit (if not already added)
ALTER TABLE material_requests
ADD COLUMN IF NOT EXISTS contract_amount_usd NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS contract_amount_eur NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS contract_amount_ngn NUMERIC(15,2);

-- Add contract details fields
ALTER TABLE material_requests
ADD COLUMN IF NOT EXISTS contract_number VARCHAR(200),
ADD COLUMN IF NOT EXISTS contract_validity DATE,
ADD COLUMN IF NOT EXISTS vendor_name_discipline VARCHAR(200);

COMMENT ON COLUMN material_requests.technical_coordinator_signature IS 'File path to uploaded signature image';
COMMENT ON COLUMN material_requests.assistant_manager_signature IS 'File path to uploaded signature image';
COMMENT ON COLUMN material_requests.area_manager_signature IS 'File path to uploaded signature image';
COMMENT ON COLUMN material_requests.pod_planner_signature IS 'File path to uploaded signature image';
COMMENT ON COLUMN material_requests.discipline_unit_signature IS 'File path to uploaded signature image';
COMMENT ON COLUMN material_requests.discipline_manager_signature IS 'File path to uploaded signature image';

