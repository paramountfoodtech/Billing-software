-- 013_fix_client_pricing_policies.sql
-- Updates client_product_pricing RLS policies to use the new is_admin function

-- Drop old policies
DROP POLICY IF EXISTS "Admins can create pricing rules" ON public.client_product_pricing;
DROP POLICY IF EXISTS "Admins can update pricing rules" ON public.client_product_pricing;
DROP POLICY IF EXISTS "Admins can delete pricing rules" ON public.client_product_pricing;

-- Create new policies using is_admin function
CREATE POLICY "Admins can create pricing rules"
  ON public.client_product_pricing FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Admins can update pricing rules"
  ON public.client_product_pricing FOR UPDATE
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Admins can delete pricing rules"
  ON public.client_product_pricing FOR DELETE
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );
