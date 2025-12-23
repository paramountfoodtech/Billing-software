-- 014_add_invoice_templates.sql
-- Creates invoice template table for customizable invoice printing

-- Create invoice templates table
CREATE TABLE IF NOT EXISTS public.invoice_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  company_address TEXT NOT NULL,
  company_phone TEXT NOT NULL,
  company_email TEXT NOT NULL,
  company_logo_url TEXT,
  company_logo_file TEXT, -- Base64 encoded image data
  tax_label TEXT DEFAULT 'GST',
  terms_and_conditions TEXT DEFAULT 'Payment is due within 30 days. Late payments may incur additional charges.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their organization template"
  ON public.invoice_templates FOR SELECT
  USING (organization_id = public.get_user_organization(auth.uid()));

CREATE POLICY "Admins can insert template"
  ON public.invoice_templates FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "Admins can update template"
  ON public.invoice_templates FOR UPDATE
  USING (
    organization_id = public.get_user_organization(auth.uid())
    AND public.is_admin(auth.uid())
  );

-- Create trigger for updated_at
CREATE TRIGGER update_invoice_templates_updated_at
  BEFORE UPDATE ON public.invoice_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index
CREATE INDEX IF NOT EXISTS idx_invoice_templates_organization_id ON public.invoice_templates(organization_id);
