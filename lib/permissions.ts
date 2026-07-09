export function isSuperAdmin(role?: string | null): boolean {
  return role === "super_admin";
}

export function canEdit(role?: string | null): boolean {
  return isSuperAdmin(role);
}

export function canDelete(role?: string | null): boolean {
  return isSuperAdmin(role);
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
