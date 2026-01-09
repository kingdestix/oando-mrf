-- Add quotation_received field to track when DU confirms quotation received from contractor
ALTER TABLE material_requests 
ADD COLUMN IF NOT EXISTS quotation_received BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN material_requests.quotation_received IS 'Flag to indicate DU has confirmed receiving quotation from contractor';

