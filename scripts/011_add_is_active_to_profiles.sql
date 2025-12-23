-- 011_add_is_active_to_profiles.sql
-- Adds is_active column to profiles table for user status management

-- Add is_active column if it doesn't exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Set all existing users to active
UPDATE public.profiles 
SET is_active = true 
WHERE is_active IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Update RLS policies to only show active users (optional - comment out if you want to see inactive users)
-- DROP POLICY IF EXISTS "Users can view active profiles" ON public.profiles;
-- CREATE POLICY "Users can view active profiles"
--   ON public.profiles FOR SELECT
--   USING (
--     auth.uid() = id OR 
--     (is_active = true AND EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE id = auth.uid() AND organization_id = profiles.organization_id
--     ))
--   );
