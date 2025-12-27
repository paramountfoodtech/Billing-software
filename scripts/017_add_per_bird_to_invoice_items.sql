-- Add per-bird fields to invoice_items table
ALTER TABLE public.invoice_items 
ADD COLUMN IF NOT EXISTS bird_count INTEGER,
ADD COLUMN IF NOT EXISTS per_bird_adjustment DECIMAL(10, 2);

-- Add comment for clarity
COMMENT ON COLUMN public.invoice_items.bird_count IS 'Number of birds for per-bird pricing calculation';
COMMENT ON COLUMN public.invoice_items.per_bird_adjustment IS 'Total per-bird adjustment amount applied to line total';
