"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
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
import { getIndianToday } from "@/lib/date-time";
import {
  calculateExpenseAmounts,
  isSalaryCategory,
  type ExpenseDiscountType,
} from "@/lib/expense-calculations";

export interface ExpenseCategoryOption {
  id: string;
  name: string;
  slug: string | null;
  is_active?: boolean;
}

interface ExpenseEntryFormProps {
  categories: ExpenseCategoryOption[];
  suggestedEntryNumber: string;
}

const discountTypeOptions = [
  { value: "none", label: "No discount" },
  { value: "percent", label: "Discount %" },
  { value: "flat", label: "Flat discount (₹)" },
];

export function ExpenseEntryForm({
  categories,
  suggestedEntryNumber,
}: ExpenseEntryFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const defaultCategory =
    categories.find((c) => c.slug === "salary") || categories[0];

  const [entryNumber] = useState(suggestedEntryNumber);
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategory?.id || "");
  const [issueDate, setIssueDate] = useState(getIndianToday());
  const [description, setDescription] = useState(
    defaultCategory?.slug === "salary" ? "Salary payment" : "",
  );
  const [salaryMonth, setSalaryMonth] = useState(
    getIndianToday().slice(0, 7),
  );
  const [units, setUnits] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [gstAmount, setGstAmount] = useState("");
  const [discountType, setDiscountType] =
    useState<ExpenseDiscountType>("none");
  const [discountValue, setDiscountValue] = useState("");
  const [notes, setNotes] = useState("");

  const activeCategories = categories.filter((c) => c.is_active !== false);
  const categoryOptions = activeCategories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const selectedCategory = activeCategories.find((c) => c.id === categoryId);
  const showSalaryMonth = isSalaryCategory(selectedCategory?.slug);

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

    if (!description.trim()) {
      toast({
        variant: "destructive",
        title: "Missing description",
        description: "Please enter a description.",
      });
      return;
    }

    if (showSalaryMonth && !salaryMonth) {
      toast({
        variant: "destructive",
        title: "Missing salary month",
        description: "Please select the salary month.",
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
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error("User must belong to an organization");
      }

      const { data: entry, error } = await supabase
        .from("expense_entries")
        .insert({
          entry_number: entryNumber.trim(),
          vendor_invoice_number: vendorInvoiceNumber.trim() || null,
          category_id: categoryId,
          issue_date: issueDate,
          description: description.trim(),
          units: Number(units) || 0,
          unit_cost: Number(unitCost) || 0,
          gst_amount: Number(gstAmount) || 0,
          discount_type: discountType,
          discount_value: Number(discountValue) || 0,
          discount_amount: amounts.discountAmount,
          subtotal_amount: amounts.subtotal,
          total_amount: amounts.totalAmount,
          salary_month: showSalaryMonth ? salaryMonth : null,
          status: "recorded",
          amount_paid: 0,
          notes: notes.trim() || null,
          organization_id: profile.organization_id,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      if (entry?.id) {
        const userName = await getProfileDisplayName(supabase, user.id);
        await logEntryHistory(supabase, {
          organizationId: profile.organization_id,
          entityType: "expense_entry",
          entityId: entry.id,
          action: "created",
          userId: user.id,
          userName,
          summary: `${selectedCategory?.name || "Expense"}: ${description.trim()}`,
        });
      }

      toast({
        variant: "success",
        title: "Expense recorded",
        description: `Entry ${entryNumber} created successfully.`,
      });

      router.push("/dashboard/expenses");
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
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </div>

            {showSalaryMonth && (
              <div className="space-y-2">
                <Label htmlFor="salary_month">
                  Salary Month <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="salary_month"
                  type="month"
                  value={salaryMonth}
                  onChange={(e) => setSalaryMonth(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">
                Description <span className="text-red-500">*</span>
              </Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description for this entry"
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
                />
              </div>
            )}
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
              <Link href="/dashboard/expenses">Cancel</Link>
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Spinner className="mr-2 h-4 w-4" />}
              Create Entry
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
