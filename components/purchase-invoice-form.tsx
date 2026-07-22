"use client";

import type React from "react";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { getIndianToday, formatIndianDate } from "@/lib/date-time";
import {
  getPriceForCategoryOnDate,
  type PriceCategoryHistoryEntry,
} from "@/lib/utils";
import {
  isPurchaserInvoiceNumberDuplicate as checkPurchaserInvoiceNumberDuplicate,
  isPurchaserInvoiceNumberUniqueViolation,
} from "@/lib/purchase-invoice-number";

interface Purchaser {
  id: string;
  name: string;
  purchaser_code?: string;
  is_default?: boolean | null;
}

interface ChallanOption {
  id: string;
  challan_number: string;
  purchaser_id: string;
  total_weight_kg: string;
  total_birds?: number | null;
  challan_date?: string | null;
  status: string;
  purchasers?: { name: string };
}

interface PurchaseInvoiceInitial {
  id: string;
  invoice_number: string;
  purchaser_invoice_number?: string | null;
  issue_date: string;
  purchaser_id: string | null;
  challan_id?: string | null;
  description?: string | null;
  total_weight_kg: string | number;
  total_birds?: number | null;
  price_per_kg: string | number;
  discount_amount?: string | number | null;
  total_amount: string | number;
  amount_paid: string | number;
  status: string;
  notes?: string | null;
}

interface PurchaseInvoiceFormProps {
  purchasers: Purchaser[];
  challans: ChallanOption[];
  suggestedInvoiceNumber: string;
  initialChallanId?: string;
  liveCategoryId?: string;
  priceHistory?: PriceCategoryHistoryEntry[];
  initialInvoice?: PurchaseInvoiceInitial;
}

export function PurchaseInvoiceForm({
  purchasers,
  challans,
  suggestedInvoiceNumber,
  initialChallanId,
  liveCategoryId,
  priceHistory = [],
  initialInvoice,
}: PurchaseInvoiceFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const isEditMode = Boolean(initialInvoice);
  const [isLoading, setIsLoading] = useState(false);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isCheckingPurchaserInvoiceNumber, setIsCheckingPurchaserInvoiceNumber] =
    useState(false);
  const [isPurchaserInvoiceNumberDuplicate, setIsPurchaserInvoiceNumberDuplicate] =
    useState(false);

  const initialChallan =
    challans.find((c) => c.id === (initialInvoice?.challan_id || initialChallanId)) ??
    null;

  const amountPaid = Number(initialInvoice?.amount_paid || 0);

  const [invoiceNumber] = useState(
    initialInvoice?.invoice_number || suggestedInvoiceNumber,
  );
  const [purchaserInvoiceNumber, setPurchaserInvoiceNumber] = useState(
    initialInvoice?.purchaser_invoice_number || "",
  );
  const [issueDate, setIssueDate] = useState(
    initialInvoice?.issue_date ||
      initialChallan?.challan_date ||
      getIndianToday(),
  );
  const [purchaserId, setPurchaserId] = useState(
    initialInvoice?.purchaser_id ||
      initialChallan?.purchaser_id ||
      purchasers.find((p) => p.is_default)?.id ||
      "",
  );
  const [challanId, setChallanId] = useState(
    initialInvoice?.challan_id || initialChallan?.id || "",
  );
  const [originalChallanId] = useState(initialInvoice?.challan_id || "");
  const [description, setDescription] = useState(
    initialInvoice?.description || "",
  );
  const [totalWeightInput, setTotalWeightInput] = useState(
    initialInvoice
      ? String(initialInvoice.total_weight_kg)
      : initialChallan
        ? String(initialChallan.total_weight_kg)
        : "",
  );
  const [totalBirdsInput, setTotalBirdsInput] = useState(
    initialInvoice
      ? String(initialInvoice.total_birds || 0)
      : initialChallan
        ? String(initialChallan.total_birds || 0)
        : "",
  );
  const [pricePerKg, setPricePerKg] = useState(
    initialInvoice ? String(Number(initialInvoice.price_per_kg) || "") : "",
  );
  const [totalPrice, setTotalPrice] = useState(
    initialInvoice
      ? String(
          Number(initialInvoice.total_amount) +
            Number(initialInvoice.discount_amount || 0),
        )
      : "",
  );
  const [discount, setDiscount] = useState(
    initialInvoice && Number(initialInvoice.discount_amount || 0) > 0
      ? String(initialInvoice.discount_amount)
      : "",
  );
  const [notes, setNotes] = useState(initialInvoice?.notes || "");
  const [pricingMode, setPricingMode] = useState<"per_kg" | "total">(
    initialInvoice ? "total" : "per_kg",
  );

  useEffect(() => {
    let isActive = true;
    const loadOrganization = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !isActive) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (isActive) {
        setOrganizationId(profile?.organization_id ?? null);
      }
    };

    void loadOrganization();
    return () => {
      isActive = false;
    };
  }, [supabase]);

  useEffect(() => {
    let isActive = true;
    const normalized = purchaserInvoiceNumber.trim();

    if (!organizationId || !normalized) {
      setIsPurchaserInvoiceNumberDuplicate(false);
      setIsCheckingPurchaserInvoiceNumber(false);
      return;
    }

    setIsCheckingPurchaserInvoiceNumber(true);

    const timer = setTimeout(async () => {
      const { isDuplicate, error: duplicateError } =
        await checkPurchaserInvoiceNumberDuplicate(
          supabase,
          organizationId,
          normalized,
          initialInvoice?.id,
        );

      if (!isActive) return;

      if (duplicateError) {
        setIsPurchaserInvoiceNumberDuplicate(false);
      } else {
        setIsPurchaserInvoiceNumberDuplicate(isDuplicate);
      }
      setIsCheckingPurchaserInvoiceNumber(false);
    }, 350);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [purchaserInvoiceNumber, organizationId, supabase, initialInvoice?.id]);

  const availableChallans = useMemo(() => {
    return challans.filter((c) => {
      if (c.id === challanId || c.id === originalChallanId) return true;
      if (c.status !== "final") return false;
      if (purchaserId && c.purchaser_id !== purchaserId) return false;
      if (!c.challan_date || c.challan_date !== issueDate) return false;
      return true;
    });
  }, [challans, purchaserId, issueDate, challanId, originalChallanId]);

  const challanOptions = [
    { value: "none", label: "None (no challan)" },
    ...availableChallans.map((c) => {
      const weight = `${Number(c.total_weight_kg).toFixed(3)} KG`;
      const birds = `${Number(c.total_birds || 0)} birds`;
      const date = c.challan_date
        ? formatIndianDate(c.challan_date)
        : "";
      const parts = [c.challan_number, weight, birds];
      if (date) parts.push(date);
      return {
        value: c.id,
        label: parts.join(" — "),
      };
    }),
  ];

  const purchaserOptions = purchasers.map((p) => ({
    value: p.id,
    label: p.purchaser_code ? `${p.name} (${p.purchaser_code})` : p.name,
  }));

  const skipInitialChallanSync = useRef(isEditMode);

  useEffect(() => {
    if (!challanId) return;
    if (skipInitialChallanSync.current) {
      skipInitialChallanSync.current = false;
      return;
    }
    const selected = challans.find((c) => c.id === challanId);
    if (!selected) return;
    setPurchaserId(selected.purchaser_id);
    setTotalWeightInput(String(selected.total_weight_kg));
    setTotalBirdsInput(String(selected.total_birds || 0));
  }, [challanId, challans]);

  // Clear linked challan when issue date changes and it no longer matches
  useEffect(() => {
    if (!challanId || initialChallanId || isEditMode) return;
    const selected = challans.find((c) => c.id === challanId);
    if (!selected || selected.challan_date !== issueDate) {
      setChallanId("");
    }
  }, [issueDate, challanId, challans, initialChallanId, isEditMode]);

  const totalWeight = Number(totalWeightInput) || 0;
  const totalBirds = Math.max(0, Math.round(Number(totalBirdsInput) || 0));
  const selectedChallan = challanId
    ? challans.find((c) => c.id === challanId)
    : undefined;
  const liveRate =
    liveCategoryId && issueDate
      ? getPriceForCategoryOnDate(liveCategoryId, issueDate, priceHistory)
      : null;

  const grossTotal =
    pricingMode === "per_kg"
      ? totalWeight * (Number(pricePerKg) || 0)
      : Number(totalPrice) || 0;

  const discountAmount = Math.max(0, Number(discount) || 0);
  const finalTotal = Math.max(0, grossTotal - discountAmount);

  const computedPricePerKg =
    pricingMode === "total" && totalWeight > 0
      ? grossTotal / totalWeight
      : Number(pricePerKg) || 0;

  const hasEnteredPrice =
    pricingMode === "per_kg"
      ? pricePerKg.trim() !== "" && Number(pricePerKg) > 0
      : totalPrice.trim() !== "" && Number(totalPrice) > 0;

  // Unit rate used for Live comparison (₹/KG)
  const enteredRatePerKg = (() => {
    if (!hasEnteredPrice) return null;
    if (pricingMode === "per_kg") return Number(pricePerKg) || 0;
    if (totalWeight > 0) return grossTotal / totalWeight;
    return null;
  })();

  const enteredRatePerBird =
    hasEnteredPrice && pricingMode === "total" && totalBirds > 0
      ? grossTotal / totalBirds
      : null;

  const rateDifference =
    enteredRatePerKg != null && liveRate != null
      ? enteredRatePerKg - liveRate
      : null;

  const formatRupee = (value: number) =>
    `₹${value.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const lineDescription =
    description.trim() ||
    (challanId
      ? `Purchase weight (Purchase challan ${
          challans.find((c) => c.id === challanId)?.challan_number || ""
        })`
      : "Purchase invoice");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!purchaserId) {
      toast({
        variant: "destructive",
        title: "Missing purchaser",
        description: "Please select a purchaser.",
      });
      return;
    }

    if (!purchaserInvoiceNumber.trim()) {
      toast({
        variant: "destructive",
        title: "Missing purchaser invoice number",
        description: "Please enter the invoice number from the purchaser.",
      });
      return;
    }

    if (isPurchaserInvoiceNumberDuplicate) {
      toast({
        variant: "destructive",
        title: "Duplicate invoice number",
        description:
          "This purchaser invoice number already exists. Please enter a unique invoice number.",
      });
      return;
    }

    if (isCheckingPurchaserInvoiceNumber) {
      toast({
        variant: "destructive",
        title: "Please wait",
        description: "Still checking whether this invoice number is unique.",
      });
      return;
    }

    if (totalWeight <= 0) {
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

    if (isEditMode && finalTotal + 0.001 < amountPaid) {
      toast({
        variant: "destructive",
        title: "Invalid amount",
        description: `Invoice amount cannot be less than amount already paid (₹${amountPaid.toFixed(2)}).`,
      });
      return;
    }

    setIsLoading(true);

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

      if (isEditMode && profile.role !== "super_admin") {
        throw new Error("Only Super Admin can edit purchase invoices.");
      }

      if (isEditMode && amountPaid > 0.01) {
        throw new Error(
          "This purchase invoice has payments recorded and cannot be edited.",
        );
      }

      const trimmedPurchaserInvoiceNumber = purchaserInvoiceNumber.trim();
      const {
        isDuplicate,
        error: duplicateCheckError,
      } = await checkPurchaserInvoiceNumberDuplicate(
        supabase,
        profile.organization_id,
        trimmedPurchaserInvoiceNumber,
        initialInvoice?.id,
      );

      if (duplicateCheckError) throw duplicateCheckError;
      if (isDuplicate) {
        setIsPurchaserInvoiceNumberDuplicate(true);
        throw new Error(
          `Purchaser invoice number "${trimmedPurchaserInvoiceNumber}" already exists. Please use a different invoice number.`,
        );
      }

      const selectedChallan = challanId
        ? challans.find((c) => c.id === challanId)
        : undefined;

      const nextStatus =
        isEditMode && amountPaid > 0
          ? finalTotal - amountPaid <= 0.01
            ? "paid"
            : "partial"
          : isEditMode
            ? initialInvoice?.status || "recorded"
            : "recorded";

      let invoiceId = initialInvoice?.id;

      if (isEditMode && initialInvoice) {
        const { error: invoiceError } = await supabase
          .from("purchase_invoices")
          .update({
            purchaser_invoice_number: trimmedPurchaserInvoiceNumber,
            description: lineDescription,
            challan_id: challanId || null,
            purchaser_id: purchaserId,
            issue_date: issueDate,
            total_weight_kg: totalWeight,
            total_birds: totalBirds,
            price_per_kg: computedPricePerKg,
            discount_amount: discountAmount,
            total_amount: finalTotal,
            status: nextStatus,
            notes: notes.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", initialInvoice.id);

        if (invoiceError) {
          if (isPurchaserInvoiceNumberUniqueViolation(invoiceError)) {
            setIsPurchaserInvoiceNumberDuplicate(true);
            throw new Error(
              `Purchaser invoice number "${trimmedPurchaserInvoiceNumber}" already exists. Please use a different invoice number.`,
            );
          }
          throw invoiceError;
        }

        // Unlock previously linked challan if changed/removed
        if (originalChallanId && originalChallanId !== challanId) {
          const { error: unlockError } = await supabase
            .from("challans")
            .update({
              status: "final",
              purchase_invoice_id: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", originalChallanId);

          if (unlockError) throw unlockError;
        }

        // Lock newly linked challan
        if (challanId && challanId !== originalChallanId) {
          const { error: challanError } = await supabase
            .from("challans")
            .update({
              status: "invoiced",
              purchase_invoice_id: initialInvoice.id,
              updated_at: new Date().toISOString(),
            })
            .eq("id", challanId);

          if (challanError) throw challanError;
        }

        const userName = await getProfileDisplayName(supabase, user.id);
        await logEntryHistory(supabase, {
          organizationId: profile.organization_id,
          entityType: "purchase_invoice",
          entityId: initialInvoice.id,
          action: "updated",
          userId: user.id,
          userName,
          summary: selectedChallan
            ? `Updated (purchase challan ${selectedChallan.challan_number})`
            : "Updated purchase invoice",
        });
      } else {
        const { data: invoice, error: invoiceError } = await supabase
          .from("purchase_invoices")
          .insert({
            invoice_number: invoiceNumber.trim(),
            purchaser_invoice_number: trimmedPurchaserInvoiceNumber,
            invoice_type: "challan",
            description: lineDescription,
            challan_id: challanId || null,
            purchaser_id: purchaserId,
            issue_date: issueDate,
            total_weight_kg: totalWeight,
            total_birds: totalBirds,
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

        if (invoiceError) {
          if (isPurchaserInvoiceNumberUniqueViolation(invoiceError)) {
            setIsPurchaserInvoiceNumberDuplicate(true);
            throw new Error(
              `Purchaser invoice number "${trimmedPurchaserInvoiceNumber}" already exists. Please use a different invoice number.`,
            );
          }
          throw invoiceError;
        }

        invoiceId = invoice?.id;

        if (challanId) {
          const { error: challanError } = await supabase
            .from("challans")
            .update({
              status: "invoiced",
              purchase_invoice_id: invoiceId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", challanId);

          if (challanError) throw challanError;
        }

        if (invoiceId) {
          const userName = await getProfileDisplayName(supabase, user.id);
          await logEntryHistory(supabase, {
            organizationId: profile.organization_id,
            entityType: "purchase_invoice",
            entityId: invoiceId,
            action: "created",
            userId: user.id,
            userName,
            summary: selectedChallan
              ? `From purchase challan ${selectedChallan.challan_number}`
              : "Purchase invoice (no challan)",
          });
        }
      }

      toast({
        variant: "success",
        title: isEditMode ? "Invoice updated" : "Invoice created",
        description: isEditMode
          ? "Purchase invoice updated successfully."
          : `Purchase invoice ${invoiceNumber} created successfully.`,
      });

      router.push(`/dashboard/purchase-invoices/${invoiceId}`);
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : isEditMode
              ? "Failed to update invoice."
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

            <div className="space-y-2">
              <Label htmlFor="purchaser_invoice_number">
                Purchaser Invoice Number{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="purchaser_invoice_number"
                value={purchaserInvoiceNumber}
                onChange={(e) => setPurchaserInvoiceNumber(e.target.value)}
                placeholder="Invoice number from purchaser"
                required
              />
              {isCheckingPurchaserInvoiceNumber &&
                purchaserInvoiceNumber.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Checking invoice number...
                  </p>
                )}
              {!isCheckingPurchaserInvoiceNumber &&
                isPurchaserInvoiceNumberDuplicate && (
                  <p className="text-xs text-red-600">
                    This invoice number already exists. Please enter a unique
                    one.
                  </p>
                )}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>
                Purchaser <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                options={purchaserOptions}
                value={purchaserId}
                onValueChange={setPurchaserId}
                placeholder="Select purchaser"
                disabled={Boolean(initialChallanId) || Boolean(challanId)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Purchase challan (optional)</Label>
              <SearchableSelect
                options={challanOptions}
                value={challanId || "none"}
                onValueChange={(value) =>
                  setChallanId(value === "none" ? "" : value)
                }
                placeholder={
                  purchaserId
                    ? "Select purchase challan (optional)"
                    : "Select purchaser first"
                }
                disabled={Boolean(initialChallanId) || !purchaserId}
              />
              <p className="text-xs text-muted-foreground">
                Optional. Only final challans for the selected issue date are
                listed. Link one to auto-fill weight, or create without a
                challan.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_birds">Total Birds</Label>
              <Input
                id="total_birds"
                type="number"
                step="1"
                min="0"
                value={totalBirdsInput}
                onChange={(e) => setTotalBirdsInput(e.target.value)}
                placeholder="0"
                readOnly={Boolean(challanId)}
                className={challanId ? "bg-muted" : undefined}
              />
            </div>

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

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="challan_description">Description (optional)</Label>
              <Input
                id="challan_description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Override line description on invoice"
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <Label>Pricing</Label>
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

            {pricingMode === "per_kg" ? (
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

            <div className="rounded-md border bg-muted/40 px-3 py-2 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  Live rate ({formatIndianDate(issueDate) || issueDate})
                </span>
                <span className="font-medium tabular-nums">
                  {liveRate != null ? `${formatRupee(liveRate)} / KG` : "Not set for this date"}
                </span>
              </div>
              {hasEnteredPrice && enteredRatePerKg != null && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    Entered rate
                    {pricingMode === "total" ? " (total ÷ weight)" : ""}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatRupee(enteredRatePerKg)} / KG
                  </span>
                </div>
              )}
              {enteredRatePerBird != null && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    Entered rate (total ÷ birds)
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatRupee(enteredRatePerBird)} / bird
                  </span>
                </div>
              )}
              {rateDifference != null && (
                <div className="flex justify-between gap-3 border-t pt-1.5">
                  <span className="text-muted-foreground">
                    Difference (entered − live)
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${
                      rateDifference > 0
                        ? "text-green-700"
                        : rateDifference < 0
                          ? "text-red-600"
                          : "text-foreground"
                    }`}
                  >
                    {rateDifference > 0 ? "+" : ""}
                    {formatRupee(rateDifference)} / KG
                  </span>
                </div>
              )}
              {hasEnteredPrice &&
                pricingMode === "total" &&
                totalWeight <= 0 &&
                totalBirds <= 0 && (
                  <p className="text-xs text-amber-700">
                    Enter total weight (or link a challan with birds) to compare
                    with the Live rate.
                  </p>
                )}
            </div>
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
            {pricingMode === "total" && totalWeight > 0 && (
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
              onClick={() =>
                router.push(
                  isEditMode && initialInvoice
                    ? `/dashboard/purchase-invoices/${initialInvoice.id}`
                    : "/dashboard/purchase-invoices",
                )
              }
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isLoading ||
                !purchaserInvoiceNumber.trim() ||
                isPurchaserInvoiceNumberDuplicate ||
                isCheckingPurchaserInvoiceNumber
              }
            >
              {isLoading && <Spinner className="mr-2 h-4 w-4" />}
              {isEditMode ? "Update Invoice" : "Create Invoice"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
