-- Create DODM (Divisional Operations & Development Manager) user
-- Run this in pgAdmin to create a DODM user

-- First, check if DODM user already exists
SELECT id, user_id, email, role, first_name, last_name 
FROM users 
WHERE role = 'dodm';

-- If no DODM user exists, create one (replace email and password_hash)
-- Password: Use bcrypt hash generator or set a temporary password
INSERT INTO users (
  user_id, 
  first_name, 
  last_name, 
  email, 
  password_hash, 
  role, 
  designation, 
  is_active,
  created_at
) VALUES (
  'DODM001',
  'Divisional',
  'Operations Manager',
  'dodm@oando.com',  -- Change this email
  '$2b$10$T29dxgmbx3yBnZPz0HTMwuTpE7qIzJOJMObT5I8lFkI.U7.SHOC.W',  -- Password: Test@2025
  'dodm',
  'Divisional Operations & Development Manager',
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT (user_id) DO NOTHING;

-- Verify DODM user was created
SELECT id, user_id, email, role, first_name, last_name, is_active
FROM users 
WHERE role = 'dodm';

