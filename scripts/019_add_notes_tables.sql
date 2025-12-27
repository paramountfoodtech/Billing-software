-- Create invoice_notes table
CREATE TABLE IF NOT EXISTS invoice_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create payment_notes table
CREATE TABLE IF NOT EXISTS payment_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_notes_invoice_id ON invoice_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_notes_created_at ON invoice_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_notes_payment_id ON payment_notes(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_notes_created_at ON payment_notes(created_at DESC);

-- Enable RLS
ALTER TABLE invoice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_notes
CREATE POLICY "Users can view invoice notes in their org"
  ON invoice_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
    )
  );

CREATE POLICY "Managers and admins can insert invoice notes"
  ON invoice_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager')
      AND p.is_active = true
    )
  );

CREATE POLICY "Users can update their own invoice notes"
  ON invoice_notes FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can delete any invoice note"
  ON invoice_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- RLS Policies for payment_notes
CREATE POLICY "Users can view payment notes in their org"
  ON payment_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.organization_id IS NOT NULL
    )
  );

CREATE POLICY "Managers and admins can insert payment notes"
  ON payment_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'manager')
      AND p.is_active = true
    )
  );

CREATE POLICY "Users can update their own payment notes"
  ON payment_notes FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can delete any payment note"
  ON payment_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoice_notes_updated_at
  BEFORE UPDATE ON invoice_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();

CREATE TRIGGER update_payment_notes_updated_at
  BEFORE UPDATE ON payment_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_notes_updated_at();
