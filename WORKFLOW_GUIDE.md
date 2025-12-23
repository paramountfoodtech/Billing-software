# User Workflow Guide

## 🔑 Admin Workflow

### 1. Initial Setup
1. **Create Clients** (`/dashboard/clients/new`)
   - Add client name, email, contact info
   - Address details for invoicing

2. **Create Products** (`/dashboard/products/new`)
   - Product/Service name
   - **Paper Price**: Base price for calculations (e.g., $100)
   - **Unit Price**: Default selling price (e.g., $100)
   - Tax rate (if applicable)
   - Unit of measurement

### 2. Set Client-Specific Pricing (`/dashboard/client-pricing/new`)

For each client-product combination where you want custom pricing:

**Option A: Percentage Discount**
- Client: ABC Corp
- Product: Premium Paper
- Rule Type: Discount Percentage
- Value: 10
- Result: Paper price ($100) → Final price ($90)

**Option B: Flat Discount**
- Client: XYZ Ltd
- Product: Premium Paper
- Rule Type: Discount Flat
- Value: 15
- Result: Paper price ($100) → Final price ($85)

**Option C: Multiplier (Markup)**
- Client: VIP Customer
- Product: Premium Paper
- Rule Type: Multiplier
- Value: 1.25
- Result: Paper price ($100) → Final price ($125)

### 3. Manage Users (`/dashboard/users/new`)
- Create accountant users
- Assign appropriate role
- Accountants get auto-created in same organization

### 4. Update Payments (`/dashboard/payments/new`)
- Record payments against invoices
- Multiple payment methods
- Automatic balance tracking

### 5. View Reports (`/dashboard/reports`)
- Revenue analytics
- Client performance
- Outstanding invoices

---

## 📊 Accountant Workflow

### 1. Update Paper Prices (`/dashboard/products`)
- Edit products to update base paper price
- Click "Edit" on any product
- Modify **Paper Price** field
- Price changes affect new invoices automatically

### 2. Create Invoices (`/dashboard/invoices/new`)

**Step-by-step:**

1. **Select Client**
   - Choose from dropdown
   - System loads client-specific pricing rules automatically

2. **Add Line Items**
   - Click "Add Item"
   - Select Product from dropdown
   - **Price is automatically calculated** based on:
     - If client has custom rule → Apply rule to paper price
     - If no custom rule → Use default unit price
   - Enter Quantity
   - Adjust tax rate if needed
   - System calculates line total

3. **Set Dates**
   - Issue date (default: today)
   - Due date (default: 30 days)

4. **Add Notes** (optional)
   - Payment terms
   - Special instructions

5. **Create Invoice**
   - Review totals (subtotal, tax, discount, total)
   - Click "Create Invoice"

### 3. Record Payments (`/dashboard/payments/new`)
- Select invoice
- Enter payment amount
- Choose payment method
- Add reference number
- System updates invoice balance automatically

### 4. View Analytics (`/dashboard/reports`)
- Monthly revenue trends
- Invoice status breakdown
- Payment history
- Client revenue analysis

---

## 💡 Pricing Examples

### Scenario 1: Standard Client (No Custom Pricing)
- **Product**: Consultation Service
- **Paper Price**: $150/hour
- **Unit Price**: $150/hour
- **Client**: Regular Corp (no custom rule)
- **Invoice Price**: $150/hour ✅

### Scenario 2: VIP Client (10% Discount)
- **Product**: Consultation Service
- **Paper Price**: $150/hour
- **Unit Price**: $150/hour
- **Client**: VIP Corp (10% discount rule)
- **Calculation**: $150 × (1 - 0.10) = $135
- **Invoice Price**: $135/hour ✅

### Scenario 3: Premium Client (25% Markup)
- **Product**: Consultation Service
- **Paper Price**: $150/hour
- **Unit Price**: $150/hour
- **Client**: Premium Corp (multiplier 1.25)
- **Calculation**: $150 × 1.25 = $187.50
- **Invoice Price**: $187.50/hour ✅

### Scenario 4: Bulk Discount ($20 off)
- **Product**: Consultation Service
- **Paper Price**: $150/hour
- **Unit Price**: $150/hour
- **Client**: Bulk Corp (flat $20 discount)
- **Calculation**: $150 - $20 = $130
- **Invoice Price**: $130/hour ✅

---

## 🔄 Changing Client Pricing

If you change a client's pricing rule:
- ✅ Applies to **new invoices** immediately
- ❌ Does NOT affect existing/past invoices

---

## 📱 Quick Access Links

**Admin:**
- `/dashboard/clients` - Manage Clients
- `/dashboard/products` - Manage Products
- `/dashboard/client-pricing` - Set Custom Pricing Rules
- `/dashboard/invoices` - View All Invoices
- `/dashboard/users` - Create Accountants

**Accountant:**
- `/dashboard/products` - Update Paper Prices
- `/dashboard/invoices/new` - Create Invoice
- `/dashboard/payments/new` - Record Payment
- `/dashboard/reports` - View Analytics

---

## ❓ FAQ

**Q: What's the difference between Paper Price and Unit Price?**
A: Paper Price is the base for calculations. Unit Price is the default selling price. Client-specific rules apply to Paper Price.

**Q: Can I have multiple pricing rules for one client?**
A: Yes! One rule per client-product combination. A client can have different rules for different products.

**Q: What happens if I change the paper price?**
A: It only affects new invoices. Past invoices keep their original prices.

**Q: Can accountants create clients?**
A: No, only admins can create clients. This ensures proper client management and data quality.

**Q: How do I give someone accountant access?**
A: Admins go to `/dashboard/users/new`, enter email, password, and select "Accountant" role.
