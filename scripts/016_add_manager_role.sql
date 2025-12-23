-- Add manager role to user_role enum if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'manager'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'manager';
  END IF;
END;
$$;

-- Optional: verify roles present
-- SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'user_role';
