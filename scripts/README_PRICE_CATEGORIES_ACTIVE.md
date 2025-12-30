# Price Categories Active/Inactive Toggle

## Migration Added

File: `017_add_is_active_to_price_categories.sql`

This migration adds an `is_active` boolean column to the `price_categories` table to allow categories to be toggled active/inactive.

## How to Apply

Run the migration script in your Supabase SQL Editor:

```sql
-- Add is_active column to price_categories table
ALTER TABLE public.price_categories
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_price_categories_is_active ON public.price_categories(is_active);

-- Add comment
COMMENT ON COLUMN public.price_categories.is_active IS 'Whether this price category is currently active and available for use';
```

## UI Changes

### Categories Management Page
- Each category card now displays an Active/Inactive toggle switch
- Inactive categories are shown with reduced opacity and an "Inactive" badge
- Toggle can be clicked to activate/deactivate categories instantly
- Status changes are reflected immediately with a success toast

## Features

1. **Toggle Switch**: Quick on/off toggle for each category
2. **Visual Feedback**: Inactive categories have reduced opacity
3. **Badge Indicator**: "Inactive" badge shown for deactivated categories
4. **Default State**: New categories are active by default
5. **No Data Loss**: Deactivating a category doesn't delete it, just marks it inactive

## Future Enhancements

Consider filtering inactive categories from:
- Product pricing rule dropdowns
- Invoice form category selections
- Price history displays (optional - you may want to show historical data)

All existing categories will default to `is_active = true` when the migration runs.
