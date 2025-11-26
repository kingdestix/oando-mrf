-- ==========================================
-- INVENTORY/WAREHOUSE TRACKING SYSTEM
-- Run this in pgAdmin to add warehouse management
-- ==========================================

-- Warehouse/Storage Locations
CREATE TABLE warehouses (
    id SERIAL PRIMARY KEY,
    warehouse_code VARCHAR(50) UNIQUE NOT NULL,
    warehouse_name VARCHAR(200) NOT NULL,
    location VARCHAR(200),
    manager_name VARCHAR(200),
    contact_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Warehouse Receipts (Materials received from contractor)
CREATE TABLE warehouse_receipts (
    id SERIAL PRIMARY KEY,
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    request_id INTEGER REFERENCES material_requests(id) ON DELETE SET NULL,
    warehouse_id INTEGER REFERENCES warehouses(id),
    received_date DATE NOT NULL DEFAULT CURRENT_DATE,
    received_by VARCHAR(200) NOT NULL,
    contractor_name VARCHAR(200),
    delivery_note_ref VARCHAR(200),
    invoice_ref VARCHAR(200),
    condition VARCHAR(50) CHECK (condition IN ('Good', 'Damaged', 'Partial')) DEFAULT 'Good',
    remarks TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Receipt Line Items (Materials received)
CREATE TABLE warehouse_receipt_lines (
    id SERIAL PRIMARY KEY,
    receipt_id INTEGER REFERENCES warehouse_receipts(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL,
    material_description TEXT NOT NULL,
    oem_model VARCHAR(200),
    part_number VARCHAR(200),
    quantity_received DECIMAL(10,2) NOT NULL,
    quantity_unit VARCHAR(50) DEFAULT 'pcs',
    condition VARCHAR(50) CHECK (condition IN ('Good', 'Damaged', 'Defective')) DEFAULT 'Good',
    shelf_location VARCHAR(100),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_receipt_line UNIQUE (receipt_id, line_no)
);

-- Material Disbursements (Materials issued from warehouse)
CREATE TABLE warehouse_disbursements (
    id SERIAL PRIMARY KEY,
    disbursement_number VARCHAR(100) UNIQUE NOT NULL,
    request_id INTEGER REFERENCES material_requests(id) ON DELETE SET NULL,
    warehouse_id INTEGER REFERENCES warehouses(id),
    disbursed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    disbursed_by VARCHAR(200) NOT NULL,
    received_by VARCHAR(200) NOT NULL,
    department VARCHAR(200),
    work_order_no VARCHAR(100),
    purpose TEXT,
    remarks TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Disbursement Line Items (Materials issued)
CREATE TABLE warehouse_disbursement_lines (
    id SERIAL PRIMARY KEY,
    disbursement_id INTEGER REFERENCES warehouse_disbursements(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL,
    material_description TEXT NOT NULL,
    oem_model VARCHAR(200),
    part_number VARCHAR(200),
    quantity_disbursed DECIMAL(10,2) NOT NULL,
    quantity_unit VARCHAR(50) DEFAULT 'pcs',
    condition VARCHAR(50) CHECK (condition IN ('Good', 'Used', 'Returned')) DEFAULT 'Good',
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_disbursement_line UNIQUE (disbursement_id, line_no)
);

-- Current Inventory Stock (Real-time balance)
CREATE TABLE inventory_stock (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER REFERENCES warehouses(id),
    material_description TEXT NOT NULL,
    oem_model VARCHAR(200),
    part_number VARCHAR(200),
    quantity_available DECIMAL(10,2) DEFAULT 0 NOT NULL,
    quantity_unit VARCHAR(50) DEFAULT 'pcs',
    reorder_level DECIMAL(10,2),
    shelf_location VARCHAR(100),
    last_received_date DATE,
    last_issued_date DATE,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_inventory_item UNIQUE (warehouse_id, material_description, oem_model, part_number)
);

-- Surplus/Excess Materials
CREATE TABLE inventory_surplus (
    id SERIAL PRIMARY KEY,
    warehouse_id INTEGER REFERENCES warehouses(id),
    material_description TEXT NOT NULL,
    oem_model VARCHAR(200),
    part_number VARCHAR(200),
    quantity_surplus DECIMAL(10,2) NOT NULL,
    quantity_unit VARCHAR(50) DEFAULT 'pcs',
    reason TEXT,
    reported_by VARCHAR(200),
    reported_date DATE DEFAULT CURRENT_DATE,
    disposition VARCHAR(50) CHECK (disposition IN ('Available', 'Disposed', 'Returned', 'Sold')),
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_receipt_request ON warehouse_receipts(request_id);
CREATE INDEX idx_receipt_warehouse ON warehouse_receipts(warehouse_id);
CREATE INDEX idx_receipt_date ON warehouse_receipts(received_date);

CREATE INDEX idx_disbursement_request ON warehouse_disbursements(request_id);
CREATE INDEX idx_disbursement_warehouse ON warehouse_disbursements(warehouse_id);
CREATE INDEX idx_disbursement_date ON warehouse_disbursements(disbursed_date);

CREATE INDEX idx_stock_warehouse ON inventory_stock(warehouse_id);
CREATE INDEX idx_stock_material ON inventory_stock(material_description);

-- Triggers for auto-updating inventory stock
CREATE OR REPLACE FUNCTION update_inventory_on_receipt()
RETURNS TRIGGER AS $$
BEGIN
    -- Get warehouse from receipt
    DECLARE
        v_warehouse_id INTEGER;
        v_material TEXT;
        v_oem TEXT;
        v_part TEXT;
    BEGIN
        SELECT warehouse_id INTO v_warehouse_id
        FROM warehouse_receipts WHERE id = NEW.receipt_id;
        
        -- Update or insert inventory stock
        INSERT INTO inventory_stock (
            warehouse_id, material_description, oem_model, part_number,
            quantity_available, quantity_unit, last_received_date
        ) VALUES (
            v_warehouse_id, NEW.material_description, NEW.oem_model, NEW.part_number,
            NEW.quantity_received, NEW.quantity_unit, CURRENT_DATE
        )
        ON CONFLICT (warehouse_id, material_description, oem_model, part_number)
        DO UPDATE SET
            quantity_available = inventory_stock.quantity_available + NEW.quantity_received,
            last_received_date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP;
        
        RETURN NEW;
    END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_receipt_update_stock
AFTER INSERT ON warehouse_receipt_lines
FOR EACH ROW EXECUTE FUNCTION update_inventory_on_receipt();

CREATE OR REPLACE FUNCTION update_inventory_on_disbursement()
RETURNS TRIGGER AS $$
BEGIN
    DECLARE
        v_warehouse_id INTEGER;
    BEGIN
        SELECT warehouse_id INTO v_warehouse_id
        FROM warehouse_disbursements WHERE id = NEW.disbursement_id;
        
        -- Reduce inventory stock
        UPDATE inventory_stock SET
            quantity_available = quantity_available - NEW.quantity_disbursed,
            last_issued_date = CURRENT_DATE,
            updated_at = CURRENT_TIMESTAMP
        WHERE warehouse_id = v_warehouse_id
          AND material_description = NEW.material_description
          AND COALESCE(oem_model, '') = COALESCE(NEW.oem_model, '')
          AND COALESCE(part_number, '') = COALESCE(NEW.part_number, '');
        
        RETURN NEW;
    END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_disbursement_update_stock
AFTER INSERT ON warehouse_disbursement_lines
FOR EACH ROW EXECUTE FUNCTION update_inventory_on_disbursement();

-- Seed warehouses
INSERT INTO warehouses (warehouse_code, warehouse_name, location, manager_name) VALUES
    ('WH-LAR', 'Land Area Warehouse', 'OBOB', 'Warehouse Manager'),
    ('WH-SAR', 'Swamp Area Warehouse', 'OGBOINBIRI', 'Warehouse Manager'),
    ('WH-PHC', 'PHC Warehouse', 'Port Harcourt', 'Warehouse Manager');

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE '✅ Inventory/Warehouse tracking system installed!';
    RAISE NOTICE '📦 Tables created: warehouses, warehouse_receipts, warehouse_disbursements, inventory_stock, inventory_surplus';
    RAISE NOTICE '🔄 Triggers added: Auto-update inventory on receipt/disbursement';
END $$;