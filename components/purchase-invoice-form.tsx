"use client";

import type React from "react";

import { useEffect, useMemo, useState } from "react";
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

export type PurchaseInvoiceEntryType = "challan" | "salary" | "expense";

export const NA_PURCHASER_ID = "__na__";

interface Purchaser {
  id: string;
  name: string;
  purchaser_code?: string;
}

interface ChallanOption {
  id: string;
  challan_number: string;
  purchaser_id: string;
  total_weight_kg: string;
  status: string;
  purchasers?: { name: string };
}

interface PurchaseInvoiceFormProps {
  purchasers: Purchaser[];
  challans: ChallanOption[];
  suggestedInvoiceNumber: string;
  initialChallanId?: string;
  initialType?: PurchaseInvoiceEntryType;
}

const entryTypeLabels: Record<PurchaseInvoiceEntryType, string> = {
  challan: "From Challan",
  salary: "Salary",
  expense: "Expense",
};

export function PurchaseInvoiceForm({
  purchasers,
  challans,
  suggestedInvoiceNumber,
  initialChallanId,
  initialType = "challan",
}: PurchaseInvoiceFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const initialChallan = challans.find((c) => c.id === initialChallanId) ?? null;
  const resolvedInitialType: PurchaseInvoiceEntryType = initialChallan
    ? "challan"
    : initialType;

  const [entryType, setEntryType] =
    useState<PurchaseInvoiceEntryType>(resolvedInitialType);
  const [invoiceNumber] = useState(suggestedInvoiceNumber);
  const [issueDate, setIssueDate] = useState(getIndianToday());
  const [purchaserId, setPurchaserId] = useState(
    initialChallan?.purchaser_id ||
      (resolvedInitialType !== "challan" ? NA_PURCHASER_ID : ""),
  );
  const [challanId, setChallanId] = useState(initialChallan?.id || "");
  const [description, setDescription] = useState("");
  const [totalWeightInput, setTotalWeightInput] = useState(
    initialChallan ? String(initialChallan.total_weight_kg) : "",
  );
  const [pricePerKg, setPricePerKg] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [pricingMode, setPricingMode] = useState<"per_kg" | "total">(
    resolvedInitialType === "challan" ? "per_kg" : "total",
  );

  const availableChallans = useMemo(() => {
    return challans.filter((c) => {
      if (c.status !== "final") return false;
      if (purchaserId && c.purchaser_id !== purchaserId) return false;
      return true;
    });
  }, [challans, purchaserId]);

  const challanOptions = availableChallans.map((c) => ({
    value: c.id,
    label: `${c.challan_number} — ${Number(c.total_weight_kg).toFixed(3)} KG`,
  }));

  const purchaserOptions = useMemo(() => {
    const options = purchasers.map((p) => ({
      value: p.id,
      label: p.purchaser_code ? `${p.name} (${p.purchaser_code})` : p.name,
    }));
    if (entryType !== "challan") {
      return [{ value: NA_PURCHASER_ID, label: "N/A" }, ...options];
    }
    return options;
  }, [purchasers, entryType]);

  const entryTypeOptions = (
    Object.keys(entryTypeLabels) as PurchaseInvoiceEntryType[]
  ).map((type) => ({
    value: type,
    label: entryTypeLabels[type],
  }));

  useEffect(() => {
    if (entryType !== "challan") {
      setChallanId("");
      setPricingMode("total");
      if (entryType === "salary" && !description) {
        setDescription("Salary payment");
      }
      if (entryType === "expense" && !description) {
        setDescription("");
      }
      return;
    }

    if (!challanId) return;
    const selected = challans.find((c) => c.id === challanId);
    if (!selected) return;
    setPurchaserId(selected.purchaser_id);
    setTotalWeightInput(String(selected.total_weight_kg));
  }, [challanId, challans, entryType, description]);

  const totalWeight = Number(totalWeightInput) || 0;
  const isWeightBased = entryType === "challan";

  const grossTotal =
    pricingMode === "per_kg" && isWeightBased
      ? totalWeight * (Number(pricePerKg) || 0)
      : Number(totalPrice) || 0;

  const discountAmount = Math.max(0, Number(discount) || 0);
  const finalTotal = Math.max(0, grossTotal - discountAmount);

  const computedPricePerKg =
    isWeightBased && pricingMode === "total" && totalWeight > 0
      ? grossTotal / totalWeight
      : isWeightBased
        ? Number(pricePerKg) || 0
        : 0;

  const lineDescription =
    description.trim() ||
    (entryType === "challan" && challanId
      ? `Purchase weight (Challan ${
          challans.find((c) => c.id === challanId)?.challan_number || ""
        })`
      : entryType === "salary"
        ? "Salary payment"
        : "Expense");

  const handleEntryTypeChange = (type: PurchaseInvoiceEntryType) => {
    setEntryType(type);
    if (type !== "challan") {
      setChallanId("");
      setTotalWeightInput("");
      setPricePerKg("");
      setPurchaserId(NA_PURCHASER_ID);
    } else {
      setPurchaserId("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (
      entryType === "challan" &&
      (!purchaserId || purchaserId === NA_PURCHASER_ID)
    ) {
      toast({
        variant: "destructive",
        title: "Missing purchaser",
        description: "Please select a purchaser for challan invoices.",
      });
      return;
    }

    if (entryType === "challan" && !challanId) {
      toast({
        variant: "destructive",
        title: "Missing challan",
        description: "Please select a challan or switch to Salary/Expense entry.",
      });
      return;
    }

    if (entryType !== "challan" && !description.trim()) {
      toast({
        variant: "destructive",
        title: "Missing description",
        description: "Please enter a description for this entry.",
      });
      return;
    }

    if (isWeightBased && totalWeight <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid weight",
        description: "Please enter a valid total weight.",
      });
      return;
    }

    if (grossTotal <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Please enter a valid price.",
      });
      return;
    }

    if (discountAmount > grossTotal) {
      toast({
        variant: "destructive",
        title: "Invalid discount",
        description: "Discount cannot exceed the total price.",
      });
      return;
    }

    if (finalTotal <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: "Invoice amount after discount must be greater than zero.",
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

      const selectedChallan = challanId
        ? challans.find((c) => c.id === challanId)
        : null;

      const { data: invoice, error: invoiceError } = await supabase
        .from("purchase_invoices")
        .insert({
          invoice_number: invoiceNumber.trim(),
          invoice_type: entryType,
          description: lineDescription,
          challan_id: entryType === "challan" ? challanId : null,
          purchaser_id:
            purchaserId && purchaserId !== NA_PURCHASER_ID ? purchaserId : null,
          issue_date: issueDate,
          total_weight_kg: isWeightBased ? totalWeight : 0,
          price_per_kg: computedPricePerKg,
          discount_amount: discountAmount,
          total_amount: finalTotal,
          amount_paid: 0,
          status: "recorded",
          notes: notes.trim() || null,
          organization_id: profile.organization_id,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (invoiceError) throw invoiceError;

      if (entryType === "challan" && challanId) {
        const { error: challanError } = await supabase
          .from("challans")
          .update({
            status: "invoiced",
            purchase_invoice_id: invoice?.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", challanId);

        if (challanError) throw challanError;
      }

      if (invoice?.id) {
        const userName = await getProfileDisplayName(supabase, user.id);
        const summary =
          entryType === "challan" && selectedChallan
            ? `From challan ${selectedChallan.challan_number}`
            : `${entryTypeLabels[entryType]}: ${lineDescription}`;
        await logEntryHistory(supabase, {
          organizationId: profile.organization_id,
          entityType: "purchase_invoice",
          entityId: invoice.id,
          action: "created",
          userId: user.id,
          userName,
          summary,
        });
      }

      toast({
        variant: "success",
        title: "Invoice created",
        description: `Purchase invoice ${invoiceNumber} created successfully.`,
      });

      router.push(`/dashboard/purchase-invoices/${invoice?.id}`);
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message.includes("unique")
              ? "This invoice number already exists."
              : error.message
            : "Failed to create invoice.",
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
            <div className="space-y-2 sm:col-span-2">
              <Label>Entry Type</Label>
              <SearchableSelect
                options={entryTypeOptions}
                value={entryType}
                onValueChange={(value) =>
                  handleEntryTypeChange(value as PurchaseInvoiceEntryType)
                }
                placeholder="Select entry type"
                disabled={Boolean(initialChallanId)}
              />
              {initialChallanId && (
                <p className="text-xs text-muted-foreground">
                  Entry type is fixed when creating from a challan.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                value={invoiceNumber}
                disabled
                readOnly
                className="bg-muted"
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

            <div className="space-y-2 sm:col-span-2">
              <Label>
                Purchaser
                {entryType === "challan" && (
                  <span className="text-red-500"> *</span>
                )}
              </Label>
              <SearchableSelect
                options={purchaserOptions}
                value={purchaserId}
                onValueChange={setPurchaserId}
                placeholder={
                  entryType === "challan"
                    ? "Select purchaser"
                    : "N/A or select purchaser"
                }
                disabled={Boolean(initialChallanId)}
              />
              {entryType !== "challan" && (
                <p className="text-xs text-muted-foreground">
                  Use N/A when the entry is not tied to a specific purchaser.
                </p>
              )}
            </div>

            {entryType === "challan" && (
              <div className="space-y-2 sm:col-span-2">
                <Label>Challan</Label>
                <SearchableSelect
                  options={challanOptions}
                  value={challanId}
                  onValueChange={setChallanId}
                  placeholder={
                    purchaserId
                      ? "Select final challan"
                      : "Select purchaser first"
                  }
                  disabled={Boolean(initialChallanId) || !purchaserId}
                />
                <p className="text-xs text-muted-foreground">
                  Only final challans not yet invoiced are listed. Weight and
                  purchaser auto-fill when selected.
                </p>
              </div>
            )}

            {entryType !== "challan" && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    entryType === "salary"
                      ? "e.g. March 2026 salaries"
                      : "e.g. Office rent, utilities"
                  }
                  required
                />
              </div>
            )}

            {isWeightBased && (
              <div className="space-y-2">
                <Label htmlFor="total_weight">Total Weight (KG)</Label>
                <Input
                  id="total_weight"
                  type="number"
                  step="0.001"
                  min="0"
                  value={totalWeightInput}
                  onChange={(e) => setTotalWeightInput(e.target.value)}
                  placeholder="0.000"
                  readOnly={Boolean(challanId)}
                  className={challanId ? "bg-muted" : undefined}
                />
              </div>
            )}

            {entryType === "challan" && (
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="challan_description">
                  Description (optional)
                </Label>
                <Input
                  id="challan_description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Override line description on invoice"
                />
              </div>
            )}
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label>Pricing</Label>
            {isWeightBased && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={pricingMode === "per_kg" ? "default" : "outline"}
                  onClick={() => setPricingMode("per_kg")}
                >
                  Price per KG
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={pricingMode === "total" ? "default" : "outline"}
                  onClick={() => setPricingMode("total")}
                >
                  Total Price
                </Button>
              </div>
            )}

            {isWeightBased && pricingMode === "per_kg" ? (
              <div className="space-y-2">
                <Label htmlFor="price_per_kg">Price per KG (₹)</Label>
                <Input
                  id="price_per_kg"
                  type="number"
                  step="0.01"
                  min="0"
                  value={pricePerKg}
                  onChange={(e) => setPricePerKg(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="total_price">Total Price (₹)</Label>
                <Input
                  id="total_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="discount">Discount (₹)</Label>
              <Input
                id="discount"
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this invoice"
              rows={3}
            />
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-1">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>
                ₹
                {grossTotal.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-700">
                <span>Discount</span>
                <span>
                  -₹
                  {discountAmount.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-1 border-t border-blue-200">
              <span className="font-semibold">Invoice Amount</span>
              <span className="font-bold text-blue-900">
                ₹
                {finalTotal.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            {isWeightBased &&
              pricingMode === "total" &&
              totalWeight > 0 && (
                <div className="flex justify-between text-xs text-blue-700">
                  <span>Effective rate</span>
                  <span>₹{computedPricePerKg.toFixed(2)}/KG</span>
                </div>
              )}
          </div>

          <div className="flex flex-wrap gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/purchase-invoices")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Spinner className="mr-2 h-4 w-4" />}
              Create Invoice
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
