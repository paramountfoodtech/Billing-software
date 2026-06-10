"use client";



import { useRouter, useSearchParams } from "next/navigation";

import { MonthYearPicker } from "@/components/month-year-picker";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {

  PurchaseReportsTable,

  type PurchaserReportRow,

  type ChallanTrackingRow,

} from "@/components/purchase-reports-table";



interface PurchaseReportsPageClientProps {

  reportYear: number;

  reportMonth: number;

  monthLabel: string;

  purchaserRows: PurchaserReportRow[];

  challanRows: ChallanTrackingRow[];

}



export function PurchaseReportsPageClient({

  reportYear,

  reportMonth,

  monthLabel,

  purchaserRows,

  challanRows,

}: PurchaseReportsPageClientProps) {

  const router = useRouter();

  const searchParams = useSearchParams();

  const activeTab =

    (searchParams.get("tab") as "purchaser" | "challan") || "purchaser";



  const handleTabChange = (tab: string) => {

    const params = new URLSearchParams(searchParams.toString());

    if (tab === "purchaser") {

      params.delete("tab");

    } else {

      params.set("tab", tab);

    }

    const qs = params.toString();

    router.push(qs ? `/dashboard/purchase-reports?${qs}` : "/dashboard/purchase-reports");

  };



  return (

    <div className="w-full p-4 sm:p-6 lg:p-8">

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <p className="text-xs sm:text-sm text-muted-foreground">

            Monthly Report:{" "}

            <span className="font-semibold text-foreground">{monthLabel}</span>

          </p>

        </div>

        <MonthYearPicker

          currentYear={reportYear}

          currentMonth={reportMonth}

          basePath="/dashboard/purchase-reports"

        />

      </div>



      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">

        <TabsList className="flex w-full flex-wrap justify-start sm:w-auto">

          <TabsTrigger value="purchaser">Purchaser Report</TabsTrigger>

          <TabsTrigger value="challan">Challan Tracking</TabsTrigger>

        </TabsList>



        <TabsContent value="purchaser" className="space-y-8 outline-none">

          <div>

            <h2 className="mb-3 text-lg font-semibold">Purchaser Purchase Report</h2>

            <PurchaseReportsTable

              purchaserRows={purchaserRows}

              challanRows={challanRows}

              monthLabel={monthLabel}

              activeTab="purchaser"

            />

          </div>

        </TabsContent>



        <TabsContent value="challan" className="outline-none">

          <h2 className="mb-3 text-lg font-semibold">Challan Tracking</h2>

          <PurchaseReportsTable

            purchaserRows={purchaserRows}

            challanRows={challanRows}

            monthLabel={monthLabel}

            activeTab="challan"

          />

        </TabsContent>

      </Tabs>

    </div>

  );

}

