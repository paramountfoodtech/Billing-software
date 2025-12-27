# 🚀 Quick Start Guide

## 1️⃣ Database Setup (5 minutes)

### In Supabase Dashboard → SQL Editor:

```sql
-- 1. Run scripts/001_create_tables.sql
-- 2. Run scripts/005_complete_rls_fix.sql
-- 3. Run scripts/006_add_organizations.sql
-- 4. Run scripts/008_add_client_pricing.sql
-- 5. Run scripts/009_simplify_roles.sql
```

## 2️⃣ Create First Admin (2 minutes)

### In Supabase Dashboard → Authentication → Users:

1. Click "Add user" → "Create new user"
2. Email: `admin@yourcompany.com`
3. Password: `YourSecurePassword123`
4. Click "Create user"

### In Supabase SQL Editor:

```sql
-- Update the user to super_admin role
UPDATE public.profiles 
SET role = 'super_admin' 
WHERE email = 'admin@yourcompany.com';
```

## 3️⃣ Configure Environment (1 minute)

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

Get these from: Supabase Dashboard → Project Settings → API

## 4️⃣ Start Application (1 minute)

```bash
npm install
npm run dev
```

Open: http://localhost:3000

## 5️⃣ First Login & Setup (5 minutes)

### Login as Super Admin
- Email: `admin@yourcompany.com`
- Password: (your password)

### Create Your First Client
1. Navigate to **Clients** → **Add Client**
2. Fill in: Name, Email, Phone, Address
3. Click "Create Client"

### Create Your First Product
1. Navigate to **Products** → **Add Product**
2. Fill in:
   - Name: "Consulting Services"
   - Paper Price: $100
   - Unit Price: $100
   - Unit: "hour"
   - Tax Rate: 0
3. Click "Create Product"

### Set Client-Specific Pricing (Optional)
1. Navigate to **Client Pricing** → **Add Pricing Rule**
2. Select Client & Product
3. Choose Rule Type:
   - **Discount 10%**: Enter 10
   - **Markup 25%**: Select Multiplier, enter 1.25
   - **Flat $20 off**: Select Flat Discount, enter 20
4. Click "Create Pricing Rule"

### Create an Accountant User
1. Navigate to **Users** → **Create New User**
2. Fill in:
   - Full Name: "John Accountant"
   - Email: `accountant@yourcompany.com`
   - Password: `SecurePassword123`
   - Role: Accountant
3. Click "Create User"

### Create Your First Invoice
1. Navigate to **Invoices** → **Create Invoice**
2. Select Client
3. Add Item:
   - Select Product
   - Enter Quantity: 10
   - **Price is automatically calculated with client rules!**
4. Set dates
5. Click "Create Invoice"

## 6️⃣ What's Next?

### As Admin:
- ✅ Add more clients
- ✅ Add more products
- ✅ Set up pricing rules for different clients
- ✅ Generate invoices
- ✅ Record payments
- ✅ View reports

### As Accountant:
- ✅ Update paper prices on products
- ✅ Create invoices (pricing auto-applies!)
- ✅ Record payments
- ✅ View reports

---

## 💡 Key Concepts

### Paper Price vs Unit Price
- **Paper Price**: Base price for calculations
- **Unit Price**: Default selling price
- Client rules apply to Paper Price

### Pricing Rule Types

**Percentage Discount** (most common)
- Input: 10
- Calculation: Paper Price × (1 - 10/100)
- Example: $100 → $90

**Multiplier** (for markup)
- Input: 1.25
- Calculation: Paper Price × 1.25
- Example: $100 → $125

**Flat Discount**
- Input: 15
- Calculation: Paper Price - 15
- Example: $100 → $85

---

## 🔗 Important URLs

- `/dashboard` - Overview
- `/dashboard/clients` - Manage Clients (Admin)
- `/dashboard/products` - Manage Products (Super Admin + Admin + Accountant)
- `/dashboard/client-pricing` - Custom Pricing (Super Admin + Admin)
- `/dashboard/invoices` - Invoices (All)
- `/dashboard/payments` - Payments (All)
- `/dashboard/reports` - Analytics (Super Admin + Admin)
- `/dashboard/users` - Create Users (Super Admin Only)

---

## ⚠️ Important Notes

1. **No Public Signup**: Users can only be created by super admins
2. **First User Must Be Super Admin**: Create via Supabase Dashboard
3. **Run All 5 Scripts**: Don't skip any migration scripts
4. **Paper Price Required**: All products need a paper price
5. **Client Rules Optional**: If no rule, uses default unit price
6. **Three Roles**: Super Admin (full access), Admin (view-only for super admin areas), and Accountant (limited access)

---

## 🆘 Troubleshooting

### Can't login?
- Check `.env.local` has correct Supabase credentials
- Verify user exists in Supabase Auth dashboard

### Pricing not calculating?
- Verify script 008 was run
- Check client pricing rules exist
- Ensure paper_price is set on product

### Can't create users?
- Only admins can create users
- Check your role in profiles table

### Database errors?
- Ensure all 4 migration scripts ran successfully
- Check Supabase logs for errors

---

## 📚 More Help

- [README.md](README.md) - Full documentation
- [WORKFLOW_GUIDE.md](WORKFLOW_GUIDE.md) - Detailed workflows
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Technical details

---

**You're all set! Start building your invoices! 🎉**
