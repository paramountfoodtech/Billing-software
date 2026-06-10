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

  const initialBoxCount = challan?.num_boxes || 1;
  const [numBoxesInput, setNumBoxesInput] = useState(String(initialBoxCount));
  const numBoxes = useMemo(() => {
    const parsed = parseInt(numBoxesInput, 10);
    if (Number.isNaN(parsed) || parsed < 1) return 1;
    return Math.min(100, parsed);
  }, [numBoxesInput]);
  const boxGridColumns = useBoxGridColumns();
  const [boxes, setBoxes] = useState<ChallanBox[]>(() => {
    if (challan?.challan_boxes?.length) {
      return challan.challan_boxes.map((b) => ({
        box_number: b.box_number,
        weight_kg: String(b.weight_kg),
        num_birds: b.num_birds != null ? String(b.num_birds) : "",
      }));
    }
    return Array.from({ length: initialBoxCount }, (_, i) => ({
      box_number: i + 1,
      weight_kg: "",
      num_birds: "",
    }));
  });

  const [formData, setFormData] = useState({
    challan_number: challan?.challan_number || suggestedNumber || "",
    purchaser_id: challan?.purchaser_id || "",
    challan_date: challan?.challan_date || getIndianToday(),
    notes: challan?.notes || "",
  });

  const isEditable = !challan || challan.status === "draft";

  useEffect(() => {
    setBoxes((prev) => {
      const next: ChallanBox[] = [];
      for (let i = 0; i < numBoxes; i++) {
        const existing = prev.find((b) => b.box_number === i + 1);
        next.push({
          box_number: i + 1,
          weight_kg: existing?.weight_kg || "",
          num_birds: existing?.num_birds || "",
        });
      }
      return next;
    });
  }, [numBoxes]);

  const totalWeight = useMemo(() => {
    return boxes.reduce((sum, b) => sum + (Number(b.weight_kg) || 0), 0);
  }, [boxes]);

  const boxGridRows = useMemo(
    () => Math.ceil(boxes.length / boxGridColumns) || 1,
    [boxes.length, boxGridColumns],
  );

  const totalBirds = useMemo(() => {
    return boxes.reduce((sum, b) => sum + (Number(b.num_birds) || 0), 0);
  }, [boxes]);

  const purchaserOptions = purchasers.map((p) => ({
    value: p.id,
    label: p.name,
  }));

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

  const handleNumBoxesChange = (value: string) => {
    if (value === "" || /^\d+$/.test(value)) {
      setNumBoxesInput(value);
    }
  };

  const handleNumBoxesBlur = () => {
    const parsed = parseInt(numBoxesInput, 10);
    const clamped = Number.isNaN(parsed)
      ? 1
      : Math.min(100, Math.max(1, parsed));
    setNumBoxesInput(String(clamped));
  };

  const saveChallan = async (status: "draft" | "final") => {
    if (!formData.purchaser_id) {
      toast({
        variant: "destructive",
        title: "Select purchaser",
        description: "Please select a purchaser for this challan.",
      });
      return;
    }

    if (!formData.challan_number.trim()) {
      toast({
        variant: "destructive",
        title: "Missing challan number",
        description: "Please enter a challan reference number.",
      });
      return;
    }

    if (status === "final" && totalWeight <= 0) {
      toast({
        variant: "destructive",
        title: "Invalid weights",
        description: "Please enter weight for at least one box before finalizing.",
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
        num_boxes: numBoxes,
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
          summary: status === "final" ? "Finalized challan" : "Saved as draft",
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
        title: status === "final" ? "Challan finalized" : "Challan saved",
        description:
          status === "final"
            ? "Challan is ready for invoice generation."
            : "Challan saved as draft.",
      });

      router.push("/dashboard/challans");
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save challan.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveChallan("final");
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="challan_number">
                Challan Number <span className="text-red-500">*</span>
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
            <div className="flex items-center justify-between">
              <Label>Box Details (Weight &amp; Birds)</Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="num_boxes" className="text-sm text-muted-foreground">
                  Number of boxes:
                </Label>
                <Input
                  id="num_boxes"
                  type="number"
                  max={100}
                  inputMode="numeric"
                  value={numBoxesInput}
                  onChange={(e) => handleNumBoxesChange(e.target.value)}
                  onBlur={handleNumBoxesBlur}
                  className="w-20 h-8"
                  disabled={!isEditable}
                />
              </div>
            </div>

            <div
              className="grid gap-3 grid-flow-col"
              style={{
                gridTemplateRows: `repeat(${boxGridRows}, auto)`,
                gridTemplateColumns: `repeat(${boxGridColumns}, minmax(0, 1fr))`,
              }}
            >
              {boxes.map((box) => (
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
                        disabled={!isEditable}
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

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
              <Button type="submit" disabled={isLoading}>
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
              Back to Challans
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
