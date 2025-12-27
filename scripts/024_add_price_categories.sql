-- ============================================================================
-- Add missing price_categories table
-- ============================================================================

-- Create price_categories table
CREATE TABLE IF NOT EXISTS public.price_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.price_categories ENABLE ROW LEVEL SECURITY;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_price_categories_organization_id ON public.price_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_price_categories_name ON public.price_categories(name);

-- Create trigger for updated_at
CREATE TRIGGER update_price_categories_updated_at
  BEFORE UPDATE ON public.price_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create RLS policies
CREATE POLICY "Users can view price categories in their organization"
  ON public.price_categories FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Super Admins can create price categories"
  ON public.price_categories FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Super Admins can update price categories"
  ON public.price_categories FOR UPDATE
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Super Admins can delete price categories"
  ON public.price_categories FOR DELETE
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );
