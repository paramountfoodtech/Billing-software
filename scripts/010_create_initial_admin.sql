-- 010_create_initial_admin.sql
-- Creates initial admin user for bootstrapping the system
-- 
-- INSTRUCTIONS:
-- 1. First, create a user in Supabase Dashboard:
--    - Go to Authentication > Users > Add User
--    - Email: admin@example.com (or your preferred email)
--    - Password: (set a strong password)
--    - Auto Confirm User: YES
-- 
-- 2. Copy the user's UUID from the dashboard
-- 
-- 3. Run this script, replacing 'YOUR-USER-UUID-HERE' with the actual UUID

-- Create organization for the admin
INSERT INTO organizations (name, created_at, updated_at)
VALUES ('Main Organization', NOW(), NOW())
RETURNING id;

-- IMPORTANT: Copy the organization ID from above, then run this:
-- Replace BOTH 'YOUR-USER-UUID-HERE' and 'YOUR-ORG-ID-HERE' with actual values

-- Update the user's profile to admin role
UPDATE profiles
SET 
  role = 'admin',
  organization_id = 'YOUR-ORG-ID-HERE'::uuid,
  updated_at = NOW()
WHERE id = 'YOUR-USER-UUID-HERE'::uuid;

-- Verify the admin was created
SELECT 
  p.id,
  p.email,
  p.role,
  p.organization_id,
  o.name as organization_name
FROM profiles p
LEFT JOIN organizations o ON p.organization_id = o.id
WHERE p.role = 'admin';
