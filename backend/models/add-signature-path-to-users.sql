-- backend/models/add-signature-path-to-users.sql
-- Add signature_path field to users table for profile signature management

ALTER TABLE users
ADD COLUMN IF NOT EXISTS signature_path VARCHAR(500);

COMMENT ON COLUMN users.signature_path IS 'Path to user profile signature image, used automatically for approvals';

