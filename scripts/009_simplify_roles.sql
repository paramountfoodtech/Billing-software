-- Consolidate super_admin and admin into single admin role
-- This script updates the role system to use only 'admin' and 'accountant'

-- Step 1: Update all super_admin users to admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE role = 'super_admin';

-- Step 2: Drop the old enum and create new one with only admin and accountant
ALTER TABLE public.profiles ALTER COLUMN role TYPE TEXT;

DROP TYPE IF EXISTS user_role CASCADE;

CREATE TYPE user_role AS ENUM ('admin', 'accountant');

ALTER TABLE public.profiles ALTER COLUMN role TYPE user_role USING role::user_role;

-- Step 3: Update default value
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'accountant';

-- Verify the change
SELECT DISTINCT role FROM public.profiles;
