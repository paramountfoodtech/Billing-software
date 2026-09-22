"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

export interface LinkedInvoice {
  id: string;
  invoice_number: string;
  amount: number | null;
}

type InvoiceRef = { id: string; invoice_number: string; issue_date?: string | null };

export interface PaymentWithAllocations {
  invoices?: { id: string; invoice_number: string } | null;
  payment_allocations?: Array<{
    amount: string | number;
    allocation_type: string;
    invoices: InvoiceRef | InvoiceRef[] | null;
  }> | null;
}

/**
 * Invoices a payment's money was actually applied to, oldest first (the
 * payment's own invoice first when it received money). Older payments with no
 * allocation records fall back to the invoice they were recorded against.
 */
export function getPaymentLinkedInvoices(
  payment: PaymentWithAllocations,
): LinkedInvoice[] {
  const byId = new Map<
    string,
    LinkedInvoice & { issue_date: string }
  >();

  for (const allocation of payment.payment_allocations ?? []) {
    if (allocation.allocation_type !== "payment") continue;
    const invoice = Array.isArray(allocation.invoices)
      ? allocation.invoices[0]
      : allocation.invoices;
    if (!invoice) continue;

    const existing = byId.get(invoice.id);
    const amount = Number(allocation.amount || 0);
    if (existing) {
      existing.amount = (existing.amount ?? 0) + amount;
    } else {
      byId.set(invoice.id, {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount,
        issue_date: invoice.issue_date || "",
      });
    }
  }

  const linked = Array.from(byId.values()).sort(
    (a, b) =>
      a.issue_date.localeCompare(b.issue_date) ||
      a.invoice_number.localeCompare(b.invoice_number, undefined, {
        numeric: true,
      }),
  );

  const direct = payment.invoices;
  if (direct) {
    const directIndex = linked.findIndex((inv) => inv.id === direct.id);
    if (directIndex > 0) {
      const [entry] = linked.splice(directIndex, 1);
      linked.unshift(entry);
    } else if (directIndex === -1 && linked.length === 0) {
      // Older payments recorded before allocations existed: show the invoice
      // they were recorded against, without an amount.
      linked.push({
        id: direct.id,
        invoice_number: direct.invoice_number,
        amount: null,
        issue_date: "",
      });
    }
  }

  return linked.map(({ id, invoice_number, amount }) => ({
    id,
    invoice_number,
    amount,
  }));
}

const CLOSE_DELAY_MS = 150;

export function PaymentInvoiceLinks({
  invoices,
}: {
  invoices: LinkedInvoice[];
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(() => cancelClose, []);

  if (invoices.length === 0) {
    return <span className="text-muted-foreground text-xs">-</span>;
  }

  const [first, ...rest] = invoices;
  const firstLink = (
    <Link
      href={`/dashboard/invoices/${first.id}`}
      className="font-medium hover:underline text-blue-600 max-w-[100px] sm:max-w-none truncate block text-xs"
    >
      {first.invoice_number}
    </Link>
  );

  if (rest.length === 0) return firstLink;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          className="flex items-center gap-1"
          onPointerEnter={(e) => {
            if (e.pointerType !== "mouse") return;
            cancelClose();
            setOpen(true);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== "mouse") return;
            scheduleClose();
          }}
        >
          {firstLink}
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={`Show all ${invoices.length} invoices for this payment`}
            onClick={() => {
              cancelClose();
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-blue-700 hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            +{rest.length}
          </button>
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        collisionPadding={12}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") cancelClose();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") scheduleClose();
        }}
        className="w-64 max-w-[calc(100vw-1.5rem)] p-2"
      >
        <p className="px-2 pb-1.5 text-xs font-semibold text-muted-foreground">
          Applied to {invoices.length} invoices
        </p>
        <ul className="max-h-60 overflow-y-auto">
          {invoices.map((invoice) => (
            <li key={invoice.id}>
              <Link
                href={`/dashboard/invoices/${invoice.id}`}
                className="flex items-center justify-between gap-3 rounded px-2 py-2 text-xs hover:bg-muted"
              >
                <span className="font-medium text-blue-600 truncate">
                  {invoice.invoice_number}
                </span>
                {invoice.amount != null && (
                  <span className="shrink-0 text-muted-foreground">
                    ₹
                    {invoice.amount.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
