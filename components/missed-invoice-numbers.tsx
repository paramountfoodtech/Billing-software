"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface MissedInvoiceNumbersProps {
  missedNumbers: string[];
  grouped: string;
}

export function MissedInvoiceNumbers({
  missedNumbers,
  grouped,
}: MissedInvoiceNumbersProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Missing Invoice Numbers</DialogTitle>
            <DialogDescription>
              {missedNumbers.length} invoice number(s) are missing from the sequence.
              Create invoices with these numbers or manually adjust your numbering.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Range Summary:
              </p>
              <code className="block bg-amber-50 p-3 rounded text-sm break-all border border-amber-200">
                {grouped}
              </code>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Full List ({missedNumbers.length} total):
              </p>
              <div className="bg-gray-50 p-3 rounded border max-h-96 overflow-y-auto">
                <p className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all">
                  {missedNumbers.join(", ")}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
