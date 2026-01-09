-- Fix quotation_reference field size (increase from VARCHAR(100) to VARCHAR(500))
-- Run this in pgAdmin
-- 
-- NOTE: Must drop view first, alter columns, then recreate view

-- Step 1: Drop the view that depends on vendor_name
DROP VIEW IF EXISTS v_request_analytics CASCADE;

-- Step 2: Alter columns to increase size
ALTER TABLE material_requests 
ALTER COLUMN quotation_reference TYPE VARCHAR(500);

ALTER TABLE material_requests 
ALTER COLUMN vendor_name TYPE VARCHAR(500);

ALTER TABLE material_requests 
ALTER COLUMN contractor_name TYPE VARCHAR(500);

ALTER TABLE material_requests 
ALTER COLUMN internal_reference TYPE TEXT;

ALTER TABLE material_requests 
ALTER COLUMN blanket_order_number TYPE VARCHAR(200);

ALTER TABLE material_requests 
ALTER COLUMN call_off_number TYPE VARCHAR(200);

-- Step 3: Recreate the view
CREATE OR REPLACE VIEW v_request_analytics AS
SELECT 
    r.id,
    r.mrf_number,
    r.request_date,
    r.year,
    r.first_name || ' ' || r.last_name AS requester_name,
    r.asset,
    r.discipline,
    r.criticality,
    r.status,
    r.vendor_name,
    r.approved_by,
    COUNT(l.id) AS line_items_count,
    SUM(l.quantity) AS total_quantity,
    SUM(l.total_price_usd) AS total_value_usd,
    SUM(l.total_price_ngn) AS total_value_ngn,
    r.created_at
FROM material_requests r
LEFT JOIN material_request_lines l ON r.id = l.request_id
GROUP BY r.id;

-- Step 4: Verify changes
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'material_requests' 
AND column_name IN ('quotation_reference', 'vendor_name', 'contractor_name', 'internal_reference', 'blanket_order_number', 'call_off_number');

