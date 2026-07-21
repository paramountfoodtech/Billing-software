"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MonthYearPicker } from "@/components/month-year-picker";
import { PurchaserSelector } from "@/components/purchaser-selector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  PurchaseReportsTable,
  type PurchaserReportRow,
  type ChallanTrackingRow,
} from "@/components/purchase-reports-table";

interface Purchaser {
  id: string;
  name: string;
}

interface PurchaseReportsPageClientProps {
  reportYear: number;
  reportMonth: number;
  rangeLabel: string;
  rangeStart: string;
  rangeEnd: string;
  purchaserRows: PurchaserReportRow[];
  challanRows: ChallanTrackingRow[];
  purchasers: Purchaser[];
  initialPurchaserId?: string | null;
}

export function PurchaseReportsPageClient({
  reportYear,
  reportMonth,
  rangeLabel,
  rangeStart,
  rangeEnd,
  purchaserRows,
  challanRows,
  purchasers,
  initialPurchaserId = null,
}: PurchaseReportsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab =
    (searchParams.get("tab") as "purchaser" | "challan") || "purchaser";
  const selectedPurchaserId =
    searchParams.get("purchaser") || initialPurchaserId || null;

  const selectedPurchaserName = useMemo(() => {
    if (!selectedPurchaserId) return "All Purchasers";
    return (
      purchasers.find((p) => p.id === selectedPurchaserId)?.name ||
      "Selected purchaser"
    );
  }, [purchasers, selectedPurchaserId]);

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.push(
      qs ? `/dashboard/purchase-reports?${qs}` : "/dashboard/purchase-reports",
    );
  };

  const handleTabChange = (tab: string) => {
    updateParams({ tab: tab === "purchaser" ? null : tab });
  };

  const filteredPurchaserRows = useMemo(() => {
    if (!selectedPurchaserId) return purchaserRows;
    return purchaserRows.filter((row) => row.id === selectedPurchaserId);
  }, [purchaserRows, selectedPurchaserId]);

  const filteredChallanRows = useMemo(() => {
    if (!selectedPurchaserId) return challanRows;
    return challanRows.filter(
      (row) =>
        row.purchaser_id === selectedPurchaserId ||
        row.purchaser_name === selectedPurchaserName,
    );
  }, [challanRows, selectedPurchaserId, selectedPurchaserName]);

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Report period:{" "}
              <span className="font-semibold text-foreground">{rangeLabel}</span>
            </p>
          </div>
          <MonthYearPicker
            currentYear={reportYear}
            currentMonth={reportMonth}
            basePath="/dashboard/purchase-reports"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-sm text-muted-foreground">Purchaser</Label>
            <PurchaserSelector
              purchasers={purchasers}
              selectedPurchaserId={selectedPurchaserId}
              onPurchaserChange={(id) =>
                updateParams({ purchaser: id })
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report_from" className="text-sm text-muted-foreground">
              From
            </Label>
            <input
              id="report_from"
              type="date"
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={rangeStart}
              onChange={(e) => updateParams({ from: e.target.value || null })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report_to" className="text-sm text-muted-foreground">
              To
            </Label>
            <input
              id="report_to"
              type="date"
              className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
              value={rangeEnd}
              onChange={(e) => updateParams({ to: e.target.value || null })}
            />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex w-full flex-wrap justify-start sm:w-auto">
          <TabsTrigger value="purchaser">Purchaser Report</TabsTrigger>
          <TabsTrigger value="challan">Purchase challan tracking</TabsTrigger>
        </TabsList>

        <TabsContent value="purchaser" className="space-y-8 outline-none">
          <div>
            <h2 className="mb-3 text-lg font-semibold">
              Purchaser Purchase Report
            </h2>
            <PurchaseReportsTable
              purchaserRows={filteredPurchaserRows}
              challanRows={filteredChallanRows}
              monthLabel={rangeLabel}
              activeTab="purchaser"
              fromDate={rangeStart}
              toDate={rangeEnd}
              selectedPurchaserId={selectedPurchaserId}
              selectedPurchaserName={selectedPurchaserName}
            />
          </div>
        </TabsContent>

        <TabsContent value="challan" className="outline-none">
          <h2 className="mb-3 text-lg font-semibold">
            Purchase challan tracking
          </h2>
          <PurchaseReportsTable
            purchaserRows={filteredPurchaserRows}
            challanRows={filteredChallanRows}
            monthLabel={rangeLabel}
            activeTab="challan"
            fromDate={rangeStart}
            toDate={rangeEnd}
            selectedPurchaserId={selectedPurchaserId}
            selectedPurchaserName={selectedPurchaserName}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
