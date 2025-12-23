# Invoice Pro - Billing Management System

A professional billing and invoice management system built with Next.js 14, Supabase, and TypeScript.

## Features

- 🔐 **Authentication** - Secure login with role-based access control
- 👥 **Client Management** - Manage customer information and contacts
- 📦 **Product Catalog** - Track products/services with pricing and tax rates
- 📄 **Invoice Generation** - Create professional invoices with automatic calculations
- 💰 **Payment Tracking** - Record and track payments against invoices
- 📊 **Reports & Analytics** - Comprehensive business insights and financial reports
- 🏢 **Multi-Tenancy** - Organization-based data isolation
- 👤 **User Management** - Role-based permissions (Super Admin, Admin, Accountant)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth
- **UI Components**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS
- **Package Manager**: pnpm

## Getting Started

### Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- A Supabase account and project

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd BillingManagementSystem
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy your project URL and anon key

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/dashboard
```

### 5. Set Up the Database

In your Supabase project, go to the SQL Editor and run these scripts **in order**:

1. `scripts/001_create_tables.sql` - Creates all tables and basic structure
2. `scripts/005_complete_rls_fix.sql` - Sets up Row Level Security policies
3. `scripts/006_add_organizations.sql` - Adds multi-tenancy support
4. `scripts/008_add_client_pricing.sql` - Adds client-specific pricing functionality
5. `scripts/009_simplify_roles.sql` - **NEW** Simplifies to admin and accountant roles only

```sql
-- Copy and paste each script into the SQL Editor and execute
```

### 6. Run the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 7. Create Your First Admin User

**IMPORTANT**: The first user must be created manually in Supabase to become an admin.

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter email and password
4. After creating, go to SQL Editor and run:
```sql
-- Replace 'USER_EMAIL_HERE' with the email you just created
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'USER_EMAIL_HERE';
```
5. Now login with this admin account
6. Admins can create more users (accountants) from the dashboard

**After first admin is created:**
- Public signup is disabled for security
- Only admins can create new accountant users via `/dashboard/users/new`

## Project Structure

```
BillingManage & Permissions

### Admin
- ✅ Create and manage clients
- ✅ Create and manage products (including paper prices)
- ✅ Set client-specific pricing rules (discounts/multipliers)
- ✅ Create and manage invoices
- ✅ Record and update payments
- ✅ View reports and analytics
- ✅ Create new accountant users
- ✅ Manage templates
- ❌ Cannot access system settings (super_admin only)

### Accountant
- ✅ Update paper prices on products
- ✅ Create invoices with client-specific pricing applied automatically
- ✅ Record and update payments
- ✅ View and manage reports/analytics
- ❌ Cannot create/edit clients
- ❌ Cannot create/edit products (except paper price)
- ❌ Cannot set client-specific pricing rules
- ❌ Cannot create users

### Super Admin (First user/System owner)
- ✅ All admin permissions
- ✅ User management
- ✅ Organization settings
- ✅ System configuration
- User management
- Organization settings
- All CRUD operations

### Admin
- Manage clients, products, invoices, payments
- View reports
- Cannot manage users or settings

### Accountant
- View and create invoices
- Record payments
- View reports
- Limited access to clients and products

## Database Schema

- **🎯 Client-Specific Pricing (NEW!)
- Set custom pricing rules per client per product
- Three rule types:
  - **Percentage Discount**: 10% off paper price
  - **Flat Discount**: $5 off paper price
  - **Multiplier**: Paper price × 1.25 (for markup)
- Automatically applied when creating invoices
- Admin-only feature

### 📄 Invoice Management
- Create invoices with automatic price calculations
- Client-specific pricing automatically applied
- Support for multiple line items
- Tax and discount calculations
- Status tracking (draft, sent, paid, overdue, cancelled)
- Payment history tracking

### 📦 Product Management  
- **Paper Price**: Base price for calculations
- **Unit Price**: Default selling price
- Accountants can update paper prices
- Products used with client-specific rules

### 💰 Payment Tracking
- Record payments against invoices
- Multiple payment methods
- Automatic balance calculation

### 📊 Financial Reports
- Revenue trends by month
- Top clients by revenue
- Outstanding invoices
- Payment history

### 👥 User Management
- Admin creates accountant users
- No public signup (security)
- Role-based access control
- Revenue trends by month
- Top clients by revenue
- Outstanding invoices
- Payment history

### Security
- Row Level Security (RLS) policies
- Organization-based data isolation
- Role-based access control
- Secure authentication with Supabase

## Development

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint
```

## License

This project is private and proprietary.

## Support

For issues and questions, please open an issue in the repository.
