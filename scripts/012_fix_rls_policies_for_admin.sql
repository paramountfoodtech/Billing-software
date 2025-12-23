-- 012_fix_rls_policies_for_admin.sql
-- Updates RLS policies to work with the simplified admin/accountant role system
-- Run this after role consolidation (script 009)

-- First, drop all existing policies that depend on the old functions
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in organization" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles in organization" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins and admins can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Super admins and admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Super admins and admins can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Super admins and admins can update payments" ON public.payments;
DROP POLICY IF EXISTS "Super admins can delete payments" ON public.payments;

-- Now drop old functions that reference super_admin
DROP FUNCTION IF EXISTS public.is_super_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_admin_or_super_admin(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(UUID) CASCADE;

-- Create new simplified function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role_value user_role;
BEGIN
  SELECT role INTO user_role_value
  FROM public.profiles
  WHERE id = user_id;
  
  RETURN user_role_value = 'admin';
END;
$$;

-- Create function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization(user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id
  FROM public.profiles
  WHERE id = user_id;
  
  RETURN org_id;
END;
$$;

-- Create new profiles policies for simplified role system
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles in their organization"
  ON public.profiles FOR SELECT
  USING (
    public.is_admin(auth.uid()) AND 
    organization_id = public.get_user_organization(auth.uid())
  );

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    public.is_admin(auth.uid()) AND 
    organization_id = public.get_user_organization(auth.uid())
  );

CREATE POLICY "Admins can update profiles in their organization"
  ON public.profiles FOR UPDATE
  USING (
    public.is_admin(auth.uid()) AND 
    organization_id = public.get_user_organization(auth.uid())
  );

CREATE POLICY "Admins can delete profiles in their organization"
  ON public.profiles FOR DELETE
  USING (
    public.is_admin(auth.uid()) AND 
    organization_id = public.get_user_organization(auth.uid())
  );

-- Create updated policies for other tables
CREATE POLICY "Admins can delete clients"
  ON public.clients FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete invoices"
  ON public.invoices FOR DELETE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update payments"
  ON public.payments FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete payments"
  ON public.payments FOR DELETE
  USING (public.is_admin(auth.uid()));
