-- Allow organization members (any role) to insert/update price history within their org
-- Existing super_admin-only policies remain, this adds org-scoped access for admin/accountant too.

CREATE POLICY "Org users can create price history"
  ON public.price_category_history
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization(auth.uid())
  );

CREATE POLICY "Org users can update price history"
  ON public.price_category_history
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization(auth.uid())
  )
  WITH CHECK (
    organization_id = public.get_user_organization(auth.uid())
  );
