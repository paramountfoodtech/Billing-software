-- Add reference_number column to invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS reference_number TEXT UNIQUE;

-- Create index for reference_number for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_reference_number ON public.invoices(reference_number);
