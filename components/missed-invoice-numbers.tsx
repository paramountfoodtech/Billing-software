"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Search } from "lucide-react";

interface MissedInvoiceNumbersProps {
  missedNumbers: string[];
  grouped: string;
}

export function MissedInvoiceNumbers({
  missedNumbers,
  grouped,
}: MissedInvoiceNumbersProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const groupedItems = grouped.split(", ").filter(Boolean);
  const filteredNumbers = search.trim()
    ? missedNumbers.filter((n) => n.toLowerCase().includes(search.trim().toLowerCase()))
    : missedNumbers;

  if (missedNumbers.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        variant="outline"
        className="border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
        onClick={() => setDialogOpen(true)}
      >
        <AlertTriangle className="h-4 w-4 mr-2 text-amber-600" />
        {missedNumbers.length} Missing Invoice Number{missedNumbers.length !== 1 ? "s" : ""}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setSearch(""); }}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Missing Invoice Numbers</DialogTitle>
            <DialogDescription>
              {missedNumbers.length} invoice number(s) are missing from the sequence.
              Create invoices with these numbers or manually adjust your numbering.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
            <div className="flex-shrink-0 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Range Summary:
              </p>
              <div className="max-h-32 overflow-y-auto rounded border border-amber-200 bg-amber-50 p-3">
                <div className="flex flex-wrap gap-2">
                  {groupedItems.map((item) => (
                    <span
                      key={item}
                      className="rounded-md border border-amber-200 bg-white px-2 py-1 font-mono text-xs text-amber-900"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col min-h-0 flex-1 gap-2">
              <div className="flex-shrink-0 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  Full List ({missedNumbers.length} total):
                </p>
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto rounded border bg-gray-50 p-3">
                {filteredNumbers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No results for &ldquo;{search}&rdquo;</p>
                ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {filteredNumbers.map((number) => (
                    <Link
                      key={number}
                      href={`/dashboard/invoices/new?invoiceNumber=${encodeURIComponent(number)}`}
                      className="rounded border bg-white px-2 py-1 font-mono text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                    >
                      {number}
                    </Link>
                  ))}
                </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
