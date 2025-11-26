-- backend/models/database.sql
-- Oando Material Request Form - PROFESSIONAL Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- USERS & AUTHENTICATION
-- ==========================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('worker', 'manager', 'admin')),
    designation VARCHAR(100),
    office_extension VARCHAR(50),
    location VARCHAR(100),
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- LOOKUP TABLES
-- ==========================================
CREATE TABLE sites (
    id SERIAL PRIMARY KEY,
    site_code VARCHAR(20) UNIQUE NOT NULL,
    site_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE disciplines (
    id SERIAL PRIMARY KEY,
    discipline_name VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE material_categories (
    id SERIAL PRIMARY KEY,
    category_name VARCHAR(100) UNIQUE NOT NULL,
    discipline_id INTEGER REFERENCES disciplines(id),
    is_active BOOLEAN DEFAULT true
);

-- ==========================================
-- MAIN REQUESTS TABLE
-- ==========================================
CREATE TABLE material_requests (
    id SERIAL PRIMARY KEY,
    
    -- Request Identification
    mrf_number VARCHAR(50) UNIQUE NOT NULL,
    request_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM request_date)::INTEGER) STORED,
    
    -- Requestor Information
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    user_code VARCHAR(50) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    office_extension VARCHAR(50),
    asset VARCHAR(100) NOT NULL, -- Location/Asset
    department VARCHAR(100),
    
    -- Request Details
    unit_tag VARCHAR(100),
    discipline VARCHAR(100) NOT NULL, -- Material Group
    material_category VARCHAR(100),
    criticality VARCHAR(20) CHECK (criticality IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
    work_order_no VARCHAR(100),
    work_order_type VARCHAR(100),
    reason TEXT NOT NULL,
    service_material VARCHAR(50) DEFAULT 'Material',
    
    -- Internal Tracking
    internal_reference VARCHAR(200), -- Staff following up within department
    follow_up_by VARCHAR(200), -- Same as internal reference
    status VARCHAR(30) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Ordered', 'Delivered', 'Completed', 'Cancelled')),
    status_notes TEXT,
    action_pending TEXT,
    
    -- Vendor/Procurement
    vendor_name VARCHAR(200), -- Contractor who submitted quotation
    contractor_name VARCHAR(200), -- Same as vendor
    blanket_order_number VARCHAR(100),
    call_off_number VARCHAR(100),
    purchase_order_no VARCHAR(100),
    
    -- Quotation
    quotation_status VARCHAR(30) DEFAULT 'Not Submitted' CHECK (
        quotation_status IN ('Not Submitted', 'Pending', 'Approved', 'Rejected')
    ),
    quotation_reference VARCHAR(100),
    quotation_approval_date DATE,
    quotation_amount_usd DECIMAL(15,2),
    quotation_amount_eur DECIMAL(15,2),
    quotation_amount_ngn DECIMAL(15,2),
    
    -- Delivery
    estimated_delivery_date DATE,
    actual_delivery_date DATE,
    
    -- Approval Workflow
    issued_by VARCHAR(100),
    issued_date TIMESTAMP,
    checked_by VARCHAR(100),
    checked_date TIMESTAMP,
    approved_by VARCHAR(100), -- Manager who approved
    approved_date TIMESTAMP,
    manager_name VARCHAR(100), -- Same as approved_by
    
    -- Notes
    notes TEXT,
    remarks TEXT,
    other TEXT,
    
    -- System
    import_batch_id VARCHAR(50),
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- LINE ITEMS TABLE
-- ==========================================
CREATE TABLE material_request_lines (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES material_requests(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL,
    
    material_description TEXT NOT NULL,
    oem_model VARCHAR(200),
    part_number VARCHAR(200),
    quantity DECIMAL(10,2) NOT NULL CHECK (quantity > 0),
    quantity_unit VARCHAR(50) DEFAULT 'pcs',
    received_quantity DECIMAL(10,2) DEFAULT 0,
    
    certification_required VARCHAR(10),
    expected_delivery_date DATE,
    actual_delivery_date DATE,
    
    unit_price_usd DECIMAL(15,2),
    unit_price_eur DECIMAL(15,2),
    unit_price_ngn DECIMAL(15,2),
    total_price_usd DECIMAL(15,2),
    total_price_ngn DECIMAL(15,2),
    
    line_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_request_line UNIQUE (request_id, line_no)
);

-- ==========================================
-- ATTACHMENTS
-- ==========================================
CREATE TABLE attachments (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES material_requests(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size INTEGER,
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    category VARCHAR(50) DEFAULT 'general',
    status VARCHAR(20) DEFAULT 'uploaded',
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    notes TEXT
);

-- ==========================================
-- IMPORT JOBS
-- ==========================================
CREATE TABLE import_jobs (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(50) UNIQUE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    imported_by INTEGER REFERENCES users(id),
    total_rows INTEGER,
    successful_rows INTEGER,
    failed_rows INTEGER,
    status VARCHAR(20) CHECK (status IN ('processing', 'completed', 'failed')),
    error_log TEXT,
    mapping_used JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ==========================================
-- ACTIVITY LOGS
-- ==========================================
CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX idx_requests_mrf_number ON material_requests(mrf_number);
CREATE INDEX idx_requests_date ON material_requests(request_date);
CREATE INDEX idx_requests_year ON material_requests(year);
CREATE INDEX idx_requests_user_id ON material_requests(user_id);
CREATE INDEX idx_requests_status ON material_requests(status);
CREATE INDEX idx_requests_discipline ON material_requests(discipline);
CREATE INDEX idx_requests_asset ON material_requests(asset);
CREATE INDEX idx_requests_vendor ON material_requests(vendor_name);
CREATE INDEX idx_request_lines_request_id ON material_request_lines(request_id);
CREATE INDEX idx_request_lines_material_desc ON material_request_lines(material_description);

-- ==========================================
-- TRIGGERS
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_requests_updated_at BEFORE UPDATE ON material_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- SEED DATA
-- ==========================================
INSERT INTO sites (site_code, site_name) VALUES
    ('LAR', 'LAND AREA'),
    ('MICE', 'MICE AREA'),
    ('OBOS', 'OBOS'),
    ('BT', 'BRASS TERMINAL'),
    ('PHC', 'PORT HARCOURT');

INSERT INTO disciplines (discipline_name) VALUES
    ('Mechanical'),
    ('Electrical'),
    ('Instrumentation'),
    ('Civil'),
    ('Safety'),
    ('Consumables'),
    ('IT & Telecom'),
    ('HVAC');

INSERT INTO material_categories (category_name, discipline_id) VALUES
    ('Pumps Spares', 1),
    ('Valves', 1),
    ('Bearings', 1),
    ('Seals & Gaskets', 1),
    ('Motors', 2),
    ('Cables', 2),
    ('Circuit Breakers', 2),
    ('Sensors', 3),
    ('Transmitters', 3),
    ('PPE', 5);

-- Default Admin User (Password: Admin@2025)
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department) VALUES
    ('ADMIN001', 'System', 'Administrator', 'admin@oando.com', '$2b$10$60jfcQH3Yv74JO4.61thXOBC2eUqdWddnT03vfE4plYP6YQarBH/W', 'admin', 'System Administrator', 'Head Office', 'IT')
ON CONFLICT (user_id) DO NOTHING;

-- Sample Manager
INSERT INTO users (user_id, first_name, last_name, email, password_hash, role, designation, location, department) VALUES
    ('MGR001', 'John', 'Manager', 'manager@oando.com', '$2b$10$K8vJ9X7.5mGzZqF8PwE9Zu5kZJ9YxZ7.5mGzZqF8PwE9Zu5kZJ9Yx', 'manager', 'Procurement Manager', 'Head Office', 'Procurement')
ON CONFLICT (user_id) DO NOTHING;

-- ==========================================
-- REQUEST NUMBER GENERATOR
-- ==========================================
CREATE OR REPLACE FUNCTION generate_mrf_number(site_code_param VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    year_part VARCHAR(4);
    seq_part VARCHAR(10);
    next_seq INTEGER;
BEGIN
    year_part := EXTRACT(YEAR FROM CURRENT_DATE)::VARCHAR;
    
    SELECT COALESCE(MAX(
        CAST(
            SUBSTRING(mrf_number FROM LENGTH(site_code_param) + 7 FOR 3)
            AS INTEGER
        )
    ), 0) + 1
    INTO next_seq
    FROM material_requests
    WHERE mrf_number LIKE site_code_param || '-MICE-%' || year_part;
    
    seq_part := LPAD(next_seq::VARCHAR, 3, '0');
    
    RETURN site_code_param || '-MICE-' || seq_part || '-' || year_part;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- ANALYTICS VIEW
-- ==========================================
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


--new
-- ==========================================
-- FIX DATABASE CONSTRAINTS FOR EXCEL IMPORT
-- Run this in pgAdmin to fix constraint issues
-- ==========================================

-- 1. DROP THE STRICT STATUS CHECK CONSTRAINT
-- This allows any status value from Excel
ALTER TABLE material_requests DROP CONSTRAINT IF EXISTS material_requests_status_check;

-- Add a more lenient constraint (or none at all for Excel import flexibility)
ALTER TABLE material_requests ADD CONSTRAINT material_requests_status_check 
CHECK (status IS NULL OR status IN (
  'Pending', 'Approved', 'Rejected', 'Ordered', 'Delivered', 'Completed', 'Cancelled',
  -- Add common variations from Excel
  'PENDING', 'APPROVED', 'REJECTED', 'ORDERED', 'DELIVERED', 'COMPLETED',
  'In Progress', 'On Hold', 'Awaiting Approval', 'Processing', 'Closed',
  -- Allow any text for flexibility
  ''
) OR LENGTH(status) > 0);

-- OR completely remove status constraint for maximum flexibility:
-- ALTER TABLE material_requests DROP CONSTRAINT IF EXISTS material_requests_status_check;

-- 2. INCREASE service_material COLUMN SIZE
-- Currently 50 chars, but Excel might have longer values
ALTER TABLE material_requests ALTER COLUMN service_material TYPE VARCHAR(200);

-- 3. INCREASE other commonly long fields
ALTER TABLE material_requests ALTER COLUMN status TYPE VARCHAR(100);
ALTER TABLE material_requests ALTER COLUMN status_notes TYPE TEXT;
ALTER TABLE material_requests ALTER COLUMN internal_reference TYPE TEXT;
ALTER TABLE material_requests ALTER COLUMN action_pending TYPE TEXT;

-- 4. ADD DEFAULT STATUS IF NULL
ALTER TABLE material_requests ALTER COLUMN status SET DEFAULT 'Pending';

-- 5. VERIFY CHANGES
SELECT 
    column_name, 
    data_type, 
    character_maximum_length,
    column_default
FROM information_schema.columns
WHERE table_name = 'material_requests'
    AND column_name IN ('status', 'service_material', 'status_notes', 'internal_reference', 'action_pending')
ORDER BY column_name;

-- ==========================================
-- SUCCESS MESSAGE
-- ==========================================
DO $$ 
BEGIN
    RAISE NOTICE '✅ Database constraints fixed!';
    RAISE NOTICE '✅ Status field now accepts various formats';
    RAISE NOTICE '✅ service_material increased to 200 chars';
    RAISE NOTICE '✅ Text fields expanded for Excel import';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Now try importing your Excel file again!';
END $$;