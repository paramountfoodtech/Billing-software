# Daily Price Categories Implementation Guide

## Overview
This document outlines the implementation of daily price categories for the Billing Management System. This feature allows admins to manage 4 global price categories (Paper Price, Skinless, With Skin, Eggs) with prices that update daily, replacing the static product-based pricing system.

## Architecture

### Database Schema Changes

#### 1. New Tables Created

**price_categories**
```sql
id: UUID PRIMARY KEY
organization_id: UUID (unique per org)
name: TEXT (e.g., "Paper Price", "Skinless", "With Skin", "Eggs")
description: TEXT (optional)
created_by: UUID REFERENCES profiles(id)
created_at: TIMESTAMPTZ
updated_at: TIMESTAMPTZ

UNIQUE(organization_id, name)
```

**price_category_history**
```sql
id: UUID PRIMARY KEY
price_category_id: UUID REFERENCES price_categories(id) ON DELETE CASCADE
organization_id: UUID
price: DECIMAL(10, 4)
effective_date: DATE (YYYY-MM-DD format)
created_by: UUID REFERENCES profiles(id)
created_at: TIMESTAMPTZ

UNIQUE(price_category_id, effective_date)  -- One price per category per day
```

#### 2. Modified Tables

**client_product_pricing**
Added columns:
- `price_category_id: UUID REFERENCES price_categories(id)` (nullable)
- Changed `price_rule_type` CHECK constraint to include `'category_based'`
- Made `price_rule_value` nullable (not needed for category-based rules)

```sql
-- Before:
price_rule_type CHECK (price_rule_type IN ('discount_percentage', 'discount_flat', 'multiplier'))
price_rule_value DECIMAL(10, 4) NOT NULL

-- After:
price_rule_type CHECK (price_rule_type IN ('discount_percentage', 'discount_flat', 'multiplier', 'category_based'))
price_rule_value DECIMAL(10, 4)  -- Nullable
```

#### 3. Database Indexes
```sql
idx_price_categories_organization_id     -- Speed up org lookups
idx_price_category_history_category_id   -- Speed up history lookups
idx_price_category_history_org_date      -- Speed up date-based lookups
```

#### 4. RLS Policies
All price tables have organization-level RLS:
- Users can view their organization's price data
- Only admins can create/update/delete
- Automatic organization_id filtering on all queries

#### 5. Trigger Function
```sql
create_initial_price_entry()
  - Automatically creates a price_category_history entry when a new category is created
  - Uses current date as the effective_date
  - Seed price defaults to 0 (admin must update)
```

### File Structure

#### New Components
```
components/
├── price-form.tsx          -- Dual-mode form for editing categories and adding daily prices
├── prices-table.tsx        -- Display categories with current prices and price history
└── client-pricing-form.tsx -- UPDATED: Now supports category-based pricing rules
```

#### New Pages
```
app/dashboard/prices/
├── page.tsx                -- Main prices management hub
├── new/
│   └── page.tsx           -- Add daily price updates
└── [id]/edit/
    └── page.tsx           -- Edit category metadata
```

#### Updated Components
```
components/
├── client-pricing-form.tsx  -- Added category-based pricing option
├── client-pricing-table.tsx -- Updated to display category-based rules
└── dashboard-nav.tsx        -- Added Prices tab with Tag icon
```

#### Updated Files
```
lib/
└── utils.ts               -- Added pricing calculation utilities
```

## UI/UX Implementation

### Prices Management Page (`/dashboard/prices`)
**Features:**
- Two-table display:
  1. **Price Categories Table**: Shows name, current price (dynamic), description
  2. **Price History Table**: Shows category, price, effective_date, created_at
- "Add Price Update" button (not "Add Price Category")
- Edit/delete actions for both categories and price updates
- Admin-only access

**Layout:**
- Matches other dashboard pages: `p-6 lg:p-8`
- Professional card-based design with proper spacing
- Color-coded pricing (green text for prices)

### Price Form (`price-form.tsx`)
**Dual-Mode Design:**

1. **Edit Mode** (for category metadata):
   - Category name input
   - Description textarea
   - Used by: `/dashboard/prices/[id]/edit`

2. **Create Mode** (for daily price updates):
   - Category dropdown (fetches from database)
   - Effective date picker (date input)
   - Price input (decimal)
   - Used by: `/dashboard/prices/new`

**Error Handling:**
- Toast notifications for all operations (success/error)
- Form validation for required fields
- Loading states with Spinner component

### Client Pricing Form (`client-pricing-form.tsx`)
**New Feature: Category-Based Pricing**

Updated to support 4 pricing methods:
1. **Use Daily Price Category** (NEW)
   - Select price category from dropdown
   - Invoice uses category price on invoice date
   - Price updates automatically when admin updates category price
   
2. **Discount Percentage** (existing)
   - Applied to base product price
   - Example: 10% discount

3. **Discount Flat Amount** (existing)
   - Applied to base product price
   - Example: ₹5 off

4. **Multiplier** (existing)
   - Applied to base product price
   - Example: 1.25x for 25% markup

**Form Flow:**
1. Select pricing method
2. If category-based: select category
3. If other: enter rule value
4. Preview calculation (for non-category rules)

**Status Display:**
- Category-based rules: Show "Dynamic (Daily)" in price column
- Other rules: Show calculated final price

### Client Pricing Table Updates
**Column Changes:**
- "Rule Value" column now shows category name for category-based rules
- "Final Price" column shows "Dynamic (Daily)" for category-based rules
- Price category rules highlighted with `badge variant="default"` (primary color)

## Implementation Utilities

### `lib/utils.ts` - Pricing Functions

**1. `calculatePriceFromRule(basePrice, ruleType, ruleValue)`**
```typescript
// Calculate final price based on rule type
const finalPrice = calculatePriceFromRule(100, 'discount_percentage', 10)
// Returns: 90
```

**2. `getPriceForCategoryOnDate(categoryId, onDate, priceHistory)`**
```typescript
// Get the price for a category on a specific date
const price = getPriceForCategoryOnDate(categoryId, '2024-01-15', priceHistory)
// Returns: 250 (price effective on 2024-01-15)
```

## Invoice Integration (Future Implementation)

When invoices are created/updated, the system will:

1. **For Category-Based Pricing Rules:**
   ```typescript
   // Get the category price on invoice date
   const categoryPrice = getPriceForCategoryOnDate(
     rule.price_category_id,
     invoice.issue_date,
     priceHistory
   )
   // Use categoryPrice for line items
   ```

2. **For Traditional Rules:**
   ```typescript
   // Continue using existing rule calculation
   const finalPrice = calculatePriceFromRule(
     basePrice,
     rule.price_rule_type,
     rule.price_rule_value
   )
   ```

## User Flow

### For Admins: Setting Up Price Categories

1. **First Time Setup:**
   - Navigate to Prices tab
   - Click "Add Price Update" (system creates category if not exists)
   - For each of 4 categories:
     - Paper Price
     - Skinless
     - With Skin
     - Eggs

2. **Daily Price Updates:**
   - Open Prices tab
   - Click "Add Price Update"
   - Select category
   - Enter effective date (today or future date)
   - Enter price
   - Save

3. **Category Management:**
   - Edit category name/description via edit button
   - Delete old price entries
   - View price history

### For Creating Client-Specific Pricing Rules

1. **Navigate to Client Pricing**
2. **Create New Rule:**
   - Select client
   - Select product
   - Choose pricing method:
     - **Category-Based:** Select Paper Price/Skinless/With Skin/Eggs
     - **Traditional:** Select discount/multiplier type and value
3. **Save Rule**

### When Creating Invoices

- System automatically applies pricing rule:
  - **Category-Based:** Uses price effective on invoice date
  - **Traditional:** Calculates from base price + rule value
- Invoice items show correct prices
- System ensures consistency across all transactions

## Data Flow

```
Admin Updates Daily Prices
           ↓
  price_category_history table
           ↓
Invoice Creation
           ↓
  Query: Get rule for (client, product)
           ↓
  Check: rule.price_rule_type
           ├─→ category_based: 
           │    └─→ Query price_category_history
           │        for (category_id, invoice_date)
           │
           └─→ discount_percentage|discount_flat|multiplier:
                └─→ Calculate from base_price + rule_value
           ↓
Invoice Items with Correct Prices
```

## Database Migrations (If Existing Data)

For systems with existing products and pricing:

```sql
-- Example: Backfill Paper Price category from product.paper_price
INSERT INTO price_categories (organization_id, name, description, created_by)
SELECT DISTINCT organization_id, 'Paper Price', 'Base paper prices for products', created_by
FROM products
WHERE organization_id = $1;

-- Get the category ID
SELECT id INTO category_id FROM price_categories
WHERE organization_id = $1 AND name = 'Paper Price'
LIMIT 1;

-- Backfill price history from product prices
INSERT INTO price_category_history (price_category_id, organization_id, price, effective_date, created_by)
SELECT category_id, organization_id, AVG(paper_price), NOW()::DATE, created_by
FROM products
WHERE organization_id = $1
GROUP BY organization_id, created_by;
```

## Validation & Error Handling

### Price Categories
- Name: Required, max 100 chars
- Description: Optional, max 500 chars
- Organization: Auto-populated from auth user

### Price History
- Category: Required (dropdown select)
- Effective Date: Required (date input)
- Price: Required, must be positive decimal
- Unique constraint: One price per category per day

### Client Pricing Rules
- Client: Required
- Product: Required
- Pricing Method: Required
- Rule Value: Required for non-category rules
- Category: Required for category-based rules
- Unique constraint: One rule per (client, product)

## Testing Checklist

- [ ] Create first price category
- [ ] Verify trigger creates initial price_category_history entry
- [ ] Add price update for today
- [ ] Add price update for tomorrow
- [ ] Verify getLatestPrice returns correct price for each date
- [ ] Edit category name/description
- [ ] Delete price history entry
- [ ] Delete category (cascades to price_category_history)
- [ ] Create client pricing rule with category-based method
- [ ] Verify category-based rule shows "Dynamic (Daily)" in table
- [ ] Create client pricing rule with traditional method
- [ ] Verify traditional rule shows calculated price in table
- [ ] Create invoice with category-based rule
- [ ] Verify invoice uses price effective on invoice date
- [ ] Create invoice with traditional rule
- [ ] Verify invoice uses calculated price

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile-responsive design using Tailwind CSS
- No special polyfills needed

## Performance Considerations

### Database Optimization
- Indexes on: organization_id, category_id, (category_id, effective_date)
- RLS policies automatically filter by organization_id
- Query optimization: SELECT price WHERE category_id = $1 AND effective_date <= $2 ORDER BY effective_date DESC LIMIT 1

### Frontend Optimization
- Price categories fetched once per form
- Price history passed from server component
- getLatestPrice() function cached in component state
- No unnecessary re-renders with proper React key props

## Future Enhancements

1. **Bulk Price Updates:** Upload CSV with daily prices for all categories
2. **Price History Charts:** Visualize price trends over time
3. **Price Forecasting:** Set future prices in advance
4. **Price Alerts:** Notify when price changes exceed threshold
5. **Price Versioning:** Track who changed prices and when
6. **Multi-Currency:** Support different currencies per organization
7. **Tiered Pricing:** Different prices based on quantity ranges
8. **Seasonal Pricing:** Predefined price schedules for seasons

## Troubleshooting

### Issue: "No price set" showing in categories table
- **Cause:** Trigger didn't create initial price_category_history entry
- **Solution:** Manually add price update for today via "Add Price Update" button

### Issue: Category-based rule not showing correct price in invoice
- **Cause:** Price for that date doesn't exist in price_category_history
- **Solution:** Ensure price_category_history has entry for invoice_date <= effective_date

### Issue: Dropdown shows no categories when creating pricing rule
- **Cause:** No price categories created yet
- **Solution:** Go to Prices tab and create categories first

## Support & Documentation

For questions or issues:
1. Check DAILY_PRICING_IMPLEMENTATION.md (this file)
2. Review database schema in complete_database_setup.sql
3. Check component implementations for usage examples
4. Review RLS policies for permission issues

---

**Last Updated:** Session Phase 9
**Status:** Implemented & Ready for Testing
**Integration:** Invoice and Pricing Rules ready for category-based pricing support
