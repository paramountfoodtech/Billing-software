# Database Setup Instructions

After running the initial 3 migration scripts (001, 005, 006), you need to run this additional script to enable client-specific pricing functionality.

## Migration Script: 008_add_client_pricing.sql

This script adds the following functionality:

### 1. **Paper Price Column**
- Adds `paper_price` field to the `products` table
- This is the base price used for calculations before client-specific adjustments

### 2. **Client Product Pricing Table**
- Creates a new table to store custom pricing rules per client-product combination
- Supports three types of pricing rules:
  - **discount_percentage**: Apply a percentage discount (e.g., 10 = 10% off)
  - **discount_flat**: Apply a flat discount amount (e.g., 5 = $5 off)  
  - **multiplier**: Multiply the paper price (e.g., 1.25 = 25% markup)

### 3. **Row Level Security (RLS)**
- Ensures pricing rules are organization-specific
- Only admins can create/modify pricing rules

## How to Run

1. Open your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `scripts/008_add_client_pricing.sql`
4. Paste and execute in the SQL Editor

## Pricing Calculation Flow

When creating an invoice:

1. **Select a client** - The system identifies which client you're billing
2. **Add products** - For each product, the system:
   - Checks if there's a client-specific pricing rule
   - If rule exists: Applies the rule to the paper_price
   - If no rule: Uses the default unit_price
3. **Calculate totals** - Applies quantity, tax, and discounts to the final price

## Example

**Product**: Premium Paper  
**Paper Price**: $100

**Client A** - No special pricing → Uses default unit_price ($100)  
**Client B** - 10% discount rule → Final price: $90  
**Client C** - Multiplier 1.25 → Final price: $125  
**Client D** - Flat $15 discount → Final price: $85

This allows flexible per-client pricing while maintaining a base price for all products.
