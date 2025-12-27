-- ============================================================================
-- Add missing due_days column to clients table
-- ============================================================================

ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS due_days INTEGER NOT NULL DEFAULT 30;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_clients_due_days ON public.clients(due_days);
