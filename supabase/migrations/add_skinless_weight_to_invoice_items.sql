-- Add skinless_weight column to invoice_items table
-- This field is used when the price category is "Live" in pricing rules
-- It is independent of the invoice calculation (for reporting purposes only)

ALTER TABLE invoice_items 
ADD COLUMN IF NOT EXISTS skinless_weight DECIMAL(10,2);

COMMENT ON COLUMN invoice_items.skinless_weight IS 'Skinless weight for Live category products (independent of invoice calculations, used for reports)';