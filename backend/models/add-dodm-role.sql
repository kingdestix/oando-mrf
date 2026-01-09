-- Add 'dodm' role to users_role_check constraint
-- Run this in pgAdmin

-- First, drop the existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint with all roles including 'dodm'
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN (
  'worker', 
  'technical_coordinator', 
  'assistant_manager', 
  'area_manager_land', 
  'area_manager_swamp', 
  'area_manager_phc', 
  'pod_planner', 
  'discipline_unit', 
  'discipline_manager', 
  'dodm',
  'maintenance_manager',
  'assistant_discipline_manager',
  'admin', 
  'manager'
));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'users_role_check';

