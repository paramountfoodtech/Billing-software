-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'invoice_note', 'payment_note', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  reference_id UUID, -- ID of the related invoice/payment
  reference_type VARCHAR(50), -- 'invoice', 'payment'
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_reference ON notifications(reference_type, reference_id);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true); -- Will be controlled by application logic

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- Function to create notifications when invoice notes are added
CREATE OR REPLACE FUNCTION notify_users_on_invoice_note()
RETURNS TRIGGER AS $$
DECLARE
  reference_number TEXT;
  note_author_name TEXT;
  target_user RECORD;
BEGIN
  -- Get invoice number
  SELECT invoice_number INTO reference_number FROM invoices WHERE id = NEW.invoice_id;

  -- Get note author name
  SELECT full_name INTO note_author_name FROM profiles WHERE id = NEW.created_by;

  -- Notify all active users in the same organization except the author
  FOR target_user IN 
    SELECT p.id 
    FROM profiles p
    WHERE p.organization_id = (SELECT organization_id FROM profiles WHERE id = NEW.created_by)
    AND p.id != NEW.created_by
    AND p.is_active = true
  LOOP
    INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (
      target_user.id,
      'invoice_note',
      CONCAT('New note on Invoice ', reference_number),
      CONCAT(note_author_name, ' added a note: ', LEFT(NEW.note, 100), CASE WHEN LENGTH(NEW.note) > 100 THEN '...' ELSE '' END),
      NEW.invoice_id,
      'invoice'
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create notifications when payment notes are added
CREATE OR REPLACE FUNCTION notify_users_on_payment_note()
RETURNS TRIGGER AS $$
DECLARE
  note_author_name TEXT;
  target_user RECORD;
BEGIN
  -- Get note author name
  SELECT full_name INTO note_author_name FROM profiles WHERE id = NEW.created_by;

  -- Notify all active users in the same organization except the author
  FOR target_user IN 
    SELECT p.id 
    FROM profiles p
    WHERE p.organization_id = (SELECT organization_id FROM profiles WHERE id = NEW.created_by)
    AND p.id != NEW.created_by
    AND p.is_active = true
  LOOP
    INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (
      target_user.id,
      'payment_note',
      CONCAT('New note on Payment'),
      CONCAT(note_author_name, ' added a note: ', LEFT(NEW.note, 100), CASE WHEN LENGTH(NEW.note) > 100 THEN '...' ELSE '' END),
      NEW.payment_id,
      'payment'
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS notify_on_invoice_note ON invoice_notes;
DROP TRIGGER IF EXISTS notify_on_payment_note ON payment_notes;

-- Drop old function if exists
DROP FUNCTION IF EXISTS notify_users_on_note();

-- Create separate triggers
CREATE TRIGGER notify_on_invoice_note
  AFTER INSERT ON invoice_notes
  FOR EACH ROW
  EXECUTE FUNCTION notify_users_on_invoice_note();

CREATE TRIGGER notify_on_payment_note
  AFTER INSERT ON payment_notes
  FOR EACH ROW
  EXECUTE FUNCTION notify_users_on_payment_note();
