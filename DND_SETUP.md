# Drag-and-Drop Reordering Setup

## Step 1: Install Dependencies

Run the following command to install the required drag-and-drop library:

```bash
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

## Step 2: Run Database Migration

Execute the migration script in your Supabase SQL Editor:

```sql
-- Run: scripts/018_add_position_columns.sql
```

This will add `position` columns to both `price_categories` and `products` tables.

## Step 3: Implementation Complete

The following components have been updated with drag-and-drop functionality:
- Categories Management (`components/categories-management.tsx`)
- Products Table (`components/products-table.tsx`)
- Prices Table (`components/prices-table.tsx`)

## Features

- Drag and drop to reorder categories and products
- Position is saved automatically to the database
- Visual feedback during drag operations
- Drag handle icon for better UX
- Works per organization (positions are scoped to organization_id)

## Usage

1. Look for the drag handle icon (⋮⋮) on the left side of each row
2. Click and hold the drag handle
3. Drag the row to the desired position
4. Release to save the new order

The new order is persisted immediately to the database.
