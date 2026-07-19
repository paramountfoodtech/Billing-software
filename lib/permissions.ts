export function isSuperAdmin(role?: string | null): boolean {
  return role === "super_admin";
}

export function isAdmin(role?: string | null): boolean {
  return role === "admin";
}

/** Super Admin or Admin — for modules like expenses and ops reports. */
export function isAdminOrAbove(role?: string | null): boolean {
  return role === "super_admin" || role === "admin";
}

/** Create new records (admin + super_admin for restricted modules). */
export function canCreate(role?: string | null): boolean {
  return isAdminOrAbove(role);
}

/** Edit/update existing records — Super Admin only. */
export function canEdit(role?: string | null): boolean {
  return isSuperAdmin(role);
}

/**
 * Invoice edit access:
 * - Blank/Cancelled (draft) invoices can be completed by any role that creates invoices
 * - All other statuses: Super Admin only
 */
export function canEditInvoice(
  role?: string | null,
  status?: string | null,
): boolean {
  if (status === "draft") {
    return (
      role === "super_admin" || role === "admin" || role === "accountant"
    );
  }
  return isSuperAdmin(role);
}

/** Delete existing records — Super Admin only. */
export function canDelete(role?: string | null): boolean {
  return isSuperAdmin(role);
}

export function canAccessExpenses(role?: string | null): boolean {
  return isAdminOrAbove(role);
}

export function canAccessOperationsReports(role?: string | null): boolean {
  return isAdminOrAbove(role);
}

export function canEditChallan(challan: { status: string }): boolean {
  return challan.status === "draft";
}

export function canDeleteChallan(challan: {
  status: string;
  purchase_invoice_id: string | null;
}): boolean {
  if (challan.status === "draft" || challan.status === "final") {
    return true;
  }

  return challan.status === "invoiced" && !challan.purchase_invoice_id;
}
