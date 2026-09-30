"use client";

import type React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Spinner } from "@/components/ui/spinner";
import { FormBusyOverlay } from "@/components/form-busy-overlay";
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
import { fetchAllPages } from "@/lib/supabase/fetch-all";

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
  const [purchaserCreditBalance, setPurchaserCreditBalance] = useState(0);

  // Bulk mode: load purchaser invoices live from DB (mirrors sales form)
  const [purchaserInvoices, setPurchaserInvoices] = useState<PurchaseInvoice[]>([]);
  const [isLoadingPurchaserInvoices, setIsLoadingPurchaserInvoices] = useState(false);

  const [formData, setFormData] = useState({
    invoice_id: preSelectedInvoiceId || "",
    amount: "",
    payment_date: getIndianToday(),
    payment_method: "bank_transfer",
    reference_number: "",
    status: "completed",
    notes: "",
  });

  const formatInvoiceLabel = (invoice: PurchaseInvoice) => {
    if (!invoice.issue_date) return invoice.invoice_number;
    const d = new Date(invoice.issue_date);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const weekday = d.toLocaleDateString("en-IN", { weekday: "long" });
    return `${invoice.invoice_number}_${dd}/${mm}/${yyyy}_${weekday}`;
  };

  const invoiceOptions = invoices
    .filter(
      (invoice) =>
        Number(invoice.total_amount) - Number(invoice.amount_paid) >= 0.01,
    )
    .map((invoice) => {
      const invoiceBalance =
        Number(invoice.total_amount) - Number(invoice.amount_paid);
      const purchaserName = Array.isArray(invoice.purchasers)
        ? invoice.purchasers[0]?.name
        : invoice.purchasers?.name;
      return {
        value: invoice.id,
        label: `${formatInvoiceLabel(invoice)} - ${purchaserName || "Unknown"} (Rs.${invoiceBalance.toFixed(2)} due)`,
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
    return total + (pending > 0 ? pending : 0);
  }, 0);

  // Auto-generate reference for cash payments
  useEffect(() => {
    if (formData.payment_method === "cash") {
      const cashRef = `CASH-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
      setFormData((prev) => ({ ...prev, reference_number: cashRef }));
    } else {
      setFormData((prev) => ({ ...prev, reference_number: "" }));
    }
  }, [formData.payment_method]);

  // Set selected invoice when invoice_id changes
  useEffect(() => {
    if (formData.invoice_id) {
      const invoice = invoices.find((inv) => inv.id === formData.invoice_id);
      setSelectedInvoice(invoice || null);
      if (
        invoice &&
        formData.amount === "" &&
        autoFilledInvoiceId !== formData.invoice_id
      ) {
        const bal = Number(invoice.total_amount) - Number(invoice.amount_paid);
        setFormData((prev) => ({ ...prev, amount: bal.toFixed(2) }));
        setAutoFilledInvoiceId(formData.invoice_id);
      }
    }
  }, [formData.invoice_id, invoices, autoFilledInvoiceId]);

  // Load purchaser invoices live from DB when in bulk mode
  useEffect(() => {
    let isActive = true;
    if (!selectedPurchaserId) {
      setPurchaserInvoices([]);
      setIsLoadingPurchaserInvoices(false);
      return;
    }
    const load = async () => {
      setIsLoadingPurchaserInvoices(true);
      try {
        const rows = await fetchAllPages<PurchaseInvoice>(async (from, to) => {
          const { data, error } = await supabase
            .from("purchase_invoices")
            .select("id, invoice_number, total_amount, amount_paid, status, issue_date, purchaser_id")
            .eq("purchaser_id", selectedPurchaserId)
            .not("status", "in", "(cancelled)")
            .order("issue_date", { ascending: true })
            .order("created_at", { ascending: true })
            .order("invoice_number", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to);
          return { data, error };
        });
        if (!isActive) return;
        setPurchaserInvoices(rows);
      } catch (err: unknown) {
        if (!isActive) return;
        setPurchaserInvoices([]);
        toast({ variant: "destructive", title: "Could not load purchaser invoices", description: err instanceof Error ? err.message : "Please try again." });
      } finally {
        if (isActive) setIsLoadingPurchaserInvoices(false);
      }
    };
    void load();
    return () => { isActive = false; };
  }, [selectedPurchaserId, supabase, toast]);

  // Fetch purchaser credit balance
  useEffect(() => {
    let isActive = true;
    const fetchCredit = async () => {
      const pid = paymentMode === "bulk" ? selectedPurchaserId : selectedInvoice?.purchaser_id ?? null;
      if (!pid) { setPurchaserCreditBalance(0); return; }
      const { data } = await supabase.from("purchasers").select("credit_balance").eq("id", pid).maybeSingle();
      if (!isActive) return;
      setPurchaserCreditBalance(Number(data?.credit_balance || 0));
    };
    void fetchCredit();
    return () => { isActive = false; };
  }, [paymentMode, selectedPurchaserId, selectedInvoice?.purchaser_id, supabase]);

  // Org ID for duplicate reference check
  useEffect(() => {
    let isActive = true;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isActive) return;
      const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
      if (!isActive) return;
      setOrganizationId(profile?.organization_id || null);
    };
    void load();
    return () => { isActive = false; };
  }, [supabase]);

  // Duplicate reference check
  useEffect(() => {
    let isActive = true;
    const ref = formData.reference_number.trim();
    if (!ref || !organizationId) { setIsReferenceDuplicate(false); setIsCheckingReference(false); return; }
    setIsCheckingReference(true);
    const timer = setTimeout(async () => {
      const { isDuplicate, error } = await isPaymentReferenceDuplicate(supabase, organizationId, ref);
      if (!isActive) return;
      setIsReferenceDuplicate(error ? false : isDuplicate);
      setIsCheckingReference(false);
    }, 350);
    return () => { isActive = false; clearTimeout(timer); };
  }, [formData.reference_number, organizationId, supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isReferenceDuplicate) {
      toast({ variant: "destructive", title: "Duplicate payment reference", description: "This payment reference already exists. Please use a unique reference." });
      return;
    }

    const paymentAmount = Number(formData.amount);
    if (!(paymentAmount > 0)) {
      toast({ variant: "destructive", title: "Invalid amount", description: "Payment amount must be greater than zero." });
      return;
    }

    // Individual mode: block overpayment (mirrors sales)
    if (paymentMode === "individual" && selectedInvoice) {
      const invoiceDue = Number(selectedInvoice.total_amount) - Number(selectedInvoice.amount_paid);
      if (paymentAmount > invoiceDue + 0.005) {
        toast({ variant: "destructive", title: "Amount exceeds invoice balance", description: `This invoice has Rs.${invoiceDue.toFixed(2)} due. Use Bulk Payment to record extra amount as purchaser credit.` });
        return;
      }
    }

    const targetPurchaserId =
      paymentMode === "bulk" ? selectedPurchaserId : selectedInvoice?.purchaser_id;
    if (!targetPurchaserId) {
      toast({ variant: "destructive", title: "Error", description: paymentMode === "bulk" ? "Please select a purchaser" : "Please select an invoice" });
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ variant: "destructive", title: "Authentication required", description: "You must be logged in to record payments." });
      setIsLoading(false);
      return;
    }

    try {
      const normalizedReference = formData.reference_number.trim();

      const { data: result, error: rpcError } = await supabase.rpc(
        "record_purchaser_payment",
        {
          p_purchaser_id: targetPurchaserId,
          p_invoice_id: paymentMode === "individual" ? formData.invoice_id : null,
          p_amount: paymentAmount,
          p_payment_date: formData.payment_date,
          p_payment_method: formData.payment_method,
          p_reference_number: normalizedReference || null,
          p_status: formData.status,
          p_notes: formData.notes || null,
        },
      );

      if (rpcError) throw rpcError;

      const summary = result as {
        payment_id: string;
        credit_generated: number;
        credit_balance: number;
        total_outstanding: number;
      } | null;

      if (summary?.payment_id) {
        const userName = await getProfileDisplayName(supabase, user.id);
        await logEntryHistory(supabase, {
          organizationId: organizationId || "",
          entityType: "purchase_payment",
          entityId: summary.payment_id,
          action: "created",
          userId: user.id,
          userName,
        });
      }

      const amountApplied = summary
        ? paymentAmount - Number(summary.credit_generated || 0)
        : paymentAmount;

      toast({
        variant: "success",
        title: "Payment recorded",
        description: summary
          ? `Applied Rs.${amountApplied.toFixed(2)} to invoices. ${Number(summary.credit_generated) > 0 ? `Rs.${Number(summary.credit_generated).toFixed(2)} added as credit. ` : ""}Outstanding: Rs.${Number(summary.total_outstanding).toFixed(2)}. Credit balance: Rs.${Number(summary.credit_balance).toFixed(2)}.`
          : "Payment recorded successfully.",
      });

      router.push("/dashboard/purchase-payments");
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "An error occurred while recording payment",
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
    <Card className="relative overflow-hidden">
      <FormBusyOverlay active={isLoading} label="Recording purchase payment…" />
      <CardContent className="pt-6">
        <form
          onSubmit={handleSubmit}
          className={`space-y-6 ${isLoading ? "pointer-events-none select-none" : ""}`}
          aria-busy={isLoading}
        >
          <Tabs value={paymentMode} onValueChange={(v) => setPaymentMode(v as "individual" | "bulk")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="individual">Single Invoice</TabsTrigger>
              <TabsTrigger value="bulk">Bulk Payment</TabsTrigger>
            </TabsList>

            {/* ── Bulk mode ── */}
            <TabsContent value="bulk" className="space-y-6">
              <div className="space-y-2">
                <Label>Select Purchaser <span className="text-red-500">*</span></Label>
                <div className="max-w-xs">
                  <PurchaserSelector
                    purchasers={purchasers}
                    selectedPurchaserId={selectedPurchaserId}
                    onPurchaserChange={setSelectedPurchaserId}
                    showAllOption={false}
                  />
                </div>
              </div>

              {selectedPurchaserId && isLoadingPurchaserInvoices && (
                <div className="p-4 border rounded-lg flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="h-4 w-4" />
                  Loading purchaser&apos;s invoices…
                </div>
              )}

              {selectedPurchaserId && !isLoadingPurchaserInvoices && (
                <>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                    <h4 className="font-semibold text-amber-900 mb-2">Outstanding Purchase Invoices</h4>
                    <div className="space-y-2">
                      {purchaserInvoices
                        .filter((inv) => Number(inv.total_amount) - Number(inv.amount_paid) > 0)
                        .map((inv) => {
                          const pending = Number(inv.total_amount) - Number(inv.amount_paid);
                          return (
                            <div key={inv.id} className="flex justify-between items-center text-sm pb-2 border-b border-amber-200 last:border-b-0">
                              <span className="font-medium">{formatInvoiceLabel(inv)}</span>
                              <span className="text-amber-700 font-semibold">Rs.{pending.toFixed(2)} due</span>
                            </div>
                          );
                        })}
                    </div>
                    <div className="border-t border-amber-300 pt-3 mt-3 flex justify-between items-center">
                      <span className="font-semibold text-amber-900">Total Pending:</span>
                      <span className="text-lg font-bold text-amber-700">Rs.{purchaserTotalPending.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                    <h4 className="font-semibold text-blue-900 mb-2">Payment Summary</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-700">Total Invoices Amount:</span>
                      <span className="font-medium">Rs.{purchaserInvoices.reduce((s, i) => s + Number(i.total_amount), 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-blue-700">Already Paid:</span>
                      <span className="font-medium">Rs.{purchaserInvoices.reduce((s, i) => s + Number(i.amount_paid), 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-blue-300 pt-2">
                      <span className="text-blue-900">Current Balance Due:</span>
                      <span className="text-red-600">Rs.{purchaserTotalPending.toFixed(2)}</span>
                    </div>

                    {purchaserCreditBalance > 0 && (
                      <div className="mt-3 pt-3 border-t border-blue-300">
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-700">Existing Credit Balance:</span>
                          <span className="font-medium text-purple-600">Rs.{purchaserCreditBalance.toFixed(2)}</span>
                        </div>
                      </div>
                    )}

                    {Number(formData.amount) > 0 && (
                      <div className="mt-3 pt-3 border-t border-blue-300">
                        <div className="flex justify-between text-sm">
                          <span className="text-blue-700">Payment Amount:</span>
                          <span className="font-medium text-green-600">Rs.{Number(formData.amount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold mt-2">
                          <span className="text-blue-900">Remaining Balance:</span>
                          <span className={purchaserTotalPending - Number(formData.amount) > 0 ? "text-orange-600" : "text-green-600"}>
                            Rs.{Math.max(0, purchaserTotalPending - Number(formData.amount)).toFixed(2)}
                          </span>
                        </div>
                        {purchaserTotalPending - Number(formData.amount) === 0 && (
                          <p className="text-xs text-green-600 mt-1">✓ All invoices will be fully paid</p>
                        )}
                        {purchaserTotalPending - Number(formData.amount) > 0 && (
                          <p className="text-xs text-orange-600 mt-1">⚠ Partial payment - balance remains</p>
                        )}
                        {Number(formData.amount) > purchaserTotalPending && (
                          <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded">
                            <p className="text-xs text-purple-700 font-semibold">
                              💰 Rs.{(Number(formData.amount) - purchaserTotalPending).toFixed(2)} will be added as credit balance for this purchaser
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="pt-3 border-t border-blue-300">
                      <p className="text-sm text-blue-700">
                        The payment amount will be automatically distributed across unpaid invoices, starting with the oldest invoice.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── Individual mode ── */}
            <TabsContent value="individual" className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="invoice_id">
                  Purchase Invoice <span className="text-red-500">*</span>
                </Label>
                <SearchableSelect
                  id="invoice_id"
                  value={formData.invoice_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, invoice_id: value, amount: "" })
                  }
                  options={invoiceOptions}
                  placeholder="Select an invoice"
                  searchPlaceholder="Type invoice number or purchaser..."
                />
              </div>

              {selectedInvoice && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                  <h4 className="font-semibold text-blue-900 mb-2">Invoice Summary</h4>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Invoice Total:</span>
                    <span className="font-medium">Rs.{Number(selectedInvoice.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Already Paid:</span>
                    <span className="font-medium">Rs.{Number(selectedInvoice.amount_paid).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-blue-300 pt-2">
                    <span className="text-blue-900">Current Balance Due:</span>
                    <span className="text-red-600">Rs.{balance.toFixed(2)}</span>
                  </div>

                  {purchaserCreditBalance > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-300">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700">Existing Credit Balance:</span>
                        <span className="font-medium text-purple-600">Rs.{purchaserCreditBalance.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {paymentAmount > 0 && (
                    <div className="mt-3 pt-3 border-t border-blue-300">
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-700">Payment Amount:</span>
                        <span className="font-medium text-green-600">Rs.{paymentAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold mt-2">
                        <span className="text-blue-900">Remaining Balance:</span>
                        <span className={remainingBalance > 0 ? "text-orange-600" : "text-green-600"}>
                          Rs.{Math.max(0, remainingBalance).toFixed(2)}
                        </span>
                      </div>
                      {remainingBalance === 0 && <p className="text-xs text-green-600 mt-1">✓ Invoice will be fully paid</p>}
                      {remainingBalance > 0 && <p className="text-xs text-orange-600 mt-1">⚠ Partial payment - balance remains</p>}
                      {remainingBalance < -0.005 && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <p className="text-xs text-red-700 font-semibold">
                            Amount exceeds this invoice&apos;s balance by Rs.{Math.abs(remainingBalance).toFixed(2)}. Use Bulk Payment to record extra amount as purchaser credit.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">
                Payment Amount <span className="text-red-500">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={
                  paymentMode === "individual" && selectedInvoice
                    ? Math.max(balance, 0.01).toFixed(2)
                    : undefined
                }
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="Enter amount"
              />
              <p className="text-xs text-muted-foreground">
                {paymentMode === "bulk" ? (
                  <>
                    Outstanding:{" "}
                    {isLoadingPurchaserInvoices ? "loading…" : `Rs.${purchaserTotalPending.toFixed(2)}`}{" "}
                    |{" "}
                    <button
                      type="button"
                      disabled={isLoadingPurchaserInvoices}
                      onClick={() => setFormData({ ...formData, amount: purchaserTotalPending.toFixed(2) })}
                      className="ml-1 text-blue-600 hover:underline"
                    >
                      Full Amount
                    </button>
                  </>
                ) : (
                  <>
                    Outstanding: Rs.{balance.toFixed(2)} |{" "}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, amount: balance.toFixed(2) })}
                      className="ml-1 text-blue-600 hover:underline"
                    >
                      Full Amount
                    </button>
                  </>
                )}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_date">
                Payment Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="payment_date"
                type="date"
                required
                max={getIndianToday()}
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method">Payment Method</Label>
              <SearchableSelect
                id="payment_method"
                value={formData.payment_method}
                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                options={paymentMethodOptions}
                placeholder="Select method"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference_number">Reference Number</Label>
              <Input
                id="reference_number"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                disabled={formData.payment_method === "cash"}
                readOnly={formData.payment_method === "cash"}
                className={formData.payment_method === "cash" ? "bg-muted" : undefined}
                placeholder="Transaction ID, Check #, etc."
              />
              {isCheckingReference && formData.reference_number.trim() && (
                <p className="text-xs text-muted-foreground">Checking reference number...</p>
              )}
              {!isCheckingReference && isReferenceDuplicate && (
                <p className="text-xs text-red-600">This reference number already exists. Please enter a unique one.</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <SearchableSelect
              id="status"
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
              options={paymentStatusOptions}
              placeholder="Select status"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                <><Spinner className="mr-2" />Recording...</>
              ) : (
                "Record Payment"
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
