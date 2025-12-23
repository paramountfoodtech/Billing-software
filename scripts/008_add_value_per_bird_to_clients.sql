-- Adds per-bird adjustment for clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS value_per_bird DECIMAL(10,2) DEFAULT 0;
