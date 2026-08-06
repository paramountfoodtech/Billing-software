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

/** Any payment recorded on an invoice locks related edits. */
export function hasRecordedPayment(
  amountPaid?: string | number | null,
): boolean {
  return Number(amountPaid || 0) > 0.01;
}

function canEditDraftOrAbove(role?: string | null): boolean {
  return (
    role === "super_admin" || role === "admin" || role === "accountant"
  );
}

/**
 * Sales invoice edit access:
 * - Draft (Blank/Cancelled): Super Admin, Admin, or Accountant
 * - Otherwise: Super Admin only
 * - If any payment is recorded: nobody (including Super Admin)
 */
export function canEditInvoice(
  role?: string | null,
  status?: string | null,
  amountPaid?: string | number | null,
): boolean {
  if (status === "cancelled") return false;
  if (hasRecordedPayment(amountPaid)) return false;
  if (status === "draft") {
    return canEditDraftOrAbove(role);
  }
  return isSuperAdmin(role);
}

/**
 * Purchase invoice edit access:
 * - Draft: Super Admin, Admin, or Accountant
 * - Otherwise (including paid / partially paid): Super Admin only
 * - Cancelled: nobody
 */
export function canEditPurchaseInvoice(
  role?: string | null,
  status?: string | null,
  amountPaid?: string | number | null,
): boolean {
  if (status === "cancelled") return false;
  if (hasRecordedPayment(amountPaid)) {
    return isSuperAdmin(role);
  }
  if (status === "draft") {
    return canEditDraftOrAbove(role);
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

/**
 * Purchase challan edit access:
 * - Draft: Super Admin, Admin, or Accountant
 * - Final / invoiced: Super Admin only
 * - If linked purchase invoice has payment recorded: nobody (including Super Admin)
 */
export function canEditChallan(
  role?: string | null,
  status?: string | null,
  invoiceAmountPaid?: string | number | null,
): boolean {
  if (hasRecordedPayment(invoiceAmountPaid)) return false;
  if (status === "draft") {
    return canEditDraftOrAbove(role);
  }
  return isSuperAdmin(role);
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

export function canAccessPayroll(role?: string | null): boolean {
  return isAdminOrAbove(role);
}

/** Payroll attendance tab — Admin, Super Admin, or Accountant. */
export function canAccessAttendance(role?: string | null): boolean {
  return isAdminOrAbove(role) || role === "accountant";
}

/** Only Super Admin can unlock finalized attendance */
export function canUnlockAttendance(role?: string | null): boolean {
  return isSuperAdmin(role);
}
