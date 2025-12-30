-- Add position/order columns to price_categories and products tables for drag-and-drop reordering

-- Add position column to price_categories
ALTER TABLE public.price_categories
ADD COLUMN IF NOT EXISTS position INTEGER;

-- Set initial positions based on name (alphabetical)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY name) as pos
  FROM public.price_categories
)
UPDATE public.price_categories
SET position = ranked.pos
FROM ranked
WHERE public.price_categories.id = ranked.id;

-- Make position NOT NULL after setting values
ALTER TABLE public.price_categories
ALTER COLUMN position SET NOT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_price_categories_position ON public.price_categories(organization_id, position);

-- Add position column to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS position INTEGER;

-- Set initial positions based on name (alphabetical)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY name) as pos
  FROM public.products
)
UPDATE public.products
SET position = ranked.pos
FROM ranked
WHERE public.products.id = ranked.id;

-- Make position NOT NULL after setting values
ALTER TABLE public.products
ALTER COLUMN position SET NOT NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_position ON public.products(organization_id, position);

-- Add comments
COMMENT ON COLUMN public.price_categories.position IS 'Display order position for drag-and-drop reordering';
COMMENT ON COLUMN public.products.position IS 'Display order position for drag-and-drop reordering';
