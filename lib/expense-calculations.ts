export type ExpenseDiscountType = "none" | "percent" | "flat";

export function calculateExpenseAmounts(input: {
  units: number;
  unitCost: number;
  gstAmount: number;
  discountType: ExpenseDiscountType;
  discountValue: number;
}) {
  const subtotal = Math.max(0, input.units * input.unitCost);
  const discountAmount =
    input.discountType === "percent"
      ? Math.min(subtotal, (subtotal * Math.max(0, input.discountValue)) / 100)
      : input.discountType === "flat"
        ? Math.min(subtotal, Math.max(0, input.discountValue))
        : 0;
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const totalAmount = Math.max(0, afterDiscount + Math.max(0, input.gstAmount));

  return {
    subtotal,
    discountAmount,
    totalAmount,
  };
}
