-- ==========================================
-- OANDO MRF - DATABASE MIGRATION SCRIPT
-- This script safely updates existing database
-- Run this in pgAdmin instead of the full schema
-- ==========================================

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add follow_up_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='material_requests' AND column_name='follow_up_by') THEN
        ALTER TABLE material_requests ADD COLUMN follow_up_by VARCHAR(200);
        COMMENT ON COLUMN material_requests.follow_up_by IS 'Same as internal_reference - staff following up';
    END IF;

    -- Add contractor_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='material_requests' AND column_name='contractor_name') THEN
        ALTER TABLE material_requests ADD COLUMN contractor_name VARCHAR(200);
        COMMENT ON COLUMN material_requests.contractor_name IS 'Same as vendor_name';
    END IF;

    -- Add manager_name column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='material_requests' AND column_name='manager_name') THEN
        ALTER TABLE material_requests ADD COLUMN manager_name VARCHAR(100);
        COMMENT ON COLUMN material_requests.manager_name IS 'Same as approved_by';
    END IF;

    -- Add purchase_order_no column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='material_requests' AND column_name='purchase_order_no') THEN
        ALTER TABLE material_requests ADD COLUMN purchase_order_no VARCHAR(100);
    END IF;

    -- Add updated_by column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='material_requests' AND column_name='updated_by') THEN
        ALTER TABLE material_requests ADD COLUMN updated_by INTEGER REFERENCES users(id);
    END IF;

    -- Ensure asset column exists (it should, but double-check)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='material_requests' AND column_name='asset') THEN
        ALTER TABLE material_requests ADD COLUMN asset VARCHAR(100);
    END IF;

END $$;

-- Update existing data: sync follow_up_by with internal_reference
UPDATE material_requests 
SET follow_up_by = internal_reference 
WHERE follow_up_by IS NULL AND internal_reference IS NOT NULL;

-- Update existing data: sync contractor_name with vendor_name  
UPDATE material_requests 
SET contractor_name = vendor_name 
WHERE contractor_name IS NULL AND vendor_name IS NOT NULL;

-- Update existing data: sync manager_name with approved_by
UPDATE material_requests 
SET manager_name = approved_by 
WHERE manager_name IS NULL AND approved_by IS NOT NULL;

-- Add or update sites
INSERT INTO sites (site_code, site_name) VALUES
    ('LAR', 'LAND AREA'),
    ('MICE', 'MICE AREA'),
    ('OBOB', 'OBOB'),
    ('OBOS', 'OBOS'),
    ('BT', 'BRASS TERMINAL'),
    ('PHC', 'PORT HARCOURT')
ON CONFLICT (site_code) DO UPDATE SET site_name = EXCLUDED.site_name;

-- Add or update disciplines
INSERT INTO disciplines (discipline_name) VALUES
    ('Mechanical'),
    ('Electrical'),
    ('Instrumentation'),
    ('Civil'),
    ('Safety'),
    ('Consumables'),
    ('IT & Telecom'),
    ('HVAC')
ON CONFLICT (discipline_name) DO NOTHING;

-- Add helpful comments
COMMENT ON TABLE material_requests IS 'Main table for material requests - matches Excel format exactly';
COMMENT ON COLUMN material_requests.asset IS 'Excel column: Asset. This is the Location field from request form';
COMMENT ON COLUMN material_requests.mrf_number IS 'Excel column: Mrf Number. Format: LAR-MICE-001-2025';
COMMENT ON COLUMN material_requests.internal_reference IS 'Excel column: Internal Reference. Staff member following up';
COMMENT ON COLUMN material_requests.status_notes IS 'Excel column: Status Notes. Manager comments on status';
COMMENT ON COLUMN material_requests.action_pending IS 'Excel column: Action Pending. What needs to be done';
COMMENT ON COLUMN material_requests.vendor_name IS 'Excel column: Vendor Name. Contractor/Supplier';
COMMENT ON COLUMN material_requests.blanket_order_number IS 'Excel column: Blanket Order Number';
COMMENT ON COLUMN material_requests.call_off_number IS 'Excel column: Call Off Number';
COMMENT ON COLUMN material_requests.quotation_reference IS 'Excel column: Quotation';
COMMENT ON COLUMN material_requests.quotation_approval_date IS 'Excel column: Quotation Approval Date';
COMMENT ON COLUMN material_requests.quotation_amount_usd IS 'Excel column: Quotation Amount USD';
COMMENT ON COLUMN material_requests.quotation_amount_eur IS 'Excel column: Quotation Amount EUR';
COMMENT ON COLUMN material_requests.quotation_amount_ngn IS 'Excel column: Quotation Amount NGN';
COMMENT ON COLUMN material_requests.estimated_delivery_date IS 'Excel column: Estimated Delivery';
COMMENT ON COLUMN material_requests.actual_delivery_date IS 'Excel column: Date of Delivery';
COMMENT ON COLUMN material_requests.notes IS 'Excel column: Notes';
COMMENT ON COLUMN material_requests.other IS 'Excel column: Other';

-- Create or replace the MRF number generator function
CREATE OR REPLACE FUNCTION generate_mrf_number(site_code_param VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    year_part VARCHAR(4);
    seq_part VARCHAR(10);
    next_seq INTEGER;
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    
    -- Get next sequence number for this site and year
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(mrf_number FROM LENGTH(site_code_param) + 7 FOR 3)
            AS INTEGER
        )
    ), 0) + 1
    INTO next_seq
    FROM material_requests
    WHERE mrf_number LIKE site_code_param || '-MICE-%' || year_part
      OR mrf_number LIKE site_code_param || '-MCTE-%' || year_part; -- Also handle old format
    
    seq_part := LPAD(next_seq::VARCHAR, 3, '0');
    
    RETURN site_code_param || '-MICE-' || seq_part || '-' || year_part;
END;
$$ LANGUAGE plpgsql;

-- Create or replace analytics view
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

-- ==========================================
-- VERIFICATION QUERIES
-- Run these to check if migration worked
-- ==========================================

-- Check if all required columns exist
SELECT 
    column_name, 
    data_type, 
    column_default
FROM information_schema.columns
WHERE table_name = 'material_requests'
ORDER BY ordinal_position;

-- Count requests by status
SELECT status, COUNT(*) as count
FROM material_requests
GROUP BY status;

-- Check latest MRF numbers
SELECT mrf_number, request_date, asset, status
FROM material_requests
ORDER BY request_date DESC
LIMIT 10;

-- ==========================================
-- MIGRATION COMPLETE
-- ==========================================
SELECT 'Migration completed successfully!' as message;