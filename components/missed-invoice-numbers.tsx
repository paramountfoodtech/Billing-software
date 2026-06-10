"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  FilePlus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import type { MissedInvoiceRange } from "@/lib/invoice-gaps";
import type { DiscardedInvoiceNumber } from "@/lib/discarded-invoice-numbers";
import { cn } from "@/lib/utils";
import { getProfileDisplayName } from "@/lib/entry-history";
import { IconTooltip } from "@/components/icon-tooltip";
import { formatIndianDateTime } from "@/lib/date-time";

interface MissedInvoiceNumbersProps {
  missedNumbers: string[];
  ranges: MissedInvoiceRange[];
  discardedNumbers: DiscardedInvoiceNumber[];
}

type ActionTarget = {
  label: string;
  numbers: string[];
  rangeIndex?: number;
};

export function MissedInvoiceNumbers({
  missedNumbers,
  ranges,
  discardedNumbers: initialDiscarded,
}: MissedInvoiceNumbersProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [discardedDialogOpen, setDiscardedDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRangeIndex, setSelectedRangeIndex] = useState<number | null>(
    null,
  );
  const [actionTarget, setActionTarget] = useState<ActionTarget | null>(null);
  const [discardNote, setDiscardNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discardedNumbers, setDiscardedNumbers] =
    useState(initialDiscarded);

  useEffect(() => {
    setDiscardedNumbers(initialDiscarded);
  }, [initialDiscarded]);

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
      setActionTarget(null);
      setDiscardNote("");
    }
  };

  const openActionDialog = (target: ActionTarget) => {
    setActionTarget(target);
    setDiscardNote("");
  };

  const closeActionDialog = () => {
    setActionTarget(null);
    setDiscardNote("");
  };

  const handleRangeClick = (index: number) => {
    const range = ranges[index];
    openActionDialog({
      label: range.label,
      numbers: range.numbers,
      rangeIndex: index,
    });
  };

  const handleBrowseRange = () => {
    if (!actionTarget) return;
    if (actionTarget.rangeIndex !== undefined) {
      setSelectedRangeIndex(actionTarget.rangeIndex);
    }
    closeActionDialog();
    setSearch("");
  };

  const handleGenerate = () => {
    if (!actionTarget || actionTarget.numbers.length !== 1) return;
    const number = actionTarget.numbers[0];
    handleDialogChange(false);
    router.push(
      `/dashboard/invoices/new?invoiceNumber=${encodeURIComponent(number)}`,
    );
  };

  const handleDiscard = async () => {
    if (!actionTarget) return;
    const note = discardNote.trim();
    if (!note) {
      toast({
        variant: "destructive",
        title: "Note required",
        description: "Please enter a reason before discarding.",
      });
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error("Organization not found");
      }

      const userName = await getProfileDisplayName(supabase, user.id);
      const rows = actionTarget.numbers.map((invoice_number) => ({
        organization_id: profile.organization_id,
        invoice_number,
        note,
        discarded_by: user.id,
        discarded_by_name: userName,
      }));

      const { data: inserted, error } = await supabase
        .from("discarded_invoice_numbers")
        .insert(rows)
        .select("id, invoice_number, note, discarded_at, discarded_by_name");

      if (error) throw error;

      if (inserted?.length) {
        setDiscardedNumbers((prev) => [...inserted, ...prev]);
      }

      toast({
        variant: "success",
        title: "Discarded",
        description:
          actionTarget.numbers.length === 1
            ? `${actionTarget.numbers[0]} has been discarded.`
            : `${actionTarget.numbers.length} invoice numbers discarded.`,
      });

      closeActionDialog();
      router.refresh();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to discard invoice number(s).",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestore = async (discard: DiscardedInvoiceNumber) => {
    setIsSubmitting(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in");

      const { error } = await supabase
        .from("discarded_invoice_numbers")
        .update({
          restored_at: new Date().toISOString(),
          restored_by: user.id,
        })
        .eq("id", discard.id);

      if (error) throw error;

      setDiscardedNumbers((prev) => prev.filter((d) => d.id !== discard.id));

      toast({
        variant: "success",
        title: "Restored",
        description: `${discard.invoice_number} is back in the missing list.`,
      });

      router.refresh();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to restore invoice number.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (missedNumbers.length === 0 && discardedNumbers.length === 0) {
    return null;
  }

  const isSingleTarget = actionTarget?.numbers.length === 1;

  return (
    <>
      <Button
        variant="outline"
        className="w-full sm:w-auto border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
        onClick={() => setDialogOpen(true)}
      >
        <AlertTriangle className="h-4 w-4 mr-2 shrink-0 text-amber-600" />
        <span className="truncate">
          {missedNumbers.length > 0
            ? `${missedNumbers.length} Missing Invoice Number${missedNumbers.length !== 1 ? "s" : ""}`
            : `${discardedNumbers.length} Discarded`}
        </span>
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="flex h-[90dvh] max-h-[90dvh] w-[calc(100%-1rem)] max-w-6xl flex-col gap-3 p-4 sm:h-[92vh] sm:max-h-[92vh] sm:w-[98vw] sm:gap-4 sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Missing Invoice Numbers</DialogTitle>
            <DialogDescription>
              {missedNumbers.length > 0
                ? `${missedNumbers.length} invoice number(s) are missing from the sequence. Choose to generate an invoice or discard with a note.`
                : "No missing invoice numbers right now."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
            {missedNumbers.length > 0 && (
              <>
                <div className="flex-shrink-0 space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Missing ranges
                  </p>
                  <div className="max-h-32 overflow-y-auto rounded border border-amber-200 bg-amber-50 p-3 sm:max-h-48">
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
                    <div className="flex-shrink-0 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        {selectedRange.label} ({displayedNumbers.length})
                      </p>
                      <div className="relative w-full sm:max-w-xs sm:flex-1">
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
                            <button
                              key={number}
                              type="button"
                              onClick={() =>
                                openActionDialog({
                                  label: number,
                                  numbers: [number],
                                })
                              }
                              className="rounded border bg-white px-2 py-1 font-mono text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors text-left"
                            >
                              {number}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {!selectedRange && ranges.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Tip: click a range to choose an action, or select a range
                    below to browse individual numbers.
                  </p>
                )}

                {ranges.length > 0 && !selectedRange && (
                  <div className="flex flex-wrap gap-2">
                    {ranges.map((range, index) => (
                      <Button
                        key={`browse-${range.label}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="font-mono text-xs"
                        onClick={() => {
                          setSelectedRangeIndex(index);
                          setSearch("");
                        }}
                      >
                        Browse {range.label}
                      </Button>
                    ))}
                  </div>
                )}
              </>
            )}

          </div>

          {discardedNumbers.length > 0 && (
            <DialogFooter className="flex-shrink-0 border-t pt-4 sm:justify-start">
              <IconTooltip label={`Discarded (${discardedNumbers.length})`}>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-slate-300 bg-slate-50 hover:bg-slate-100 sm:w-auto"
                  onClick={() => setDiscardedDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2 text-slate-600" />
                  Discarded ({discardedNumbers.length})
                </Button>
              </IconTooltip>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={discardedDialogOpen}
        onOpenChange={setDiscardedDialogOpen}
      >
        <DialogContent className="flex h-[85dvh] max-h-[85dvh] w-[calc(100%-1rem)] max-w-lg flex-col gap-3 p-4 sm:max-h-[80vh] sm:p-6">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Discarded Invoice Numbers</DialogTitle>
            <DialogDescription>
              {discardedNumbers.length} number(s) skipped from the sequence.
              Restore any to generate an invoice for it later.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 py-2">
            {discardedNumbers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No discarded numbers.
              </p>
            ) : (
              discardedNumbers.map((discard) => (
                <div
                  key={discard.id}
                  className="flex flex-col gap-2 rounded border bg-slate-50 px-3 py-2 text-xs sm:flex-row sm:items-start sm:justify-between sm:gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono font-semibold">
                      {discard.invoice_number}
                    </p>
                    <p className="text-muted-foreground mt-0.5">
                      {discard.note}
                    </p>
                    <p className="text-[10px] text-muted-foreground/80 mt-1">
                      {discard.discarded_by_name || "Unknown"} ·{" "}
                      {formatIndianDateTime(discard.discarded_at, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full shrink-0 text-xs sm:h-7 sm:w-auto"
                    disabled={isSubmitting}
                    onClick={() => handleRestore(discard)}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Restore
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={actionTarget !== null}
        onOpenChange={(open) => !open && closeActionDialog()}
      >
        <DialogContent className="w-[calc(100%-1rem)] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {isSingleTarget
                ? actionTarget?.numbers[0]
                : `Range ${actionTarget?.label}`}
            </DialogTitle>
            <DialogDescription>
              {isSingleTarget
                ? "Generate an invoice for this number or discard it with a reason."
                : `${actionTarget?.numbers.length} missing numbers. Discard all with a note, or browse to generate individually.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {isSingleTarget && (
              <Button
                type="button"
                className="w-full justify-start"
                onClick={handleGenerate}
              >
                <FilePlus className="h-4 w-4 mr-2" />
                Generate invoice
              </Button>
            )}

            {!isSingleTarget && (
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start"
                onClick={handleBrowseRange}
              >
                <Search className="h-4 w-4 mr-2" />
                Browse individual numbers
              </Button>
            )}

            <div className="space-y-2 border-t pt-4">
              <Label htmlFor="discard-note">
                Discard {isSingleTarget ? "number" : "range"}
                <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Textarea
                id="discard-note"
                placeholder="Reason for skipping this invoice number (required)"
                value={discardNote}
                onChange={(e) => setDiscardNote(e.target.value)}
                rows={3}
                required
              />
              <p className="text-xs text-muted-foreground">
                Discarded numbers are hidden from the missing list. You can
                restore them later if needed.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={closeActionDialog}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <IconTooltip
              label={
                isSingleTarget
                  ? "Discard"
                  : `Discard (${actionTarget?.numbers.length})`
              }
            >
              <Button
                type="button"
                variant="destructive"
                onClick={handleDiscard}
                disabled={isSubmitting || !discardNote.trim()}
              >
                {isSubmitting ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Discard{!isSingleTarget ? ` (${actionTarget?.numbers.length})` : ""}
              </Button>
            </IconTooltip>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
