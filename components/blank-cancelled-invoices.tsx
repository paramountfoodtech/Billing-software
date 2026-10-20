"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatIndianDate } from "@/lib/date-time";
import { cn } from "@/lib/utils";

export type BlankCancelledInvoice = {
  id: string;
  invoiceNumber: string;
  clientName: string;
  issueDate: string;
  totalAmount: number;
  status: "draft" | "cancelled";
};

interface BlankCancelledInvoicesProps {
  invoices: BlankCancelledInvoice[];
}

const STATUS_LABEL = {
  draft: { label: "Blank/Cancelled", className: "bg-gray-100 text-gray-800" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-800" },
} as const;

export function BlankCancelledInvoices({ invoices }: BlankCancelledInvoicesProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered = query
    ? invoices.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(query) ||
          inv.clientName.toLowerCase().includes(query),
      )
    : invoices;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch("");
  };

  // Cancelled invoices cannot be edited (canEditInvoice), so open their detail page.
  const openInvoice = (inv: BlankCancelledInvoice) => {
    handleOpenChange(false);
    router.push(
      inv.status === "draft"
        ? `/dashboard/invoices/${inv.id}/edit`
        : `/dashboard/invoices/${inv.id}`,
    );
  };

  return (
    <>
      <Button
        variant="outline"
        className="w-full sm:w-auto border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-900"
        onClick={() => setOpen(true)}
      >
        <FileX className="h-4 w-4 mr-2 shrink-0 text-slate-600" />
        <span className="truncate">Blank/Cancelled ({invoices.length})</span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex h-[85dvh] max-h-[85dvh] w-[calc(100%-1rem)] max-w-3xl flex-col gap-3 p-4 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Blank/Cancelled Invoices</DialogTitle>
            <DialogDescription>
              {invoices.length} invoice(s). Click one to open it — blank invoices
              open in edit mode, cancelled invoices open read-only.
            </DialogDescription>
          </DialogHeader>

          <Input
            placeholder="Search invoice # or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-shrink-0"
          />

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No matching invoices.
              </p>
            ) : (
              filtered.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => openInvoice(inv)}
                  className="flex w-full items-center justify-between gap-3 rounded border bg-white px-3 py-2 text-left text-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <div className="min-w-0">
                    <p className="font-medium font-mono">{inv.invoiceNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {inv.clientName} · {formatIndianDate(inv.issueDate)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-xs tabular-nums">
                      ₹
                      {inv.totalAmount.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn(STATUS_LABEL[inv.status].className)}
                    >
                      {STATUS_LABEL[inv.status].label}
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
