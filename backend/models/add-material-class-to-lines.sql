-- backend/models/add-material-class-to-lines.sql
-- Add material_class field to material_request_lines table if it doesn't exist

ALTER TABLE material_request_lines
ADD COLUMN IF NOT EXISTS material_class VARCHAR(100);

COMMENT ON COLUMN material_request_lines.material_class IS 'Material class classification';

