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
import {
  getProfileDisplayName,
  logEntryHistory,
} from "@/lib/entry-history";
import { createClient } from "@/lib/supabase/client";
import { getIndianToday } from "@/lib/date-time";
import { useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import { Trash2 } from "lucide-react";

function useBoxGridColumns() {
  const [cols, setCols] = useState(1);

  useEffect(() => {
    const sm = window.matchMedia("(min-width: 640px)");
    const lg = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      setCols(lg.matches ? 3 : sm.matches ? 2 : 1);
    };
    update();
    sm.addEventListener("change", update);
    lg.addEventListener("change", update);
    return () => {
      sm.removeEventListener("change", update);
      lg.removeEventListener("change", update);
    };
  }, []);

  return cols;
}

interface Purchaser {
  id: string;
  name: string;
}

interface ChallanBox {
  box_number: number;
  weight_kg: string;
  num_birds: string;
  set_number: number;
}

interface Challan {
  id: string;
  challan_number: string;
  purchaser_id: string;
  challan_date: string;
  num_boxes: number;
  total_weight_kg: string;
  total_birds?: number;
  status: string;
  notes: string | null;
  challan_boxes?: { box_number: number; weight_kg: string; num_birds?: number }[];
}

interface ChallanFormProps {
  purchasers: Purchaser[];
  challan?: Challan;
  suggestedNumber?: string;
}

export function ChallanForm({
  purchasers,
  challan,
  suggestedNumber,
}: ChallanFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [manualBoxesInput, setManualBoxesInput] = useState("");
  const [setBoxesInput, setSetBoxesInput] = useState("");
  const [setBirdsInput, setSetBirdsInput] = useState("");
  const boxGridColumns = useBoxGridColumns();
  const [birdsLocked, setBirdsLocked] = useState(
    () =>
      Boolean(
        challan?.challan_boxes?.some((b) => (b.num_birds ?? 0) > 0),
      ),
  );
  const [boxes, setBoxes] = useState<ChallanBox[]>(() => {
    if (challan?.challan_boxes?.length) {
      // Group consecutive same bird counts into sets for edit display
      let setNumber = 1;
      let prevBirds: number | null = null;
      return [...challan.challan_boxes]
        .sort((a, b) => a.box_number - b.box_number)
        .map((b) => {
          const birds = Number(b.num_birds ?? 0);
          if (prevBirds !== null && birds !== prevBirds) {
            setNumber += 1;
          }
          prevBirds = birds;
          return {
            box_number: b.box_number,
            weight_kg: String(b.weight_kg),
            num_birds: b.num_birds != null ? String(b.num_birds) : "",
            set_number: setNumber,
          };
        });
    }
    return [];
  });

  const [formData, setFormData] = useState({
    challan_number: challan?.challan_number || suggestedNumber || "",
    purchaser_id: challan?.purchaser_id || "",
    challan_date: challan?.challan_date || getIndianToday(),
    notes: challan?.notes || "",
  });

  const isEditable = !challan || challan.status === "draft";
  const allBoxesHaveWeights = useMemo(
    () =>
      boxes.length > 0 &&
      boxes.every((b) => Number(b.weight_kg) > 0),
    [boxes],
  );
  const canFinalize = allBoxesHaveWeights;

  const totalWeight = useMemo(() => {
    return boxes.reduce((sum, b) => sum + (Number(b.weight_kg) || 0), 0);
  }, [boxes]);

  const totalBirds = useMemo(() => {
    return boxes.reduce((sum, b) => sum + (Number(b.num_birds) || 0), 0);
  }, [boxes]);

  const setSummaries = useMemo(() => {
    const map = new Map<
      number,
      { set_number: number; boxCount: number; birdsPerBox: number }
    >();
    for (const box of boxes) {
      const sn = box.set_number ?? 0;
      const existing = map.get(sn);
      if (existing) {
        existing.boxCount += 1;
      } else {
        map.set(sn, {
          set_number: sn,
          boxCount: 1,
          birdsPerBox: Number(box.num_birds) || 0,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      // Manual (0) after numbered sets
      if (a.set_number === 0) return 1;
      if (b.set_number === 0) return -1;
      return a.set_number - b.set_number;
    });
  }, [boxes]);

  const boxesBySet = useMemo(() => {
    return setSummaries.map((summary) => ({
      ...summary,
      boxes: boxes.filter((b) => (b.set_number ?? 0) === summary.set_number),
    }));
  }, [boxes, setSummaries]);

  const numberedSetSummaries = setSummaries.filter((s) => s.set_number > 0);
  const manualSummary = setSummaries.find((s) => s.set_number === 0);

  const purchaserOptions = purchasers.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const renumberBoxes = (list: ChallanBox[]): ChallanBox[] => {
    const setOrder = Array.from(
      new Set(
        list
          .map((b) => b.set_number ?? 0)
          .filter((n) => n > 0),
      ),
    ).sort((a, b) => a - b);
    const setMap = new Map(setOrder.map((old, index) => [old, index + 1]));
    return list.map((box, index) => {
      const current = box.set_number ?? 0;
      return {
        ...box,
        box_number: index + 1,
        set_number: current === 0 ? 0 : setMap.get(current) || 1,
      };
    });
  };

  const handleBoxFieldChange = (
    boxNumber: number,
    field: "weight_kg" | "num_birds",
    value: string,
  ) => {
    setBoxes((prev) =>
      prev.map((b) =>
        b.box_number === boxNumber ? { ...b, [field]: value } : b,
      ),
    );
  };

  const handleCountFieldChange = (
    field: "manualBoxesInput" | "setBoxesInput" | "setBirdsInput",
    value: string,
  ) => {
    if (value === "" || /^\d+$/.test(value)) {
      if (field === "manualBoxesInput") setManualBoxesInput(value);
      else if (field === "setBoxesInput") setSetBoxesInput(value);
      else setSetBirdsInput(value);
    }
  };

  const applyBoxSet = () => {
    const boxCount = parseInt(setBoxesInput, 10);
    const birdsPerBox = parseInt(setBirdsInput, 10);

    if (Number.isNaN(boxCount) || boxCount < 1 || boxCount > 100) {
      toast({
        variant: "destructive",
        title: "Invalid box count",
        description: "Enter between 1 and 100 boxes for the set.",
      });
      return;
    }

    if (Number.isNaN(birdsPerBox) || birdsPerBox < 0) {
      toast({
        variant: "destructive",
        title: "Invalid bird count",
        description: "Enter birds per box as 0 or greater.",
      });
      return;
    }

    // Keep all existing boxes (sets + manual), then append the new set
    const preserved = boxes;
    const remainingSlots = 100 - preserved.length;
    if (boxCount > remainingSlots) {
      toast({
        variant: "destructive",
        title: "Box limit reached",
        description: `Only ${remainingSlots} more box(es) can be added (max 100).`,
      });
      return;
    }

    const existingSetNumbers = preserved
      .map((b) => b.set_number ?? 0)
      .filter((n) => n > 0);
    const nextSetNumber =
      existingSetNumbers.length === 0
        ? 1
        : Math.max(...existingSetNumbers) + 1;

    const added: ChallanBox[] = Array.from({ length: boxCount }, (_, index) => ({
      box_number: preserved.length + index + 1,
      weight_kg: "",
      num_birds: String(birdsPerBox),
      set_number: nextSetNumber,
    }));

    const next = renumberBoxes([...preserved, ...added]);
    setBoxes(next);
    setBirdsLocked(true);
    setSetBoxesInput("");
    setSetBirdsInput("");
    toast({
      variant: "success",
      title: "Box set added",
      description: `Added ${boxCount} box(es) with ${birdsPerBox} bird(s) each. You can add more sets or manual boxes.`,
    });
  };

  const addManualBoxes = () => {
    const boxCount = parseInt(manualBoxesInput, 10);

    if (Number.isNaN(boxCount) || boxCount < 1 || boxCount > 100) {
      toast({
        variant: "destructive",
        title: "Invalid box count",
        description: "Enter between 1 and 100 boxes to add manually.",
      });
      return;
    }

    const remainingSlots = 100 - boxes.length;
    if (boxCount > remainingSlots) {
      toast({
        variant: "destructive",
        title: "Box limit reached",
        description: `Only ${remainingSlots} more box(es) can be added (max 100).`,
      });
      return;
    }

    const added: ChallanBox[] = Array.from({ length: boxCount }, (_, index) => ({
      box_number: boxes.length + index + 1,
      weight_kg: "",
      num_birds: "",
      set_number: 0,
    }));

    setBoxes(renumberBoxes([...boxes, ...added]));
    setManualBoxesInput("");
    toast({
      variant: "success",
      title: "Manual boxes added",
      description: `Added ${boxCount} box(es). Enter weight and birds for each.`,
    });
  };

  const removeBoxSet = (setNumber: number) => {
    const next = renumberBoxes(
      boxes.filter((b) => (b.set_number ?? 0) !== setNumber),
    );
    setBoxes(next);
    if (next.every((b) => (b.set_number ?? 0) === 0)) {
      setBirdsLocked(false);
    }
  };

  const saveChallan = async (status: "draft" | "final") => {
    if (!formData.purchaser_id) {
      toast({
        variant: "destructive",
        title: "Select purchaser",
        description: "Please select a purchaser for this purchase challan.",
      });
      return;
    }

    if (!formData.challan_number.trim()) {
      toast({
        variant: "destructive",
        title: "Missing purchase challan number",
        description: "Please enter a purchase challan reference number.",
      });
      return;
    }

    if (status === "final" && !allBoxesHaveWeights) {
      toast({
        variant: "destructive",
        title: "Invalid weights",
        description: "Please enter weight for every box before finalizing.",
      });
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!profile?.organization_id) {
        throw new Error("User must belong to an organization");
      }

      const challanPayload = {
        challan_number: formData.challan_number.trim(),
        purchaser_id: formData.purchaser_id,
        challan_date: formData.challan_date,
        num_boxes: boxes.length,
        total_weight_kg: totalWeight,
        total_birds: totalBirds,
        status,
        notes: formData.notes || null,
        updated_at: new Date().toISOString(),
      };

      let challanId = challan?.id;

      if (challan) {
        const { error } = await supabase
          .from("challans")
          .update(challanPayload)
          .eq("id", challan.id);
        if (error) throw error;

        await supabase.from("challan_boxes").delete().eq("challan_id", challan.id);

        const userName = await getProfileDisplayName(supabase, user.id);
        await logEntryHistory(supabase, {
          organizationId: profile.organization_id,
          entityType: "challan",
          entityId: challan.id,
          action: "updated",
          userId: user.id,
          userName,
          summary: status === "final" ? "Finalized purchase challan" : "Saved as draft",
        });
      } else {
        const { data: created, error } = await supabase
          .from("challans")
          .insert({
            ...challanPayload,
            created_by: user.id,
            organization_id: profile.organization_id,
          })
          .select("id")
          .single();
        if (error) throw error;
        challanId = created?.id;

        if (challanId) {
          const userName = await getProfileDisplayName(supabase, user.id);
          await logEntryHistory(supabase, {
            organizationId: profile.organization_id,
            entityType: "challan",
            entityId: challanId,
            action: "created",
            userId: user.id,
            userName,
            summary: status === "final" ? "Created as final" : "Created as draft",
          });
        }
      }

      if (challanId && (totalWeight > 0 || totalBirds > 0)) {
        const boxRows = boxes
          .filter(
            (b) => Number(b.weight_kg) > 0 || Number(b.num_birds) > 0,
          )
          .map((b) => ({
            challan_id: challanId,
            box_number: b.box_number,
            weight_kg: Number(b.weight_kg) || 0,
            num_birds: Math.max(0, Math.floor(Number(b.num_birds) || 0)),
          }));

        if (boxRows.length > 0) {
          const { error: boxError } = await supabase
            .from("challan_boxes")
            .insert(boxRows);
          if (boxError) throw boxError;
        }
      }

      toast({
        variant: "success",
        title: status === "final" ? "Purchase challan finalized" : "Purchase challan saved",
        description:
          status === "final"
            ? "Purchase challan is ready for invoice generation."
            : "Purchase challan saved as draft.",
      });

      router.push("/dashboard/challans");
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save purchase challan.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFinalize) return;
    saveChallan("final");
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="challan_number">
                Purchase challan Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="challan_number"
                required
                value={formData.challan_number}
                placeholder="CH-2026-001"
                disabled
                readOnly
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="challan_date">
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="challan_date"
                type="date"
                required
                value={formData.challan_date}
                onChange={(e) =>
                  setFormData({ ...formData, challan_date: e.target.value })
                }
                disabled={!isEditable}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>
                Purchaser <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                value={formData.purchaser_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, purchaser_id: value })
                }
                options={purchaserOptions}
                placeholder="Select purchaser..."
                searchPlaceholder="Search purchaser..."
                disabled={!isEditable}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Label>Box Details (Weight &amp; Birds)</Label>
              <span className="text-sm text-muted-foreground">
                Total boxes: {boxes.length}
              </span>
            </div>

            <div className="space-y-3 rounded-lg border bg-slate-50/80 p-4">
              <div>
                <Label>Create box sets</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Add one or more sets with the same birds-per-box. Each set is
                  appended to this purchase challan.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <div className="space-y-1">
                  <Label htmlFor="set_boxes" className="text-sm">
                    Number of boxes
                  </Label>
                  <Input
                    id="set_boxes"
                    type="number"
                    min={1}
                    max={100}
                    inputMode="numeric"
                    value={setBoxesInput}
                    onChange={(e) =>
                      handleCountFieldChange("setBoxesInput", e.target.value)
                    }
                    placeholder="e.g. 10"
                    disabled={!isEditable}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="set_birds" className="text-sm">
                    Birds per box
                  </Label>
                  <Input
                    id="set_birds"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={setBirdsInput}
                    onChange={(e) =>
                      handleCountFieldChange("setBirdsInput", e.target.value)
                    }
                    placeholder="e.g. 12"
                    disabled={!isEditable}
                    className="h-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={applyBoxSet}
                  disabled={!isEditable}
                  className="h-9"
                >
                  Add set
                </Button>
              </div>

              {numberedSetSummaries.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Added sets ({numberedSetSummaries.length})
                    </p>
                    <div className="flex flex-col gap-2">
                      {numberedSetSummaries.map((set) => (
                        <div
                          key={set.set_number}
                          className="flex items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm"
                        >
                          <span>
                            Set {set.set_number}:{" "}
                            <span className="font-medium">
                              {set.boxCount} box(es) × {set.birdsPerBox} bird(s)
                            </span>
                          </span>
                          {isEditable && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-destructive hover:text-destructive"
                              onClick={() => removeBoxSet(set.set_number)}
                              title={`Remove set ${set.set_number}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            <div className="space-y-3 rounded-lg border bg-slate-50/80 p-4">
              <div>
                <Label>Add manual boxes</Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Add boxes by count and enter weight and birds for each box
                  yourself.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="space-y-1">
                  <Label htmlFor="manual_boxes" className="text-sm">
                    Number of boxes
                  </Label>
                  <Input
                    id="manual_boxes"
                    type="number"
                    min={1}
                    max={100}
                    inputMode="numeric"
                    value={manualBoxesInput}
                    onChange={(e) =>
                      handleCountFieldChange("manualBoxesInput", e.target.value)
                    }
                    placeholder="e.g. 5"
                    disabled={!isEditable}
                    className="h-9"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addManualBoxes}
                  disabled={!isEditable}
                  className="h-9"
                >
                  Add boxes
                </Button>
              </div>

              {manualSummary && (
                <div className="flex items-center justify-between gap-2 rounded-md border bg-white px-3 py-2 text-sm">
                  <span>
                    Manual boxes:{" "}
                    <span className="font-medium">
                      {manualSummary.boxCount} box(es)
                    </span>
                  </span>
                  {isEditable && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-destructive hover:text-destructive"
                      onClick={() => removeBoxSet(0)}
                      title="Remove manual boxes"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            {boxes.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center">
                No boxes yet. Add a set or manual boxes above.
              </p>
            ) : (
            <div className="space-y-5">
              {boxesBySet.map((set) => {
                const setRows =
                  Math.ceil(set.boxes.length / boxGridColumns) || 1;
                const isManual = set.set_number === 0;
                const birdFieldsLocked = birdsLocked && !isManual;
                return (
                  <div key={set.set_number} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-sm">
                        {isManual ? "Manual boxes" : `Set ${set.set_number}`}
                        <span className="ml-2 font-normal text-muted-foreground">
                          {isManual
                            ? `${set.boxCount} box(es) · enter birds per box`
                            : `${set.boxCount} box(es) · ${set.birdsPerBox} bird(s) each`}
                        </span>
                      </Label>
                    </div>
                    <div
                      className="grid gap-3 grid-flow-col"
                      style={{
                        gridTemplateRows: `repeat(${setRows}, auto)`,
                        gridTemplateColumns: `repeat(${boxGridColumns}, minmax(0, 1fr))`,
                      }}
                    >
                      {set.boxes.map((box) => (
                        <div
                          key={box.box_number}
                          className="rounded-lg border bg-slate-50/50 p-3 space-y-2"
                        >
                          <Label className="text-xs font-medium text-muted-foreground">
                            Box {box.box_number}
                          </Label>
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">
                                Weight (KG)
                              </Label>
                              <Input
                                type="number"
                                step="0.001"
                                min="0"
                                value={box.weight_kg}
                                onChange={(e) =>
                                  handleBoxFieldChange(
                                    box.box_number,
                                    "weight_kg",
                                    e.target.value,
                                  )
                                }
                                placeholder="0.000"
                                disabled={!isEditable}
                                className="h-8"
                                tabIndex={0}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[11px] text-muted-foreground">
                                No. of Birds
                              </Label>
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                value={box.num_birds}
                                onChange={(e) =>
                                  handleBoxFieldChange(
                                    box.box_number,
                                    "num_birds",
                                    e.target.value,
                                  )
                                }
                                placeholder="0"
                                disabled={!isEditable || birdFieldsLocked}
                                readOnly={birdFieldsLocked}
                                tabIndex={birdFieldsLocked ? -1 : 0}
                                className={`h-8 ${birdFieldsLocked ? "bg-muted" : ""}`}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            )}

            <div className="p-4 bg-slate-50 rounded-lg border space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Weight</span>
                <span className="text-lg font-bold">
                  {totalWeight.toFixed(3)} KG
                </span>
              </div>
              <div className="flex justify-between items-center border-t pt-2">
                <span className="font-medium">Total Birds</span>
                <span className="text-lg font-bold">{totalBirds}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              rows={2}
              disabled={!isEditable}
            />
          </div>

          {isEditable && (
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={isLoading || !canFinalize}>
                {isLoading && <Spinner className="mr-2 h-4 w-4" />}
                Save & Finalize
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isLoading}
                onClick={() => saveChallan("draft")}
              >
                Save as Draft
              </Button>
              {!canFinalize && (
                <p className="w-full text-xs text-muted-foreground">
                  {boxes.length === 0
                    ? "Add a set or manual boxes, then enter weights to enable Save & Finalize."
                    : "Enter weight for every box to enable Save & Finalize."}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/challans")}
              >
                Cancel
              </Button>
            </div>
          )}

          {!isEditable && (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/challans")}
            >
              Back to purchase challans
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
