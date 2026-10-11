"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil, Printer, CheckCircle } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatIndianDate } from "@/lib/date-time";
import { IconTooltip } from "@/components/icon-tooltip";
import { canEditChallan } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { getProfileDisplayName, logEntryHistory } from "@/lib/entry-history";

interface InvoiceTemplate {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  company_logo_url: string | null;
  company_logo_file: string | null;
}

interface Challan {
  id: string;
  challan_number: string;
  challan_date: string;
  num_boxes: number;
  total_weight_kg: string;
  total_birds?: number;
  mortality_birds?: number;
  mortality_weight_kg?: string | number;
  status: string;
  notes: string | null;
  purchasers: {
    name: string;
    purchaser_code: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
  };
  challan_boxes?: { box_number: number; weight_kg: string; num_birds?: number }[];
}

interface PrintableChallanProps {
  challan: Challan;
  template?: InvoiceTemplate;
  userRole?: string;
  invoiceAmountPaid?: string | number | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-800" },
  final: { label: "Final", className: "bg-blue-100 text-blue-800" },
  invoiced: { label: "Invoiced", className: "bg-green-100 text-green-800" },
};

export function PrintableChallan({
  challan,
  template,
  userRole,
  invoiceAmountPaid = null,
}: PrintableChallanProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const boxes = challan.challan_boxes || [];
  const totalBirds =
    challan.total_birds ??
    boxes.reduce((sum, box) => sum + Number(box.num_birds || 0), 0);
  const mortalityBirds = Math.max(0, Number(challan.mortality_birds || 0));
  const mortalityWeightKg = Math.max(0, Number(challan.mortality_weight_kg || 0));
  const netDeliveredBirds = Math.max(0, totalBirds - mortalityBirds);
  const netDeliveredWeightKg = Math.max(
    0,
    Math.round((Number(challan.total_weight_kg || 0) - mortalityWeightKg + Number.EPSILON) * 100) / 100
  );
  const statusInfo = statusConfig[challan.status] || {
    label: challan.status,
    className: "bg-gray-100 text-gray-800",
  };

  const handleFinalize = async () => {
    setIsFinalizing(true);
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

      if (!profile?.organization_id) throw new Error("Organization not found");

      const { error } = await supabase
        .from("challans")
        .update({
          status: "final",
          updated_at: new Date().toISOString(),
        })
        .eq("id", challan.id);

      if (error) throw error;

      const userName = await getProfileDisplayName(supabase, user.id);
      await logEntryHistory(supabase, {
        organizationId: profile.organization_id,
        entityType: "challan",
        entityId: challan.id,
        action: "updated",
        userId: user.id,
        userName,
        summary: "Finalized purchase challan",
      });

      toast({
        variant: "success",
        title: "Purchase challan finalized",
        description: "Status is now Final. Challan is ready for invoice generation.",
      });

      router.refresh();
    } catch (err: unknown) {
      toast({
        variant: "destructive",
        title: "Finalization failed",
        description: err instanceof Error ? err.message : "Failed to finalize purchase challan.",
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  const defaultTemplate: InvoiceTemplate = {
    company_name: "Your Company Name",
    company_address: "123 Business Street, City, State 12345",
    company_phone: "+91 00000 00000",
    company_email: "info@company.com",
    company_logo_url: "/PFT logo.png",
    company_logo_file: null,
  };

  const activeTemplate = template || defaultTemplate;
  const logoSrc =
    activeTemplate.company_logo_file || activeTemplate.company_logo_url;

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }
        .print-area, .print-area * {
          visibility: visible;
        }
        .print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .no-print {
          display: none !important;
        }
        @page {
          margin: 1cm;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <>
      <div className="no-print mb-3 flex items-center justify-between gap-2">
        <Button asChild variant="outline">
          <Link href="/dashboard/challans">Back</Link>
        </Button>
        <div className="flex items-center gap-2">
          {challan.status === "draft" && (
            <Button
              onClick={handleFinalize}
              disabled={isFinalizing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
            >
              {isFinalizing ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Finalise Challan
            </Button>
          )}
          {canEditChallan(userRole, challan.status, invoiceAmountPaid) && (
            <IconTooltip label="Edit">
              <Button asChild variant="outline">
                <Link href={`/dashboard/challans/${challan.id}/edit`}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </Link>
              </Button>
            </IconTooltip>
          )}
          <IconTooltip label="Print purchase challan">
            <Button onClick={handlePrint} disabled={isPrinting}>
              <Printer className="h-4 w-4 mr-2" />
              Print purchase challan
            </Button>
          </IconTooltip>
        </div>
      </div>

      <Card className="print-area">
        <CardContent className="p-5 md:p-6 text-sm">
          <div className="flex justify-between items-start mb-5">
            <div>
              {logoSrc && (
                <img
                  src={logoSrc}
                  alt="Company Logo"
                  className="h-14 mb-3 object-contain"
                />
              )}
              <h1 className="text-xl font-bold">{activeTemplate.company_name}</h1>
              <div className="text-xs text-muted-foreground mt-1.5">
                <p>{activeTemplate.company_address}</p>
                <p>Phone: {activeTemplate.company_phone}</p>
                <p>Email: {activeTemplate.company_email}</p>
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold mb-1.5">PURCHASE CHALLAN</h2>
              <div className="text-xs">
                <p className="font-semibold">
                  Purchase challan #: {challan.challan_number}
                </p>
                <p>
                  Date:{" "}
                  {formatIndianDate(challan.challan_date, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <div className="mt-2 flex justify-end">
                  <Badge variant="secondary" className={statusInfo.className}>
                    {statusInfo.label}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-5">
            <h3 className="font-semibold mb-1.5">Purchased From:</h3>
            <div className="text-xs">
              <p className="font-medium">{challan.purchasers.name}</p>
              <p className="text-muted-foreground">
                ID: {challan.purchasers.purchaser_code}
              </p>
              {challan.purchasers.address && <p>{challan.purchasers.address}</p>}
              {challan.purchasers.city && challan.purchasers.state && (
                <p>
                  {challan.purchasers.city}, {challan.purchasers.state}{" "}
                  {challan.purchasers.zip_code}
                </p>
              )}
              {challan.purchasers.email && (
                <p>Email: {challan.purchasers.email}</p>
              )}
              {challan.purchasers.phone && (
                <p>Phone: {challan.purchasers.phone}</p>
              )}
            </div>
          </div>

          {boxes.length > 0 ? (
            <table className="w-full mb-5">
              <thead className="border-b-2 border-gray-300">
                <tr>
                  <th className="text-left py-2">Box #</th>
                  <th className="text-right py-2">Weight (KG)</th>
                  <th className="text-right py-2">Birds</th>
                </tr>
              </thead>
              <tbody>
                {boxes.map((box) => (
                  <tr key={box.box_number} className="border-b border-gray-200">
                    <td className="py-2">{box.box_number}</td>
                    <td className="text-right py-2">
                      {Number(box.weight_kg).toFixed(3)}
                    </td>
                    <td className="text-right py-2">
                      {Number(box.num_birds || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-300">
                  <td className="py-2 font-semibold">Total ({challan.num_boxes} boxes)</td>
                  <td className="text-right font-semibold">
                    {Number(challan.total_weight_kg).toFixed(3)}
                  </td>
                  <td className="text-right font-semibold">{totalBirds}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <div className="mb-5 rounded border p-4 text-xs text-muted-foreground">
              No box weights recorded.
            </div>
          )}

          <div className="flex justify-end mb-5">
            <div className="w-80 sm:w-96">
              <div className="flex justify-between py-1.5 text-sm">
                <span className="text-muted-foreground">Gross Weight (Loaded):</span>
                <span className="font-semibold">{Number(challan.total_weight_kg).toFixed(3)} KG</span>
              </div>
              <div className="flex justify-between py-1.5 text-sm border-t border-gray-100">
                <span className="text-muted-foreground">Gross Birds (Loaded):</span>
                <span className="font-semibold">{totalBirds}</span>
              </div>
              {(mortalityBirds > 0 || mortalityWeightKg > 0) && (
                <>
                  <div className="flex justify-between py-1.5 text-sm border-t border-gray-100 text-rose-700">
                    <span>Less: Transit Mortality (Weight):</span>
                    <span className="font-semibold">
                      -{mortalityWeightKg.toFixed(3)} KG
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 text-sm text-rose-700">
                    <span>Less: Transit Mortality (Birds):</span>
                    <span className="font-semibold">
                      -{mortalityBirds} birds
                    </span>
                  </div>
                  <div className="flex justify-between py-2 font-bold text-base border-t-2 border-gray-300">
                    <span>Net Delivered Weight:</span>
                    <span>{netDeliveredWeightKg.toFixed(3)} KG</span>
                  </div>
                  <div className="flex justify-between py-1.5 font-bold text-sm">
                    <span>Net Delivered Birds:</span>
                    <span>{netDeliveredBirds}</span>
                  </div>
                </>
              )}
              {mortalityBirds === 0 && mortalityWeightKg === 0 && (
                <div className="flex justify-between py-2 font-bold text-lg border-t-2 border-gray-300">
                  <span>Total Weight:</span>
                  <span>{Number(challan.total_weight_kg).toFixed(3)} KG</span>
                </div>
              )}
            </div>
          </div>

          {challan.notes && (
            <div className="mb-4">
              <h4 className="font-semibold mb-1">Notes:</h4>
              <p className="text-xs text-muted-foreground">{challan.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
