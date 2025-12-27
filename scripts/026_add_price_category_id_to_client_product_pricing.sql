-- ============================================================================
-- Add price_category_id column to client_product_pricing table
-- ============================================================================

-- Add price_category_id column (nullable, can be NULL for legacy pricing rules)
ALTER TABLE public.client_product_pricing
ADD COLUMN IF NOT EXISTS price_category_id UUID REFERENCES public.price_categories(id) ON DELETE SET NULL;

-- Create index for faster lookups by category
CREATE INDEX IF NOT EXISTS idx_client_product_pricing_category_id ON public.client_product_pricing(price_category_id);

-- COMMENT FOR CLARITY
COMMENT ON COLUMN public.client_product_pricing.price_category_id IS 'Links this pricing rule to a price category for category-based pricing (nullable for legacy pricing rules)';
