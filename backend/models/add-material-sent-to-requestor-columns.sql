-- Add material_sent_to_requestor columns
-- This migration adds columns to track when DU sends materials to the requestor

ALTER TABLE material_requests 
ADD COLUMN IF NOT EXISTS material_sent_to_requestor BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS material_sent_to_requestor_date TIMESTAMP;

COMMENT ON COLUMN material_requests.material_sent_to_requestor IS 'TRUE when DU has sent materials to the requestor';
COMMENT ON COLUMN material_requests.material_sent_to_requestor_date IS 'Timestamp when materials were sent to requestor by DU';

