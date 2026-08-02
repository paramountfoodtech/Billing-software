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
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { FormBusyOverlay } from "@/components/form-busy-overlay";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import {
  getProfileDisplayName,
  logEntryHistory,
} from "@/lib/entry-history";
import { getIndianToday, formatIndianDate } from "@/lib/date-time";
import {
  formatChallanNumbers,
  sumChallanBirds,
  sumChallanWeightKg,
} from "@/lib/purchase-invoice-challans";
import {
  getPriceForCategoryOnDate,
  cn,
  type PriceCategoryHistoryEntry,
} from "@/lib/utils";
import {
  isPurchaserInvoiceNumberDuplicate as checkPurchaserInvoiceNumberDuplicate,
  isPurchaserInvoiceNumberUniqueViolation,
} from "@/lib/purchase-invoice-number";
import {
  canEditPurchaseInvoice,
  hasRecordedPayment,
} from "@/lib/permissions";

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
  purchase_invoice_id?: string | null;
  purchasers?: { name: string };
}

interface PurchaseInvoiceInitial {
  id: string;
  invoice_number: string;
  purchaser_invoice_number?: string | null;
  issue_date: string;
  purchaser_id: string | null;
  challan_id?: string | null;
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
  /** Preselect from ?challan_id= */
  initialChallanId?: string;
  /** Linked challans when editing (via purchase_invoice_id). */
  initialChallanIds?: string[];
  liveCategoryId?: string;
  priceHistory?: PriceCategoryHistoryEntry[];
  initialInvoice?: PurchaseInvoiceInitial;
}

export function PurchaseInvoiceForm({
  purchasers,
  challans,
  suggestedInvoiceNumber,
  initialChallanId,
  initialChallanIds,
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

  const seedChallanIds = useMemo(() => {
    if (initialChallanIds && initialChallanIds.length > 0) {
      return [...new Set(initialChallanIds)];
    }
    const single = initialInvoice?.challan_id || initialChallanId;
    return single ? [single] : [];
  }, [initialChallanIds, initialInvoice?.challan_id, initialChallanId]);

  const seedChallans = useMemo(
    () =>
      seedChallanIds
        .map((id) => challans.find((c) => c.id === id))
        .filter((c): c is ChallanOption => Boolean(c)),
    [seedChallanIds, challans],
  );

  const firstSeedChallan = seedChallans[0] ?? null;

  const amountPaid = Number(initialInvoice?.amount_paid || 0);

  const [invoiceNumber] = useState(
    initialInvoice?.invoice_number || suggestedInvoiceNumber,
  );
  const [purchaserInvoiceNumber, setPurchaserInvoiceNumber] = useState(
    initialInvoice?.purchaser_invoice_number || "",
  );
  const [issueDate, setIssueDate] = useState(
    initialInvoice?.issue_date ||
      firstSeedChallan?.challan_date ||
      getIndianToday(),
  );
  const [purchaserId, setPurchaserId] = useState(
    initialInvoice?.purchaser_id ||
      firstSeedChallan?.purchaser_id ||
      purchasers.find((p) => p.is_default)?.id ||
      "",
  );
  const [selectedChallanIds, setSelectedChallanIds] = useState<string[]>(
    seedChallanIds,
  );
  const [originalChallanIds] = useState<string[]>(seedChallanIds);
  const [totalWeightInput, setTotalWeightInput] = useState(
    initialInvoice
      ? String(initialInvoice.total_weight_kg)
      : seedChallans.length > 0
        ? String(sumChallanWeightKg(seedChallans))
        : "",
  );
  const [totalBirdsInput, setTotalBirdsInput] = useState(
    initialInvoice
      ? String(initialInvoice.total_birds || 0)
      : seedChallans.length > 0
        ? String(sumChallanBirds(seedChallans))
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
  const [isChallanPickerOpen, setIsChallanPickerOpen] = useState(false);
  const [challanSearch, setChallanSearch] = useState("");

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
    const selectedOrOriginal = new Set([
      ...selectedChallanIds,
      ...originalChallanIds,
    ]);
    return challans.filter((c) => {
      if (selectedOrOriginal.has(c.id)) return true;
      if (c.status !== "final") return false;
      if (c.purchase_invoice_id) return false;
      if (purchaserId && c.purchaser_id !== purchaserId) return false;
      if (!c.challan_date || c.challan_date !== issueDate) return false;
      return true;
    });
  }, [
    challans,
    purchaserId,
    issueDate,
    selectedChallanIds,
    originalChallanIds,
  ]);

  const selectedChallans = useMemo(
    () =>
      selectedChallanIds
        .map((id) => challans.find((c) => c.id === id))
        .filter((c): c is ChallanOption => Boolean(c)),
    [selectedChallanIds, challans],
  );

  const filteredAvailableChallans = useMemo(() => {
    const keyword = challanSearch.trim().toLowerCase();
    if (!keyword) return availableChallans;
    return availableChallans.filter((c) => {
      const haystack = [
        c.challan_number,
        String(c.total_weight_kg),
        String(c.total_birds || 0),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
  }, [availableChallans, challanSearch]);

  const hasLinkedChallans = selectedChallanIds.length > 0;
  const primaryChallanId = selectedChallanIds[0] || null;
  const lockedFromQuery = Boolean(initialChallanId);

  const purchaserOptions = purchasers.map((p) => ({
    value: p.id,
    label: p.purchaser_code ? `${p.name} (${p.purchaser_code})` : p.name,
  }));

  const skipInitialChallanSync = useRef(isEditMode);

  useEffect(() => {
    if (skipInitialChallanSync.current) {
      skipInitialChallanSync.current = false;
      return;
    }
    if (selectedChallans.length === 0) return;
    setPurchaserId(selectedChallans[0].purchaser_id);
    setTotalWeightInput(String(sumChallanWeightKg(selectedChallans)));
    setTotalBirdsInput(String(sumChallanBirds(selectedChallans)));
  }, [selectedChallans]);

  // Drop challans that no longer match the issue date (create mode only)
  useEffect(() => {
    if (lockedFromQuery || isEditMode) return;
    setSelectedChallanIds((prev) => {
      const next = prev.filter((id) => {
        const c = challans.find((x) => x.id === id);
        return c && c.challan_date === issueDate;
      });
      return next.length === prev.length ? prev : next;
    });
  }, [issueDate, challans, lockedFromQuery, isEditMode]);

  const toggleChallan = (challanId: string, checked: boolean) => {
    setSelectedChallanIds((prev) => {
      if (checked) {
        if (prev.includes(challanId)) return prev;
        return [...prev, challanId];
      }
      return prev.filter((id) => id !== challanId);
    });
  };

  const totalWeight = Number(totalWeightInput) || 0;
  const totalBirds = Math.max(0, Math.round(Number(totalBirdsInput) || 0));
  const average =
    totalBirds > 0 && totalWeight > 0 ? totalWeight / totalBirds : null;
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
    await new Promise((resolve) => requestAnimationFrame(resolve));

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

      if (
        isEditMode &&
        initialInvoice &&
        !canEditPurchaseInvoice(
          profile.role,
          initialInvoice.status,
          amountPaid,
        )
      ) {
        throw new Error(
          hasRecordedPayment(amountPaid)
            ? "This purchase invoice has payments recorded and cannot be edited."
            : "You do not have permission to edit this purchase invoice.",
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

      const challanLabel = formatChallanNumbers(
        selectedChallans.map((c) => c.challan_number),
        "",
      );

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
            challan_id: primaryChallanId,
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

        const originalSet = new Set(originalChallanIds);
        const nextSet = new Set(selectedChallanIds);
        const toUnlock = originalChallanIds.filter((id) => !nextSet.has(id));
        const toLock = selectedChallanIds.filter((id) => !originalSet.has(id));

        if (toUnlock.length > 0) {
          const { error: unlockError } = await supabase
            .from("challans")
            .update({
              status: "final",
              purchase_invoice_id: null,
              updated_at: new Date().toISOString(),
            })
            .in("id", toUnlock);

          if (unlockError) throw unlockError;
        }

        if (toLock.length > 0) {
          const { error: challanError } = await supabase
            .from("challans")
            .update({
              status: "invoiced",
              purchase_invoice_id: initialInvoice.id,
              updated_at: new Date().toISOString(),
            })
            .in("id", toLock);

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
          summary: challanLabel
            ? `Updated (purchase challans ${challanLabel})`
            : "Updated purchase invoice",
        });
      } else {
        const { data: invoice, error: invoiceError } = await supabase
          .from("purchase_invoices")
          .insert({
            invoice_number: invoiceNumber.trim(),
            purchaser_invoice_number: trimmedPurchaserInvoiceNumber,
            invoice_type: "challan",
            challan_id: primaryChallanId,
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

        if (selectedChallanIds.length > 0 && invoiceId) {
          const { error: challanError } = await supabase
            .from("challans")
            .update({
              status: "invoiced",
              purchase_invoice_id: invoiceId,
              updated_at: new Date().toISOString(),
            })
            .in("id", selectedChallanIds);

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
            summary: challanLabel
              ? `From purchase challans ${challanLabel}`
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
    <Card className="relative overflow-hidden">
      <FormBusyOverlay
        active={isLoading}
        label={isEditMode ? "Updating purchase invoice…" : "Creating purchase invoice…"}
      />
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className={`space-y-6 ${isLoading ? "pointer-events-none select-none" : ""}`}
          aria-busy={isLoading}
        >
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
                onValueChange={(value) => {
                  setPurchaserId(value);
                  if (!lockedFromQuery) {
                    setSelectedChallanIds([]);
                  }
                }}
                placeholder="Select purchaser"
                disabled={lockedFromQuery || hasLinkedChallans}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Purchase challans (optional)</Label>
              {!purchaserId ? (
                <p className="text-sm text-muted-foreground rounded-md border px-3 py-2">
                  Select a purchaser first to link challans.
                </p>
              ) : (
                <Popover
                  open={isChallanPickerOpen}
                  onOpenChange={(open) => {
                    setIsChallanPickerOpen(open);
                    if (!open) setChallanSearch("");
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={isChallanPickerOpen}
                      disabled={availableChallans.length === 0}
                      className="w-full justify-between font-normal h-auto min-h-10 py-2"
                    >
                      <span className="truncate text-left">
                        {hasLinkedChallans
                          ? `${selectedChallanIds.length} challan${
                              selectedChallanIds.length === 1 ? "" : "s"
                            } selected — ${formatChallanNumbers(
                              selectedChallans.map((c) => c.challan_number),
                            )}`
                          : availableChallans.length === 0
                            ? `No final challans on ${formatIndianDate(issueDate)}`
                            : "Select purchase challans"}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                  >
                    <div className="border-b p-2">
                      <Input
                        value={challanSearch}
                        onChange={(e) => setChallanSearch(e.target.value)}
                        placeholder="Search challan number..."
                        className="h-8"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto p-1">
                      {filteredAvailableChallans.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                          No challans found.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                          {filteredAvailableChallans.map((c) => {
                            const checked = selectedChallanIds.includes(c.id);
                            const weight = `${Number(c.total_weight_kg).toFixed(3)} KG`;
                            const birds = `${Number(c.total_birds || 0)} birds`;
                            return (
                              <label
                                key={c.id}
                                className={cn(
                                  "flex items-start gap-2.5 rounded-md px-2.5 py-2 cursor-pointer hover:bg-muted/50",
                                  checked && "bg-muted/40",
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) =>
                                    toggleChallan(c.id, value === true)
                                  }
                                  disabled={
                                    lockedFromQuery && c.id === initialChallanId
                                  }
                                  className="mt-0.5"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="font-medium font-mono text-sm truncate block">
                                    {c.challan_number}
                                  </span>
                                  <span className="block text-xs text-muted-foreground truncate">
                                    {weight} · {birds}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {hasLinkedChallans && (
                      <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
                        <p className="text-xs text-muted-foreground truncate">
                          {selectedChallanIds.length} selected
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            if (lockedFromQuery && initialChallanId) {
                              setSelectedChallanIds([initialChallanId]);
                            } else {
                              setSelectedChallanIds([]);
                            }
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )}
              <p className="text-xs text-muted-foreground">
                Optional. Open the dropdown to select one or more final challans
                for the issue date. Weight and birds are summed from linked
                challans.
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
                readOnly={hasLinkedChallans}
                className={hasLinkedChallans ? "bg-muted" : undefined}
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
                readOnly={hasLinkedChallans}
                className={hasLinkedChallans ? "bg-muted" : undefined}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>Average (KG / bird)</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium tabular-nums">
                {average != null ? average.toFixed(3) : "—"}
              </div>
              <p className="text-xs text-muted-foreground">
                Total weight ÷ total birds
              </p>
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
              disabled={isLoading}
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
              {isLoading
                ? isEditMode
                  ? "Updating..."
                  : "Creating..."
                : isEditMode
                  ? "Update Invoice"
                  : "Create Invoice"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
