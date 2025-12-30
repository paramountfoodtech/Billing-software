-- Add is_active column to price_categories table
ALTER TABLE public.price_categories
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_price_categories_is_active ON public.price_categories(is_active);

-- Add comment
COMMENT ON COLUMN public.price_categories.is_active IS 'Whether this price category is currently active and available for use';
