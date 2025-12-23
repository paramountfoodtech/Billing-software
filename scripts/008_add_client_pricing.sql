-- Add paper_price field to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS paper_price DECIMAL(10, 2);

-- Update existing products to have paper_price equal to unit_price
UPDATE public.products SET paper_price = unit_price WHERE paper_price IS NULL;

-- Make paper_price NOT NULL after setting values
ALTER TABLE public.products ALTER COLUMN paper_price SET NOT NULL;

-- Create client-product pricing rules table
CREATE TABLE IF NOT EXISTS public.client_product_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  price_rule_type TEXT NOT NULL CHECK (price_rule_type IN ('discount_percentage', 'discount_flat', 'multiplier')),
  price_rule_value DECIMAL(10, 4) NOT NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, product_id)
);

-- Enable RLS on client_product_pricing
ALTER TABLE public.client_product_pricing ENABLE ROW LEVEL SECURITY;

-- Policies for client_product_pricing
CREATE POLICY "Users can view pricing in their organization"
  ON public.client_product_pricing FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can create pricing rules"
  ON public.client_product_pricing FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_admin_or_super_admin(auth.uid())
  );

CREATE POLICY "Admins can update pricing rules"
  ON public.client_product_pricing FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_admin_or_super_admin(auth.uid())
  );

CREATE POLICY "Admins can delete pricing rules"
  ON public.client_product_pricing FOR DELETE
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.is_admin_or_super_admin(auth.uid())
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_product_pricing_client_id ON public.client_product_pricing(client_id);
CREATE INDEX IF NOT EXISTS idx_client_product_pricing_product_id ON public.client_product_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_client_product_pricing_organization_id ON public.client_product_pricing(organization_id);

-- Create trigger for updated_at
CREATE TRIGGER update_client_product_pricing_updated_at
  BEFORE UPDATE ON public.client_product_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment to describe the table
COMMENT ON TABLE public.client_product_pricing IS 'Stores client-specific pricing rules for products (discounts or multipliers)';
COMMENT ON COLUMN public.client_product_pricing.price_rule_type IS 'Type of pricing rule: discount_percentage (10 = 10% off), discount_flat (10 = $10 off), multiplier (1.25 = price * 1.25)';
COMMENT ON COLUMN public.client_product_pricing.price_rule_value IS 'Value for the pricing rule based on type';
