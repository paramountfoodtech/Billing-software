"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { PurchaserSelector } from "@/components/purchaser-selector";
import {
  getProfileDisplayName,
  logEntryHistory,
} from "@/lib/entry-history";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getIndianToday } from "@/lib/date-time";
import { isPaymentReferenceDuplicate } from "@/lib/payment-reference";

interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  total_amount: string;
  amount_paid: string;
  status: string;
  issue_date?: string;
  purchaser_id?: string;
  purchasers?: { name: string } | { name: string }[];
}

interface Purchaser {
  id: string;
  name: string;
}

interface PurchasePaymentFormProps {
  invoices: PurchaseInvoice[];
  purchasers?: Purchaser[];
  preSelectedInvoiceId?: string;
  preSelectedPurchaserId?: string;
}

export function PurchasePaymentForm({
  invoices,
  purchasers = [],
  preSelectedInvoiceId,
  preSelectedPurchaserId,
}: PurchasePaymentFormProps) {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] =
    useState<PurchaseInvoice | null>(null);
  const [selectedPurchaserId, setSelectedPurchaserId] = useState<string | null>(
    preSelectedPurchaserId || null,
  );
  const [paymentMode, setPaymentMode] = useState<"individual" | "bulk">(
    preSelectedInvoiceId ? "individual" : "bulk",
  );
  const [autoFilledInvoiceId, setAutoFilledInvoiceId] = useState<string | null>(
    null,
  );
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isReferenceDuplicate, setIsReferenceDuplicate] = useState(false);
  const [isCheckingReference, setIsCheckingReference] = useState(false);

  const [formData, setFormData] = useState({
    invoice_id: preSelectedInvoiceId || "",
    amount: "",
    payment_date: getIndianToday(),
    payment_method: "bank_transfer",
    reference_number: "",
    status: "completed",
    notes: "",
  });

  const purchaserInvoices = selectedPurchaserId
    ? invoices.filter((inv) => inv.purchaser_id === selectedPurchaserId)
    : invoices;

  const invoiceOptions = invoices.map((invoice) => {
    const balance = Number(invoice.total_amount) - Number(invoice.amount_paid);
    const purchaserName = Array.isArray(invoice.purchasers)
      ? invoice.purchasers[0]?.name
      : invoice.purchasers?.name;

    return {
      value: invoice.id,
      label: `${invoice.invoice_number} - ${purchaserName || "Unknown"} (₹${balance.toFixed(2)} due)`,
    };
  });

  const paymentMethodOptions = [
    { value: "cash", label: "Cash" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "check", label: "Check" },
    { value: "credit_card", label: "Credit Card" },
    { value: "other", label: "Other" },
  ];

  const paymentStatusOptions = [
    { value: "pending", label: "Pending" },
    { value: "completed", label: "Completed" },
    { value: "failed", label: "Failed" },
    { value: "refunded", label: "Refunded" },
  ];

  const purchaserTotalPending = purchaserInvoices.reduce((total, inv) => {
    const pending = Number(inv.total_amount) - Number(inv.amount_paid);
    return total + pending;
  }, 0);

  // Auto-generate reference number for cash payments
  useEffect(() => {
    if (formData.payment_method === "cash") {
      const timestamp = Date.now();
      const randomNum = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0");
      const cashRef = `CASH-${timestamp}-${randomNum}`;
      setFormData((prev) => ({ ...prev, reference_number: cashRef }));
    } else {
      setFormData((prev) => ({ ...prev, reference_number: "" }));
    }
  }, [formData.payment_method]);

  useEffect(() => {
    if (formData.invoice_id) {
      const invoice = invoices.find((inv) => inv.id === formData.invoice_id);
      setSelectedInvoice(invoice || null);

      if (
        invoice &&
        formData.amount === "" &&
        autoFilledInvoiceId !== formData.invoice_id
      ) {
        const balance =
          Number(invoice.total_amount) - Number(invoice.amount_paid);
        setFormData((prev) => ({ ...prev, amount: balance.toFixed(2) }));
        setAutoFilledInvoiceId(formData.invoice_id);
      }
    }
  }, [formData.invoice_id, invoices, autoFilledInvoiceId]);

  useEffect(() => {
    let isActive = true;

    const loadOrganizationId = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !isActive) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!isActive) return;
      setOrganizationId(profile?.organization_id || null);
    };

    void loadOrganizationId();
    return () => {
      isActive = false;
    };
  }, [supabase]);

  // Check for duplicate reference while typing to provide earlier feedback.
  useEffect(() => {
    let isActive = true;
    const normalizedReference = formData.reference_number.trim();

    if (!normalizedReference || !organizationId) {
      setIsReferenceDuplicate(false);
      setIsCheckingReference(false);
      return;
    }

    setIsCheckingReference(true);

    const timer = setTimeout(async () => {
      const { isDuplicate, error } = await isPaymentReferenceDuplicate(
        supabase,
        organizationId,
        normalizedReference,
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
  }, [formData.reference_number, organizationId, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isReferenceDuplicate) {
      toast({
        variant: "destructive",
        title: "Duplicate payment reference",
        description:
          "This payment reference already exists. Please use a unique reference.",
      });
      return;
    }

    setIsLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication required",
        description: "You must be logged in to record payments.",
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error("User must belong to an organization");
      }

      const normalizedReference = formData.reference_number.trim();
      const paymentAmount = Number(formData.amount);
      let paymentId: string | null = null;

      if (normalizedReference) {
        const { isDuplicate, error: duplicateCheckError } =
          await isPaymentReferenceDuplicate(
            supabase,
            profile.organization_id,
            normalizedReference,
          );

        if (duplicateCheckError) throw duplicateCheckError;

        if (isDuplicate) {
          toast({
            variant: "destructive",
            title: "Duplicate payment reference",
            description:
              "This payment reference already exists. Please use a unique reference.",
          });
          return;
        }
      }

      if (paymentMode === "bulk" && selectedPurchaserId) {
        let remainingAmount = paymentAmount;
        const unpaidInvoices = purchaserInvoices
          .filter((inv) => {
            const pending = Number(inv.total_amount) - Number(inv.amount_paid);
            return pending > 0;
          })
          .sort(
            (a, b) =>
              new Date(a.issue_date || "").getTime() -
              new Date(b.issue_date || "").getTime(),
          );

        const { data: paymentRow, error: paymentError } = await supabase
          .from("purchase_payments")
          .insert({
            purchase_invoice_id:
              unpaidInvoices[0]?.id || formData.invoice_id,
            amount: formData.amount,
            payment_date: formData.payment_date,
            payment_method: formData.payment_method,
            reference_number: normalizedReference || null,
            status: formData.status,
            notes: `Bulk payment for purchaser - allocated across ${unpaidInvoices.length} invoices. ${formData.notes || ""}`,
            created_by: user.id,
            organization_id: profile.organization_id,
          })
          .select("id")
          .single();

        if (paymentError) throw paymentError;
        paymentId = paymentRow?.id ?? null;

        for (const invoice of unpaidInvoices) {
          if (remainingAmount <= 0) break;

          const pending =
            Number(invoice.total_amount) - Number(invoice.amount_paid);
          const allocationAmount = Math.min(remainingAmount, pending);
          const newAmountPaid = Number(invoice.amount_paid) + allocationAmount;
          const totalAmount = Number(invoice.total_amount);
          const paidOff = newAmountPaid >= totalAmount - 0.01;

          let newStatus = invoice.status;
          if (paidOff) newStatus = "paid";
          else if (newAmountPaid > 0) newStatus = "partially_paid";

          const { error: invoiceError } = await supabase
            .from("purchase_invoices")
            .update({ amount_paid: newAmountPaid, status: newStatus })
            .eq("id", invoice.id);

          if (invoiceError) throw invoiceError;
          remainingAmount -= allocationAmount;
        }

        toast({
          variant: "success",
          title: "Bulk payment recorded",
          description: `₹${paymentAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} allocated across ${unpaidInvoices.length} invoices.`,
        });
      } else {
        if (!selectedInvoice) throw new Error("Please select an invoice");

        const { data: paymentRow, error: paymentError } = await supabase
          .from("purchase_payments")
          .insert({
            purchase_invoice_id: formData.invoice_id,
            amount: formData.amount,
            payment_date: formData.payment_date,
            payment_method: formData.payment_method,
            reference_number: normalizedReference || null,
            status: formData.status,
            notes: formData.notes || null,
            created_by: user.id,
            organization_id: profile.organization_id,
          })
          .select("id")
          .single();

        if (paymentError) throw paymentError;
        paymentId = paymentRow?.id ?? null;

        const newAmountPaid =
          Number(selectedInvoice.amount_paid) + Number(formData.amount);
        const totalAmount = Number(selectedInvoice.total_amount);
        const paidOff = newAmountPaid >= totalAmount - 0.01;

        let newStatus = "recorded";
        if (paidOff) newStatus = "paid";
        else if (newAmountPaid > 0) newStatus = "partially_paid";

        const { error: invoiceError } = await supabase
          .from("purchase_invoices")
          .update({ amount_paid: newAmountPaid, status: newStatus })
          .eq("id", formData.invoice_id);

        if (invoiceError) throw invoiceError;
      }

      if (paymentId) {
        const userName = await getProfileDisplayName(supabase, user.id);
        await logEntryHistory(supabase, {
          organizationId: profile.organization_id,
          entityType: "purchase_payment",
          entityId: paymentId,
          action: "created",
          userId: user.id,
          userName,
        });
      }

      toast({
        variant: "success",
        title: "Payment recorded",
        description: `₹${paymentAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} payment recorded successfully.`,
      });

      router.push("/dashboard/purchase-payments");
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while recording payment",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const balance = selectedInvoice
    ? Number(selectedInvoice.total_amount) - Number(selectedInvoice.amount_paid)
    : 0;
  const paymentAmount = Number(formData.amount) || 0;
  const remainingBalance = balance - paymentAmount;

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Tabs
            value={paymentMode}
            onValueChange={(value) =>
              setPaymentMode(value as "individual" | "bulk")
            }
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="individual">Single Invoice</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Payment</TabsTrigger>
            </TabsList>

            <TabsContent value="bulk" className="space-y-6">
              <div className="space-y-2">
                <Label>
                  Select Purchaser <span className="text-red-500">*</span>
                </Label>
                <PurchaserSelector
                  purchasers={purchasers}
                  selectedPurchaserId={selectedPurchaserId}
                  onPurchaserChange={setSelectedPurchaserId}
                  showAllOption={false}
                />
              </div>

              {selectedPurchaserId && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                  <h4 className="font-semibold text-amber-900">
                    Outstanding Purchase Invoices
                  </h4>
                  {purchaserInvoices
                    .filter(
                      (inv) =>
                        Number(inv.total_amount) - Number(inv.amount_paid) > 0,
                    )
                    .map((inv) => {
                      const pending =
                        Number(inv.total_amount) - Number(inv.amount_paid);
                      return (
                        <div
                          key={inv.id}
                          className="flex justify-between text-sm border-b border-amber-200 pb-2"
                        >
                          <span>{inv.invoice_number}</span>
                          <span className="font-semibold text-amber-700">
                            ₹{pending.toFixed(2)} due
                          </span>
                        </div>
                      );
                    })}
                  <div className="flex justify-between font-bold pt-2">
                    <span>Total Pending</span>
                    <span>₹{purchaserTotalPending.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="individual" className="space-y-6">
              <div className="space-y-2">
                <Label>
                  Purchase Invoice <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  value={formData.invoice_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, invoice_id: value, amount: "" })
                  }
                  options={invoiceOptions}
                  placeholder="Select an invoice"
                  searchPlaceholder="Type invoice number..."
                />
              </div>

              {selectedInvoice && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Invoice Total</span>
                    <span>
                      ₹{Number(selectedInvoice.total_amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Already Paid</span>
                    <span>
                      ₹{Number(selectedInvoice.amount_paid).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>Balance Due</span>
                    <span className="text-red-600">₹{balance.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Payment Amount <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>
                Payment Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                required
                value={formData.payment_date}
                onChange={(e) =>
                  setFormData({ ...formData, payment_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <SearchableSelect
                value={formData.payment_method}
                onValueChange={(value) =>
                  setFormData({ ...formData, payment_method: value })
                }
                options={paymentMethodOptions}
                placeholder="Select method"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference_number">Reference Number</Label>
              <Input
                id="reference_number"
                value={formData.reference_number}
                onChange={(e) =>
                  setFormData({ ...formData, reference_number: e.target.value })
                }
                disabled={formData.payment_method === "cash"}
                readOnly={formData.payment_method === "cash"}
                className={
                  formData.payment_method === "cash" ? "bg-muted" : undefined
                }
                placeholder="Transaction ID, Check #, etc."
              />
              {isCheckingReference && formData.reference_number.trim() && (
                <p className="text-xs text-muted-foreground">
                  Checking reference number...
                </p>
              )}
              {!isCheckingReference && isReferenceDuplicate && (
                <p className="text-xs text-red-600">
                  This reference number already exists. Please enter a unique one.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <SearchableSelect
              value={formData.status}
              onValueChange={(value) =>
                setFormData({ ...formData, status: value })
              }
              options={paymentStatusOptions}
              placeholder="Select status"
            />
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={3}
            />
          </div>

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={
                isLoading ||
                isReferenceDuplicate ||
                !formData.amount ||
                (paymentMode === "individual" && !formData.invoice_id) ||
                (paymentMode === "bulk" && !selectedPurchaserId)
              }
              className="min-w-36"
            >
              {isLoading ? (
                <>
                  <Spinner className="mr-2" />
                  Recording...
                </>
              ) : (
                "Record Payment"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
