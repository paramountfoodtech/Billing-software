-- ============================================================================
-- Add missing price_category_history table
-- ============================================================================

-- Create price_category_history table
CREATE TABLE IF NOT EXISTS public.price_category_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  price_category_id UUID NOT NULL REFERENCES public.price_categories(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  price DECIMAL(10, 2) NOT NULL,
  effective_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(price_category_id, effective_date)
);

-- Enable RLS
ALTER TABLE public.price_category_history ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_price_category_history_category_id ON public.price_category_history(price_category_id);
CREATE INDEX IF NOT EXISTS idx_price_category_history_org_date ON public.price_category_history(organization_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_price_category_history_effective_date ON public.price_category_history(effective_date);

-- Create trigger for updated_at
CREATE TRIGGER update_price_category_history_updated_at
  BEFORE UPDATE ON public.price_category_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create RLS policies
CREATE POLICY "Users can view price history in their organization"
  ON public.price_category_history FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Super Admins can create price history"
  ON public.price_category_history FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Super Admins can update price history"
  ON public.price_category_history FOR UPDATE
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Super Admins can delete price history"
  ON public.price_category_history FOR DELETE
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );
