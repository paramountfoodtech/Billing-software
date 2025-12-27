-- ============================================================================
-- Update RLS Policies for New Role Names
-- ============================================================================
-- This script updates all RLS policies to work with the new role naming:
-- - admin → super_admin
-- - manager → admin
-- - accountant → accountant (unchanged)
-- ============================================================================

-- ============================================================================
-- STEP 1: Update enum type and migrate existing data
-- ============================================================================

-- First, convert role column to text temporarily
ALTER TABLE profiles ALTER COLUMN role TYPE TEXT;

-- Update existing roles
UPDATE profiles SET role = 'super_admin' WHERE role = 'admin';
UPDATE profiles SET role = 'admin' WHERE role = 'manager';

-- Drop and recreate enum with new values
DROP TYPE IF EXISTS user_role CASCADE;
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'accountant');

-- Convert role column back to enum
ALTER TABLE profiles ALTER COLUMN role TYPE user_role USING role::user_role;

-- ============================================================================
-- STEP 2: Update is_admin function to check for super_admin
-- ============================================================================

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
  
  RETURN user_role_value = 'super_admin';
END;
$$;

-- ============================================================================
-- STEP 3: Drop all existing policies
-- ============================================================================

-- Organizations policies
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;
DROP POLICY IF EXISTS "Admins can update their organization" ON public.organizations;

-- Profiles policies
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles in their organization" ON public.profiles;

-- Clients policies
DROP POLICY IF EXISTS "Users can view clients in their organization" ON public.clients;
DROP POLICY IF EXISTS "Users can create clients in their organization" ON public.clients;
DROP POLICY IF EXISTS "Users can update clients in their organization" ON public.clients;
DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Super admins and admins can delete clients" ON public.clients;

-- Products policies
DROP POLICY IF EXISTS "Users can view products in their organization" ON public.products;
DROP POLICY IF EXISTS "Users can create products in their organization" ON public.products;
DROP POLICY IF EXISTS "Users can update products in their organization" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Super admins and admins can delete products" ON public.products;

-- Client-Product pricing policies
DROP POLICY IF EXISTS "Users can view pricing in their organization" ON public.client_product_pricing;
DROP POLICY IF EXISTS "Admins can create pricing rules" ON public.client_product_pricing;
DROP POLICY IF EXISTS "Admins can update pricing rules" ON public.client_product_pricing;
DROP POLICY IF EXISTS "Admins can delete pricing rules" ON public.client_product_pricing;

-- Invoices policies
DROP POLICY IF EXISTS "Users can view invoices in their organization" ON public.invoices;
DROP POLICY IF EXISTS "Users can create invoices in their organization" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices in their organization" ON public.invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Super admins and admins can delete invoices" ON public.invoices;

-- Invoice items policies
DROP POLICY IF EXISTS "Authenticated users can view invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Authenticated users can manage invoice items" ON public.invoice_items;

-- Payments policies
DROP POLICY IF EXISTS "Users can view payments in their organization" ON public.payments;
DROP POLICY IF EXISTS "Users can create payments in their organization" ON public.payments;
DROP POLICY IF EXISTS "Admins can update payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can delete payments" ON public.payments;
DROP POLICY IF EXISTS "Super admins and admins can update payments" ON public.payments;
DROP POLICY IF EXISTS "Super admins can delete payments" ON public.payments;

-- Invoice templates policies
DROP POLICY IF EXISTS "Users can view their organization template" ON public.invoice_templates;
DROP POLICY IF EXISTS "Admins can insert template" ON public.invoice_templates;
DROP POLICY IF EXISTS "Admins can update template" ON public.invoice_templates;

-- Invoice notes policies
DROP POLICY IF EXISTS "Users can view invoice notes in their org" ON public.invoice_notes;
DROP POLICY IF EXISTS "Managers and admins can insert invoice notes" ON public.invoice_notes;
DROP POLICY IF EXISTS "Admins and Super Admins can insert invoice notes" ON public.invoice_notes;
DROP POLICY IF EXISTS "Users can update their own invoice notes" ON public.invoice_notes;
DROP POLICY IF EXISTS "Admins can delete any invoice note" ON public.invoice_notes;
DROP POLICY IF EXISTS "Super Admins can delete any invoice note" ON public.invoice_notes;

-- Payment notes policies
DROP POLICY IF EXISTS "Users can view payment notes in their org" ON public.payment_notes;
DROP POLICY IF EXISTS "Managers and admins can insert payment notes" ON public.payment_notes;
DROP POLICY IF EXISTS "Admins and Super Admins can insert payment notes" ON public.payment_notes;
DROP POLICY IF EXISTS "Users can update their own payment notes" ON public.payment_notes;
DROP POLICY IF EXISTS "Admins can delete any payment note" ON public.payment_notes;
DROP POLICY IF EXISTS "Super Admins can delete any payment note" ON public.payment_notes;

-- Notifications policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

-- ============================================================================
-- Recreate all policies with new role names
-- ============================================================================

-- Organizations policies
CREATE POLICY "Users can view their own organization"
  ON public.organizations FOR SELECT
  USING (id = public.get_user_organization(auth.uid()));

CREATE POLICY "Super Admins can update their organization"
  ON public.organizations FOR UPDATE
  USING (
    id = public.get_user_organization(auth.uid()) 
    AND public.is_admin(auth.uid())
  );

-- Profiles policies
CREATE POLICY "Enable read access for all authenticated users"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Super Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Clients policies
CREATE POLICY "Users can view clients in their organization"
  ON public.clients FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can create clients in their organization"
  ON public.clients FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update clients in their organization"
  ON public.clients FOR UPDATE
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Super Admins can delete clients"
  ON public.clients FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Products policies
CREATE POLICY "Users can view products in their organization"
  ON public.products FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can create products in their organization"
  ON public.products FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update products in their organization"
  ON public.products FOR UPDATE
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Super Admins can delete products"
  ON public.products FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Client-Product pricing policies
CREATE POLICY "Users can view pricing in their organization"
  ON public.client_product_pricing FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Super Admins can create pricing rules"
  ON public.client_product_pricing FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Super Admins can update pricing rules"
  ON public.client_product_pricing FOR UPDATE
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Super Admins can delete pricing rules"
  ON public.client_product_pricing FOR DELETE
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );

-- Invoices policies
CREATE POLICY "Users can view invoices in their organization"
  ON public.invoices FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can create invoices in their organization"
  ON public.invoices FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can update invoices in their organization"
  ON public.invoices FOR UPDATE
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Super Admins can delete invoices"
  ON public.invoices FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Invoice items policies
CREATE POLICY "Authenticated users can view invoice items"
  ON public.invoice_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage invoice items"
  ON public.invoice_items FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Payments policies
CREATE POLICY "Users can view payments in their organization"
  ON public.payments FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Users can create payments in their organization"
  ON public.payments FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Super Admins can update payments"
  ON public.payments FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Super Admins can delete payments"
  ON public.payments FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Invoice templates policies
CREATE POLICY "Users can view their organization template"
  ON public.invoice_templates FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Super Admins can insert template"
  ON public.invoice_templates FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Super Admins can update template"
  ON public.invoice_templates FOR UPDATE
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );

-- Invoice notes policies
CREATE POLICY "Users can view invoice notes in their org"
  ON public.invoice_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
    )
  );

CREATE POLICY "Admins and Super Admins can insert invoice notes"
  ON public.invoice_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'admin')
      AND p.is_active = true
    )
  );

CREATE POLICY "Users can update their own invoice notes"
  ON public.invoice_notes FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Super Admins can delete any invoice note"
  ON public.invoice_notes FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Payment notes policies
CREATE POLICY "Users can view payment notes in their org"
  ON public.payment_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
    )
  );

CREATE POLICY "Admins and Super Admins can insert payment notes"
  ON public.payment_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'admin')
      AND p.is_active = true
    )
  );

CREATE POLICY "Users can update their own payment notes"
  ON public.payment_notes FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Super Admins can delete any payment note"
  ON public.payment_notes FOR DELETE
  USING (public.is_admin(auth.uid()));

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================================
-- Verification
-- ============================================================================

-- Verify policies are created correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  CASE 
    WHEN cmd = 'r' THEN 'SELECT'
    WHEN cmd = 'a' THEN 'INSERT'
    WHEN cmd = 'w' THEN 'UPDATE'
    WHEN cmd = 'd' THEN 'DELETE'
    WHEN cmd = '*' THEN 'ALL'
  END as operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
