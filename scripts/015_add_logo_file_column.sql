-- 015_add_logo_file_column.sql
-- Adds company_logo_file column to invoice_templates for direct file upload support

-- Add the column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'invoice_templates' 
    AND column_name = 'company_logo_file'
  ) THEN
    ALTER TABLE public.invoice_templates 
    ADD COLUMN company_logo_file TEXT;
  END IF;
END $$;
