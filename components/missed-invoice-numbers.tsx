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
import type { MissedInvoiceRange } from "@/lib/invoice-gaps";
import { cn } from "@/lib/utils";

interface MissedInvoiceNumbersProps {
  missedNumbers: string[];
  ranges: MissedInvoiceRange[];
}

export function MissedInvoiceNumbers({
  missedNumbers,
  ranges,
}: MissedInvoiceNumbersProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRangeIndex, setSelectedRangeIndex] = useState<number | null>(
    null,
  );

  const selectedRange =
    selectedRangeIndex !== null ? ranges[selectedRangeIndex] : null;
  const displayedNumbers = selectedRange?.numbers ?? [];
  const filteredNumbers = search.trim()
    ? displayedNumbers.filter((n) =>
        n.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : displayedNumbers;

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSearch("");
      setSelectedRangeIndex(null);
    }
  };

  const handleRangeClick = (index: number) => {
    setSelectedRangeIndex((prev) => (prev === index ? null : index));
    setSearch("");
  };

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
        {missedNumbers.length} Missing Invoice Number
        {missedNumbers.length !== 1 ? "s" : ""}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Missing Invoice Numbers</DialogTitle>
            <DialogDescription>
              {missedNumbers.length} invoice number(s) are missing from the
              sequence. Click a range to view individual numbers and create
              invoices.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
            <div className="flex-shrink-0 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                Missing ranges
              </p>
              <div className="max-h-32 overflow-y-auto rounded border border-amber-200 bg-amber-50 p-3">
                <div className="flex flex-wrap gap-2">
                  {ranges.map((range, index) => (
                    <button
                      key={range.label}
                      type="button"
                      onClick={() => handleRangeClick(index)}
                      className={cn(
                        "rounded-md border px-2 py-1 font-mono text-xs transition-colors",
                        selectedRangeIndex === index
                          ? "border-amber-500 bg-amber-200 text-amber-950 ring-1 ring-amber-500"
                          : "border-amber-200 bg-white text-amber-900 hover:bg-amber-100 hover:border-amber-300",
                      )}
                    >
                      {range.label}
                      <span className="ml-1.5 text-[10px] font-sans text-amber-700/80">
                        ({range.numbers.length})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {selectedRange && (
              <div className="flex flex-col min-h-0 flex-1 gap-2">
                <div className="flex-shrink-0 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                    {selectedRange.label} ({displayedNumbers.length})
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
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No results for &ldquo;{search}&rdquo;
                    </p>
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
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

