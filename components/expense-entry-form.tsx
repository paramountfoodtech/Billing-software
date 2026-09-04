"use client";

import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import {
  getProfileDisplayName,
  logEntryHistory,
} from "@/lib/entry-history";
import { getIndianToday, getIndianCurrentMonth } from "@/lib/date-time";
import {
  calculateExpenseAmounts,
  type ExpenseDiscountType,
} from "@/lib/expense-calculations";
import { canEdit } from "@/lib/permissions";
import { isPaymentReferenceDuplicate } from "@/lib/payment-reference";

export interface ExpenseCategoryOption {
  id: string;
  name: string;
  slug: string | null;
  is_active?: boolean;
}

export interface ExpenseEntryInitial {
  id: string;
  entry_number: string;
  vendor_invoice_number: string | null;
  category_id: string;
  issue_date: string;
  description?: string;
  units: string | number;
  unit_cost: string | number;
  gst_amount: string | number;
  discount_type: ExpenseDiscountType;
  discount_value: string | number;
  entry_month: string | null;
  payment_method?: string | null;
  reference_number?: string | null;
  notes: string | null;
  status: string;
}

interface ExpenseEntryFormProps {
  categories: ExpenseCategoryOption[];
  suggestedEntryNumber: string;
  initialEntry?: ExpenseEntryInitial;
}

const discountTypeOptions = [
  { value: "none", label: "No discount" },
  { value: "percent", label: "Discount %" },
  { value: "flat", label: "Flat discount (₹)" },
];

const paymentMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "check", label: "Check" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other", label: "Other" },
];

export function ExpenseEntryForm({
  categories,
  suggestedEntryNumber,
  initialEntry,
}: ExpenseEntryFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isEditMode = Boolean(initialEntry);

  const defaultCategory =
    categories.find((c) => c.id === initialEntry?.category_id) ||
    categories.find((c) => c.slug === "general") ||
    categories[0];

  const [entryNumber] = useState(
    initialEntry?.entry_number || suggestedEntryNumber,
  );
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState(
    initialEntry?.vendor_invoice_number || "",
  );
  const [categoryId, setCategoryId] = useState(
    initialEntry?.category_id || defaultCategory?.id || "",
  );
  const [issueDate, setIssueDate] = useState(
    initialEntry?.issue_date || getIndianToday(),
  );
  const [entryMonth, setEntryMonth] = useState(() => {
    if (initialEntry?.entry_month) return initialEntry.entry_month;
    const dateForMonth = initialEntry?.issue_date || getIndianToday();
    return dateForMonth.slice(0, 7) || getIndianCurrentMonth();
  });
  /** Once the user edits Month, stop auto-syncing it from Issue Date. */
  const [entryMonthTouched, setEntryMonthTouched] = useState(isEditMode);
  const [units, setUnits] = useState(
    initialEntry ? String(Number(initialEntry.units) || 1) : "1",
  );
  const [unitCost, setUnitCost] = useState(
    initialEntry ? String(Number(initialEntry.unit_cost) || "") : "",
  );
  const [gstAmount, setGstAmount] = useState(
    initialEntry && Number(initialEntry.gst_amount) > 0
      ? String(Number(initialEntry.gst_amount))
      : "",
  );
  const [discountType, setDiscountType] = useState<ExpenseDiscountType>(
    initialEntry?.discount_type || "none",
  );
  const [discountValue, setDiscountValue] = useState(
    initialEntry && Number(initialEntry.discount_value) > 0
      ? String(Number(initialEntry.discount_value))
      : "",
  );
  const [paymentMethod, setPaymentMethod] = useState(
    initialEntry?.payment_method || "bank_transfer",
  );
  const [referenceNumber, setReferenceNumber] = useState(
    initialEntry?.reference_number || "",
  );
  const [isReferenceDuplicate, setIsReferenceDuplicate] = useState(false);
  const [isCheckingReference, setIsCheckingReference] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const hasMountedCashRef = useRef(false);
  const [notes, setNotes] = useState(initialEntry?.notes || "");

  const today = getIndianToday();
  const currentMonth = getIndianCurrentMonth();

  const selectableCategories = categories.filter(
    (c) => c.is_active !== false || c.id === categoryId,
  );
  const categoryOptions = selectableCategories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const selectedCategory = selectableCategories.find((c) => c.id === categoryId);

  useEffect(() => {
    const fetchOrg = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (profile?.organization_id) {
        setOrganizationId(profile.organization_id);
      }
    };
    fetchOrg();
  }, []);

  // Auto-generate reference number for cash payments
  useEffect(() => {
    if (!hasMountedCashRef.current) {
      hasMountedCashRef.current = true;
      if (!isEditMode && paymentMethod === "cash" && !referenceNumber) {
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 1000)
          .toString()
          .padStart(3, "0");
        setReferenceNumber(`CASH-${timestamp}-${randomNum}`);
      }
      return;
    }

    if (paymentMethod === "cash") {
      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      setReferenceNumber(`CASH-${timestamp}-${randomNum}`);
    } else {
      if (referenceNumber.startsWith("CASH-")) {
        setReferenceNumber("");
      }
    }
  }, [paymentMethod]);

  // Check for duplicate reference numbers
  useEffect(() => {
    let isActive = true;
    const normalized = referenceNumber.trim();

    if (!normalized || !organizationId) {
      setIsReferenceDuplicate(false);
      setIsCheckingReference(false);
      return;
    }

    setIsCheckingReference(true);
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { isDuplicate, error } = await isPaymentReferenceDuplicate(
        supabase,
        organizationId,
        normalized,
        isEditMode && initialEntry?.id
          ? { table: "expense_entries", id: initialEntry.id }
          : undefined,
      );

      if (!isActive) return;

      if (error) {
        setIsReferenceDuplicate(false);
      } else {
        setIsReferenceDuplicate(isDuplicate);
      }
      setIsCheckingReference(false);
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [referenceNumber, organizationId, isEditMode, initialEntry?.id]);

  useEffect(() => {
    if (!categoryId && defaultCategory) {
      setCategoryId(defaultCategory.id);
    }
  }, [categoryId, defaultCategory]);

  const amounts = useMemo(
    () =>
      calculateExpenseAmounts({
        units: Number(units) || 0,
        unitCost: Number(unitCost) || 0,
        gstAmount: Number(gstAmount) || 0,
        discountType,
        discountValue: Number(discountValue) || 0,
      }),
    [units, unitCost, gstAmount, discountType, discountValue],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId) {
      toast({
        variant: "destructive",
        title: "Missing category",
        description: "Please select an expense category.",
      });
      return;
    }

    if (issueDate > today) {
      toast({
        variant: "destructive",
        title: "Invalid issue date",
        description: "Issue date cannot be in the future.",
      });
      return;
    }

    if (!entryMonth) {
      toast({
        variant: "destructive",
        title: "Missing month",
        description: "Please select the month for this entry.",
      });
      return;
    }

    if (entryMonth > currentMonth) {
      toast({
        variant: "destructive",
        title: "Invalid month",
        description: "Month cannot be in the future.",
      });
      return;
    }

    if ((Number(units) || 0) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid units",
        description: "Number of units must be greater than zero.",
      });
      return;
    }

    if ((Number(unitCost) || 0) <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid unit cost",
        description: "Per unit cost must be greater than zero.",
      });
      return;
    }

    if (amounts.totalAmount <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Total amount must be greater than zero.",
      });
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error("User must belong to an organization");
      }

      if (paymentMethod !== "cash" && !referenceNumber.trim()) {
        toast({
          variant: "destructive",
          title: "Missing reference number",
          description: "Please enter a reference number for the selected payment mode.",
        });
        return;
      }

      if (isReferenceDuplicate) {
        toast({
          variant: "destructive",
          title: "Duplicate reference number",
          description:
            "This reference number already exists in payments or expenses. Please enter a unique reference.",
        });
        return;
      }

      const payload = {
        vendor_invoice_number: vendorInvoiceNumber.trim() || null,
        category_id: categoryId,
        issue_date: issueDate,
        description: selectedCategory?.name || "Expense",
        units: Number(units) || 0,
        unit_cost: Number(unitCost) || 0,
        gst_amount: Number(gstAmount) || 0,
        discount_type: discountType,
        discount_value: Number(discountValue) || 0,
        discount_amount: amounts.discountAmount,
        subtotal_amount: amounts.subtotal,
        total_amount: amounts.totalAmount,
        entry_month: entryMonth,
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim() || null,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      let entryId = initialEntry?.id;

      if (isEditMode && initialEntry) {
        let updateRes = await supabase
          .from("expense_entries")
          .update(payload)
          .eq("id", initialEntry.id)
          .eq("organization_id", profile.organization_id);

        if (updateRes.error && updateRes.error.code === "42703") {
          const { payment_method, reference_number, ...fallbackPayload } = payload;
          updateRes = await supabase
            .from("expense_entries")
            .update(fallbackPayload)
            .eq("id", initialEntry.id)
            .eq("organization_id", profile.organization_id);
        }

        if (updateRes.error) throw updateRes.error;
      } else {
        let insertRes = await supabase
          .from("expense_entries")
          .insert({
            ...payload,
            entry_number: entryNumber.trim(),
            status: "recorded",
            amount_paid: 0,
            organization_id: profile.organization_id,
            created_by: user.id,
          })
          .select("id")
          .single();

        if (insertRes.error && insertRes.error.code === "42703") {
          const { payment_method, reference_number, ...fallbackPayload } = payload;
          insertRes = await supabase
            .from("expense_entries")
            .insert({
              ...fallbackPayload,
              entry_number: entryNumber.trim(),
              status: "recorded",
              amount_paid: 0,
              organization_id: profile.organization_id,
              created_by: user.id,
            })
            .select("id")
            .single();
        }

        if (insertRes.error) throw insertRes.error;
        entryId = insertRes.data?.id;
      }

      if (entryId) {
        const userName = await getProfileDisplayName(supabase, user.id);
        const refInfo = referenceNumber.trim()
          ? ` [Ref: ${referenceNumber.trim()}]`
          : "";
        await logEntryHistory(supabase, {
          organizationId: profile.organization_id,
          entityType: "expense_entry",
          entityId: entryId,
          action: isEditMode ? "updated" : "created",
          userId: user.id,
          userName,
          summary: isEditMode
            ? `Updated ${selectedCategory?.name || "expense"}${refInfo}`
            : `${selectedCategory?.name || "Expense"}${refInfo}`,
        });
      }

      toast({
        variant: "success",
        title: isEditMode ? "Expense updated" : "Expense recorded",
        description: isEditMode
          ? `Entry ${entryNumber} updated successfully.`
          : `Entry ${entryNumber} created successfully.`,
      });

      router.push(
        entryId ? `/dashboard/expenses/${entryId}` : "/dashboard/expenses",
      );
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message.includes("unique")
              ? "This entry number already exists."
              : error.message
            : isEditMode
              ? "Failed to update expense entry."
              : "Failed to create expense entry.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entry_number">Internal Entry Number</Label>
              <Input
                id="entry_number"
                value={entryNumber}
                disabled
                readOnly
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor_invoice_number">Invoice Number</Label>
              <Input
                id="vendor_invoice_number"
                value={vendorInvoiceNumber}
                onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                placeholder="Vendor / manual invoice number"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label>
                  Entry Type <span className="text-red-500">*</span>
                </Label>
                <Button type="button" variant="link" className="h-auto p-0" asChild>
                  <Link href="/dashboard/expenses/categories">
                    Manage categories
                  </Link>
                </Button>
              </div>
              <SearchableSelect
                options={categoryOptions}
                value={categoryId}
                onValueChange={setCategoryId}
                placeholder="Select category"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue Date</Label>
              <Input
                id="issue_date"
                type="date"
                value={issueDate}
                max={today}
                onChange={(e) => {
                  const next = e.target.value;
                  const clamped = next > today ? today : next;
                  setIssueDate(clamped);
                  if (!entryMonthTouched && clamped) {
                    const monthFromDate = clamped.slice(0, 7);
                    setEntryMonth(
                      monthFromDate > currentMonth
                        ? currentMonth
                        : monthFromDate,
                    );
                  }
                }}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entry_month">
                Month <span className="text-red-500">*</span>
              </Label>
              <Input
                id="entry_month"
                type="month"
                value={entryMonth}
                max={currentMonth}
                onChange={(e) => {
                  const next = e.target.value;
                  setEntryMonthTouched(true);
                  setEntryMonth(next > currentMonth ? currentMonth : next);
                }}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="units">
                No. of Units <span className="text-red-500">*</span>
              </Label>
              <Input
                id="units"
                type="number"
                min="0"
                step="0.001"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit_cost">
                Per Unit Cost (₹) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="unit_cost"
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gst_amount">GST (₹, optional)</Label>
              <Input
                id="gst_amount"
                type="number"
                min="0"
                step="0.01"
                value={gstAmount}
                onChange={(e) => setGstAmount(e.target.value)}
                placeholder="0.00"
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Discount</Label>
              <SearchableSelect
                options={discountTypeOptions}
                value={discountType}
                onValueChange={(value) =>
                  setDiscountType(value as ExpenseDiscountType)
                }
                placeholder="Discount type"
                disabled
              />
            </div>
            {discountType !== "none" && (
              <div className="space-y-2">
                <Label htmlFor="discount_value">
                  {discountType === "percent" ? "Discount %" : "Discount ₹"}
                </Label>
                <Input
                  id="discount_value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  disabled
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 border-t pt-4">
            <div className="space-y-2">
              <Label htmlFor="payment_method">
                Payment Mode <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                options={paymentMethodOptions}
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value)}
                placeholder="Select payment mode"
                searchPlaceholder="Type payment mode..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference_number">
                Reference Number
                {paymentMethod !== "cash" && (
                  <span className="text-red-500"> *</span>
                )}
              </Label>
              <Input
                id="reference_number"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder={
                  paymentMethod === "cash"
                    ? "Auto-generated (optional for cash)"
                    : "Transaction ID, Check #, UTR, etc."
                }
                className={
                  !isCheckingReference && isReferenceDuplicate
                    ? "border-red-500 focus-visible:ring-red-500"
                    : ""
                }
              />
              {isCheckingReference && referenceNumber.trim() && (
                <p className="text-xs text-muted-foreground">
                  Checking reference number...
                </p>
              )}
              {!isCheckingReference && isReferenceDuplicate && (
                <p className="text-xs text-red-600 font-medium">
                  This reference number already exists in payments or expenses. Please enter a unique reference.
                </p>
              )}
              {paymentMethod === "cash" && (
                <p className="text-xs text-muted-foreground">
                  Optional for cash payments. Auto-populated for tracking.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotal (units × unit cost)</span>
              <span>₹{amounts.subtotal.toFixed(2)}</span>
            </div>
            {amounts.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-700">
                <span>Discount</span>
                <span>-₹{amounts.discountAmount.toFixed(2)}</span>
              </div>
            )}
            {Number(gstAmount) > 0 && (
              <div className="flex justify-between text-sm">
                <span>GST</span>
                <span>₹{Number(gstAmount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-1 border-t border-amber-200 font-semibold">
              <span>Total Amount</span>
              <span>₹{amounts.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-end">
            <Button type="button" variant="outline" asChild>
              <Link
                href={
                  isEditMode && initialEntry
                    ? `/dashboard/expenses/${initialEntry.id}`
                    : "/dashboard/expenses"
                }
              >
                Cancel
              </Link>
            </Button>
            <Button
              type="submit"
              disabled={isLoading || isReferenceDuplicate || isCheckingReference}
            >
              {isLoading && <Spinner className="mr-2 h-4 w-4" />}
              {isEditMode ? "Save Changes" : "Create Entry"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
