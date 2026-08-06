"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Download, Loader2, X } from "lucide-react";
import { IconTooltip } from "@/components/icon-tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import {
  calculateSalary,
  rebuildScheduleExtendTenure,
  rebuildScheduleRedistribute,
} from "@/lib/hr-calculations";
import type {
  SalaryRow,
  EmployeeRow,
  OrganizationInfo,
  InvoiceTemplateInfo,
  AdvanceRow,
  AdvanceScheduleRow,
} from "@/app/dashboard/expenses/payroll/payroll-page-client";

interface SalarySlipPrintableProps {
  salary: SalaryRow;
  employee: EmployeeRow;
  organization: OrganizationInfo | null;
  template?: InvoiceTemplateInfo | null;
  advances?: AdvanceRow[];
  advanceSchedules?: AdvanceScheduleRow[];
  organizationId?: string;
  onClose?: () => void;
  onSalaryUpdated?: (salary: SalaryRow) => void;
}

function formatINR(value: number | string) {
  return Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function numberToWords(num: number): string {
  if (!num || num <= 0) return "Zero Rupees Only";

  const a = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 !== 0 ? " " + inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 !== 0 ? " " + inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 !== 0 ? " " + inWords(n % 10000000) : "");
  }

  const integerPart = Math.floor(num);
  const paisePart = Math.round((num - integerPart) * 100);

  let result = inWords(integerPart) + " Rupees";
  if (paisePart > 0) {
    result += " and " + inWords(paisePart) + " Paise";
  }
  return result + " Only";
}

/** Shared stylesheet for on-screen preview and PDF capture. */
const SLIP_STYLES = `
  .salary-slip {
    --ink: #111827;
    --muted: #6b7280;
    --line: #e5e7eb;
    --soft: #f9fafb;
    --soft-2: #f3f4f6;
    --accent: #059669;
    --accent-bg: #ecfdf5;
    --accent-border: #a7f3d0;
    width: 100%;
    max-width: 1080px;
    margin: 0 auto;
    background: #ffffff;
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 12px;
    line-height: 1.4;
    padding: 24px 28px;
    box-sizing: border-box;
  }
  .salary-slip *, .salary-slip *::before, .salary-slip *::after {
    box-sizing: border-box;
  }
  .salary-slip .header {
    display: flex;
    align-items: flex-start;
    gap: 18px;
    margin-bottom: 2px;
  }
  .salary-slip .company-logo {
    max-height: 56px;
    max-width: 130px;
    object-fit: contain;
    flex-shrink: 0;
  }
  .salary-slip .logo-placeholder {
    width: 56px;
    height: 56px;
    background: var(--soft-2);
    border: 1px solid var(--line);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    color: var(--muted);
    font-size: 10px;
    text-align: center;
    padding: 6px;
    flex-shrink: 0;
  }
  .salary-slip .company-meta { min-width: 0; flex: 1; }
  .salary-slip .company-title {
    font-size: 20px;
    font-weight: 700;
    color: var(--ink);
    letter-spacing: -0.01em;
    margin: 0;
    line-height: 1.25;
  }
  .salary-slip .company-sub {
    font-size: 12px;
    color: #4b5563;
    margin: 3px 0 0;
  }
  .salary-slip .company-contact {
    font-size: 11px;
    color: var(--muted);
    margin: 2px 0 0;
  }
  .salary-slip .month-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink);
    margin: 6px 0 0;
  }
  .salary-slip .divider {
    border: 0;
    border-top: 1px solid var(--line);
    margin: 12px 0;
  }
  .salary-slip .summary-grid {
    display: grid;
    grid-template-columns: 1.35fr 0.85fr;
    gap: 24px;
    align-items: stretch;
  }
  .salary-slip .kv-table {
    width: 100%;
    border-collapse: collapse;
  }
  .salary-slip .kv-table td {
    padding: 4px 0;
    vertical-align: top;
    font-size: 12px;
  }
  .salary-slip .kv-table td.label {
    color: var(--muted);
    width: 118px;
    white-space: nowrap;
  }
  .salary-slip .kv-table td.colon {
    width: 14px;
    color: #374151;
    font-weight: 600;
  }
  .salary-slip .kv-table td.val {
    font-weight: 700;
    color: var(--ink);
  }
  .salary-slip .net-summary {
    background: var(--accent-bg);
    border: 1px solid var(--accent-border);
    border-radius: 8px;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 100px;
  }
  .salary-slip .net-amount {
    font-size: 22px;
    font-weight: 700;
    color: var(--accent);
    line-height: 1.15;
    letter-spacing: -0.02em;
  }
  .salary-slip .net-label {
    font-size: 11px;
    color: var(--muted);
    font-weight: 500;
    margin-top: 2px;
    margin-bottom: 8px;
  }
  .salary-slip .net-summary .kv-table td.label { width: 72px; }
  .salary-slip .section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--ink);
    margin: 0 0 8px;
  }
  .salary-slip .tables-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .salary-slip .panel {
    border: 1px solid var(--line);
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
  }
  .salary-slip .inc-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .salary-slip .inc-table th {
    background: var(--soft-2);
    text-align: left;
    padding: 7px 10px;
    border-bottom: 1px solid var(--line);
    font-weight: 700;
    color: var(--ink);
  }
  .salary-slip .inc-table th.num,
  .salary-slip .inc-table td.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .salary-slip .inc-table td {
    padding: 7px 10px;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
  }
  .salary-slip .inc-table tr:last-child td { border-bottom: 0; }
  .salary-slip .inc-table tr.total-row td {
    background: var(--soft);
    border-top: 1px solid var(--line);
    color: var(--ink);
    font-weight: 700;
  }
  .salary-slip .payable-card {
    background: var(--accent-bg);
    border: 1px solid var(--accent-border);
    border-radius: 8px;
    padding: 12px 16px;
    text-align: center;
  }
  .salary-slip .payable-title {
    font-size: 12px;
    font-weight: 700;
    color: #374151;
  }
  .salary-slip .payable-sub {
    font-size: 11px;
    color: var(--muted);
    margin-top: 2px;
  }
  .salary-slip .payable-amount {
    font-size: 22px;
    font-weight: 800;
    color: var(--accent);
    margin: 4px 0;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .salary-slip .payable-words {
    font-size: 11px;
    color: #4b5563;
    font-style: italic;
    font-weight: 500;
  }
  .salary-slip .disclaimer {
    text-align: center;
    font-size: 11px;
    color: #9ca3af;
    padding-top: 2px;
  }
  @media (max-width: 640px) {
    .salary-slip { padding: 16px; }
    .salary-slip .summary-grid,
    .salary-slip .tables-grid {
      grid-template-columns: 1fr;
    }
  }
`;

const PRINT_PAGE_STYLES = `
  @page {
    size: A4 landscape;
    margin: 8mm;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    padding: 0;
  }
  .salary-slip {
    max-width: none !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    font-size: 11px;
    line-height: 1.3;
  }
  .salary-slip .company-logo,
  .salary-slip .logo-placeholder {
    max-height: 42px;
    height: 42px;
  }
  .salary-slip .company-title { font-size: 16px; }
  .salary-slip .divider { margin: 7px 0; }
  .salary-slip .net-summary { min-height: 0; padding: 8px 12px; }
  .salary-slip .net-amount { font-size: 18px; }
  .salary-slip .payable-card { padding: 8px 12px; }
  .salary-slip .payable-amount { font-size: 18px; margin: 2px 0; }
  .salary-slip .inc-table th,
  .salary-slip .inc-table td { padding: 5px 8px; }
`;

const DEFAULT_LOGO_URL = "/PFT%20logo.png";

function toAbsoluteUrl(src: string) {
  if (!src) return src;
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (typeof window === "undefined") return src;
  try {
    return new URL(src, window.location.origin).href;
  } catch {
    return src;
  }
}

export function SalarySlipPrintable({
  salary,
  employee,
  organization,
  template,
  advances = [],
  advanceSchedules = [],
  organizationId,
  onClose,
  onSalaryUpdated,
}: SalarySlipPrintableProps) {
  const slipRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [emiInput, setEmiInput] = useState(String(Number(salary.advance_emi_deduction) || 0));
  const [emiConfirmOpen, setEmiConfirmOpen] = useState(false);
  const [pendingEmi, setPendingEmi] = useState<number | null>(null);
  const [extendMonths, setExtendMonths] = useState("1");
  const [isSavingEmi, setIsSavingEmi] = useState(false);
  const [localSalary, setLocalSalary] = useState(salary);

  useEffect(() => {
    setLocalSalary(salary);
    setEmiInput(String(Number(salary.advance_emi_deduction) || 0));
  }, [salary]);

  const canEditEmi =
    localSalary.payment_status !== "paid" &&
    Boolean(organizationId) &&
    (Number(localSalary.advance_emi_deduction) > 0 ||
      advances.some(
        (a) =>
          a.employee_id === employee.id &&
          (a.status === "active" || a.status === "completed"),
      ));

  const monthDate = new Date(`${localSalary.salary_month}-01`);
  const monthName = monthDate.toLocaleDateString("en-IN", { month: "long" });
  const yearName = monthDate.getFullYear();
  const monthLabel = `${monthName} ${yearName}`;

  const lastDayOfMonth = new Date(yearName, monthDate.getMonth() + 1, 0).getDate();
  const payDateFormatted = `${lastDayOfMonth} ${monthDate.toLocaleDateString("en-IN", { month: "short" })} ${yearName}`;

  const companyName = template?.company_name || organization?.name || "Paramount Food Tech";
  const companyAddress = template?.company_address || organization?.address || "";
  const companyPhone = template?.company_phone || organization?.phone || "";
  const companyEmail = template?.company_email || organization?.email || "";
  const logoSrc = template?.company_logo_file || template?.company_logo_url || DEFAULT_LOGO_URL;

  const paidDays = localSalary.days_present + localSalary.casual_leave;
  const lopDays = localSalary.loss_of_pay;
  const grossEarnings = Number(localSalary.earned_salary);
  const lopDeduction = Number(localSalary.lop_deduction);
  const advanceEmi = Number(localSalary.advance_emi_deduction);
  const totalDeductions = lopDeduction + advanceEmi;
  const netPayable = Number(localSalary.net_payable);
  const amountWords = numberToWords(netPayable);

  const safeFilename = `Payslip_${employee.name.replace(/[^\w.-]+/g, "_")}_${localSalary.salary_month}`;

  const requestEmiChange = () => {
    const next = Math.round(Number(emiInput) * 100) / 100;
    if (Number.isNaN(next) || next < 0) {
      toast({
        variant: "destructive",
        title: "Invalid EMI",
        description: "Enter a valid EMI amount (0 or more).",
      });
      setEmiInput(String(advanceEmi));
      return;
    }
    if (Math.abs(next - advanceEmi) < 0.005) return;
    setPendingEmi(next);
    setExtendMonths("1");
    setEmiConfirmOpen(true);
  };

  const futureUndeductedCountForDialog = useMemo(() => {
    const salaryMonth = localSalary.salary_month;
    const employeeAdvances = advances.filter(
      (a) =>
        a.employee_id === employee.id &&
        (a.status === "active" || a.status === "completed"),
    );
    const targetAdvance =
      employeeAdvances.find((adv) =>
        advanceSchedules.some(
          (s) =>
            s.advance_id === adv.id &&
            s.emi_month === salaryMonth &&
            (!s.is_deducted || s.salary_id === localSalary.id),
        ),
      ) || employeeAdvances.find((a) => a.status === "active");

    if (!targetAdvance) return 0;
    return advanceSchedules.filter(
      (s) =>
        s.advance_id === targetAdvance.id &&
        s.emi_month > salaryMonth &&
        !s.is_deducted &&
        s.salary_id !== localSalary.id,
    ).length;
  }, [
    advances,
    advanceSchedules,
    employee.id,
    localSalary.id,
    localSalary.salary_month,
  ]);

  const remainingAfterPendingEmi = useMemo(() => {
    if (pendingEmi == null) return 0;
    const salaryMonth = localSalary.salary_month;
    const employeeAdvances = advances.filter(
      (a) =>
        a.employee_id === employee.id &&
        (a.status === "active" || a.status === "completed"),
    );
    const targetAdvance =
      employeeAdvances.find((adv) =>
        advanceSchedules.some(
          (s) =>
            s.advance_id === adv.id &&
            s.emi_month === salaryMonth &&
            (!s.is_deducted || s.salary_id === localSalary.id),
        ),
      ) || employeeAdvances.find((a) => a.status === "active");
    if (!targetAdvance) return 0;

    const advSchedules = advanceSchedules.filter(
      (s) => s.advance_id === targetAdvance.id,
    );
    const currentRow = advSchedules.find((s) => s.emi_month === salaryMonth);
    const futureSum = advSchedules
      .filter(
        (s) =>
          s.emi_month > salaryMonth &&
          !s.is_deducted &&
          s.salary_id !== localSalary.id,
      )
      .reduce((sum, s) => sum + Number(s.emi_amount), 0);
    const currentScheduled = currentRow
      ? Number(currentRow.emi_amount)
      : advanceEmi;
    const outstandingBefore =
      Math.round((futureSum + currentScheduled) * 100) / 100;
    return Math.max(
      0,
      Math.round((outstandingBefore - pendingEmi) * 100) / 100,
    );
  }, [
    pendingEmi,
    advances,
    advanceSchedules,
    employee.id,
    localSalary,
    advanceEmi,
  ]);

  const applyEmiChange = async (mode: "extend" | "redistribute") => {
    if (pendingEmi == null || !organizationId) return;

    const extraMonths = Math.floor(Number(extendMonths));
    if (mode === "extend") {
      if (!Number.isFinite(extraMonths) || extraMonths < 1) {
        toast({
          variant: "destructive",
          title: "Invalid months",
          description: "Enter how many months to append (at least 1).",
        });
        return;
      }
    }

    setIsSavingEmi(true);
    const supabase = createClient();

    try {
      const salaryMonth = localSalary.salary_month;
      const employeeAdvances = advances.filter(
        (a) =>
          a.employee_id === employee.id &&
          (a.status === "active" || a.status === "completed"),
      );

      // Prefer the advance that has a schedule row for this month
      let targetAdvance = employeeAdvances.find((adv) =>
        advanceSchedules.some(
          (s) =>
            s.advance_id === adv.id &&
            s.emi_month === salaryMonth &&
            (!s.is_deducted || s.salary_id === localSalary.id),
        ),
      );
      if (!targetAdvance) {
        targetAdvance = employeeAdvances.find((a) => a.status === "active");
      }
      if (!targetAdvance) {
        throw new Error("No salary advance found for this employee.");
      }

      const advSchedules = advanceSchedules.filter(
        (s) => s.advance_id === targetAdvance!.id,
      );
      const currentRow = advSchedules.find((s) => s.emi_month === salaryMonth);
      const futureUndeducted = advSchedules.filter(
        (s) =>
          s.emi_month > salaryMonth &&
          !s.is_deducted &&
          s.salary_id !== localSalary.id,
      );
      const alreadyDeducted = advSchedules.filter(
        (s) =>
          s.is_deducted &&
          s.salary_id !== localSalary.id &&
          s.emi_month < salaryMonth,
      );

      const futureSum = futureUndeducted.reduce(
        (sum, s) => sum + Number(s.emi_amount),
        0,
      );
      const currentScheduled = currentRow
        ? Number(currentRow.emi_amount)
        : advanceEmi;
      const outstandingBeforeCurrent =
        Math.round((futureSum + currentScheduled) * 100) / 100;

      if (pendingEmi > outstandingBeforeCurrent + 0.01) {
        throw new Error(
          `EMI cannot exceed outstanding balance (₹${outstandingBeforeCurrent.toFixed(2)}).`,
        );
      }

      const rebuild =
        mode === "extend"
          ? rebuildScheduleExtendTenure({
              outstandingBeforeCurrent,
              newCurrentEmi: pendingEmi,
              currentMonth: salaryMonth,
              existingFutureMonthCount: futureUndeducted.length,
              extraMonths,
              alreadyDeductedMonths: alreadyDeducted.length,
            })
          : rebuildScheduleRedistribute({
              outstandingBeforeCurrent,
              newCurrentEmi: pendingEmi,
              currentMonth: salaryMonth,
              futureMonthCount: Math.max(1, futureUndeducted.length),
              alreadyDeductedMonths: alreadyDeducted.length,
            });

      // Delete future undeducted schedule rows
      if (futureUndeducted.length > 0) {
        const { error: delErr } = await supabase
          .from("hr_advance_schedule")
          .delete()
          .in(
            "id",
            futureUndeducted.map((s) => s.id),
          );
        if (delErr) throw delErr;
      }

      // Upsert current month schedule
      if (currentRow) {
        const { error } = await supabase
          .from("hr_advance_schedule")
          .update({
            emi_amount: rebuild.currentMonthEmi,
            is_deducted: true,
            salary_id: localSalary.id,
          })
          .eq("id", currentRow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("hr_advance_schedule").insert({
          advance_id: targetAdvance.id,
          emi_month: salaryMonth,
          emi_amount: rebuild.currentMonthEmi,
          is_deducted: true,
          salary_id: localSalary.id,
        });
        if (error) throw error;
      }

      if (rebuild.futureSchedule.length > 0) {
        const { error } = await supabase.from("hr_advance_schedule").insert(
          rebuild.futureSchedule.map((item) => ({
            advance_id: targetAdvance!.id,
            emi_month: item.emiMonth,
            emi_amount: item.emiAmount,
            is_deducted: false,
            salary_id: null,
          })),
        );
        if (error) throw error;
      }

      const remainingAfter =
        Math.round(
          (outstandingBeforeCurrent - rebuild.currentMonthEmi) * 100,
        ) / 100;

      const { error: advErr } = await supabase
        .from("hr_salary_advances")
        .update({
          outstanding_balance: remainingAfter,
          emi_amount: rebuild.baseEmiAmount,
          repayment_months: rebuild.totalRepaymentMonths,
          status: remainingAfter <= 0.01 ? "completed" : "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetAdvance.id);
      if (advErr) throw advErr;

      const result = calculateSalary(
        Number(localSalary.base_salary),
        localSalary.working_days,
        localSalary.days_present,
        localSalary.casual_leave,
        localSalary.loss_of_pay,
        rebuild.currentMonthEmi,
      );

      const { error: salErr } = await supabase
        .from("hr_salary")
        .update({
          advance_emi_deduction: result.advanceEmiDeduction,
          net_payable: result.netPayable,
          updated_at: new Date().toISOString(),
        })
        .eq("id", localSalary.id);
      if (salErr) throw salErr;

      const updated: SalaryRow = {
        ...localSalary,
        advance_emi_deduction: String(result.advanceEmiDeduction),
        net_payable: String(result.netPayable),
      };
      setLocalSalary(updated);
      setEmiInput(String(result.advanceEmiDeduction));
      onSalaryUpdated?.(updated);

      toast({
        variant: "success",
        title: "EMI updated",
        description:
          mode === "extend"
            ? `EMI updated. Appended ${extraMonths} month(s); remaining balance distributed across ${futureUndeducted.length + extraMonths} month(s).`
            : "EMI updated and remaining balance redistributed across existing months.",
      });
      setEmiConfirmOpen(false);
      setPendingEmi(null);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "EMI update failed",
        description:
          error instanceof Error ? error.message : "Failed to update EMI.",
      });
    } finally {
      setIsSavingEmi(false);
    }
  };

  const handlePrint = async () => {
    if (!slipRef.current || isPrinting) return;
    setIsPrinting(true);

    try {
      const clone = slipRef.current.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("img").forEach((img) => {
        img.src = toAbsoluteUrl(img.getAttribute("src") || "");
        img.removeAttribute("crossorigin");
      });

      const iframe = document.createElement("iframe");
      iframe.setAttribute("title", "Salary slip print");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";
      document.body.appendChild(iframe);

      const frameWindow = iframe.contentWindow;
      const frameDoc = frameWindow?.document;
      if (!frameWindow || !frameDoc) {
        throw new Error("Unable to create print frame");
      }

      frameDoc.open();
      frameDoc.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeFilename}</title>
    <style>${SLIP_STYLES}</style>
    <style>${PRINT_PAGE_STYLES}</style>
  </head>
  <body>${clone.outerHTML}</body>
</html>`);
      frameDoc.close();

      const images = Array.from(frameDoc.images);
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
        ),
      );

      // Give layout a moment after images load
      await new Promise((resolve) => window.setTimeout(resolve, 100));

      frameWindow.focus();
      frameWindow.print();

      window.setTimeout(() => {
        iframe.remove();
      }, 1000);
    } catch (error) {
      console.error("Salary slip print failed:", error);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!slipRef.current || isGeneratingPdf) return;
    setIsGeneratingPdf(true);

    let captureHost: HTMLDivElement | null = null;
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const { jsPDF } = await import("jspdf");

      // Clone into an off-screen host with PDF-safe padding so capture
      // doesn't depend on the dialog/preview chrome.
      captureHost = document.createElement("div");
      captureHost.style.cssText = [
        "position:fixed",
        "left:-10000px",
        "top:0",
        "width:1100px",
        "background:#ffffff",
        "z-index:-1",
        "pointer-events:none",
      ].join(";");

      const styleTag = document.createElement("style");
      styleTag.textContent = SLIP_STYLES;
      captureHost.appendChild(styleTag);

      const clone = slipRef.current.cloneNode(true) as HTMLElement;
      clone.style.width = "1100px";
      clone.style.maxWidth = "1100px";
      clone.style.padding = "28px 36px";
      clone.style.margin = "0";
      clone.style.boxSizing = "border-box";
      clone.style.background = "#ffffff";
      clone.querySelectorAll("img").forEach((img) => {
        img.src = toAbsoluteUrl(img.getAttribute("src") || "");
      });
      captureHost.appendChild(clone);
      document.body.appendChild(captureHost);

      // Wait for cloned images before rasterizing
      await Promise.all(
        Array.from(clone.querySelectorAll("img")).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
        ),
      );

      const canvas = await html2canvas(clone, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        imageTimeout: 15000,
        scrollX: 0,
        scrollY: 0,
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/png", 1.0);
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Even page margins on landscape A4
      const marginX = 12;
      const marginY = 10;
      const availableWidth = pageWidth - marginX * 2;
      const availableHeight = pageHeight - marginY * 2;

      let imgWidth = availableWidth;
      let imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight > availableHeight) {
        const scale = availableHeight / imgHeight;
        imgWidth *= scale;
        imgHeight = availableHeight;
      }

      // Center horizontally, keep consistent top inset (no vertical centering)
      const x = marginX + (availableWidth - imgWidth) / 2;
      const y = marginY;
      pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight, undefined, "FAST");
      pdf.save(`${safeFilename}.pdf`);
    } catch (error) {
      console.error("Salary slip PDF failed:", error);
      await handlePrint();
    } finally {
      if (captureHost?.parentNode) {
        captureHost.parentNode.removeChild(captureHost);
      }
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: SLIP_STYLES }} />

      <div className="salary-slip-no-print flex items-center justify-end gap-2">
        <IconTooltip label="Print salary slip">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={isGeneratingPdf || isPrinting}
          >
            {isPrinting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Printer className="h-4 w-4 mr-2" />
            )}
            Print
          </Button>
        </IconTooltip>
        <IconTooltip label="Download salary slip as PDF">
          <Button size="sm" onClick={handleDownloadPDF} disabled={isGeneratingPdf || isPrinting}>
            {isGeneratingPdf ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download PDF
          </Button>
        </IconTooltip>
        {onClose && (
          <IconTooltip label="Close salary slip">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </IconTooltip>
        )}
      </div>

      <div className="salary-slip-print-area rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div ref={slipRef} className="salary-slip">
          <div className="header">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt={`${companyName} logo`}
                className="company-logo"
                crossOrigin="anonymous"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="logo-placeholder">Logo</div>
            )}
            <div className="company-meta">
              <h1 className="company-title">{companyName}</h1>
              {companyAddress && <p className="company-sub">{companyAddress}</p>}
              {(companyPhone || companyEmail) && (
                <p className="company-contact">
                  {companyPhone && <span>Phone: {companyPhone}</span>}
                  {companyPhone && companyEmail && <span> · </span>}
                  {companyEmail && <span>Email: {companyEmail}</span>}
                </p>
              )}
              <h2 className="month-title">Payslip for the Month of {monthLabel}</h2>
            </div>
          </div>

          <hr className="divider" />

          <div className="summary-grid">
            <table className="kv-table">
              <tbody>
                <tr>
                  <td className="label">Employee Name</td>
                  <td className="colon">:</td>
                  <td className="val">{employee.name}</td>
                </tr>
                <tr>
                  <td className="label">Employee ID</td>
                  <td className="colon">:</td>
                  <td className="val">{employee.employee_id}</td>
                </tr>
                <tr>
                  <td className="label">Pay Period</td>
                  <td className="colon">:</td>
                  <td className="val">{monthLabel}</td>
                </tr>
                <tr>
                  <td className="label">Pay Date</td>
                  <td className="colon">:</td>
                  <td className="val">{payDateFormatted}</td>
                </tr>
              </tbody>
            </table>

            <div className="net-summary">
              <div>
                <div className="net-amount">₹{formatINR(netPayable)}</div>
                <div className="net-label">Total Net Pay</div>
              </div>
              <table className="kv-table">
                <tbody>
                  <tr>
                    <td className="label">Paid Days</td>
                    <td className="colon">:</td>
                    <td className="val">{paidDays}</td>
                  </tr>
                  <tr>
                    <td className="label">LOP Days</td>
                    <td className="colon">:</td>
                    <td className="val">{lopDays}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <hr className="divider" />

          <h3 className="section-title">Income Details</h3>
          <div className="tables-grid">
            <div className="panel">
              <table className="inc-table">
                <thead>
                  <tr>
                    <th>Earnings</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Basic Salary</td>
                    <td className="num">₹{formatINR(grossEarnings)}</td>
                  </tr>
                  <tr className="total-row">
                    <td>Gross Earnings</td>
                    <td className="num">₹{formatINR(grossEarnings)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="panel">
              <table className="inc-table">
                <thead>
                  <tr>
                    <th>Deductions</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Loss of Pay (LOP)</td>
                    <td className="num">₹{formatINR(lopDeduction)}</td>
                  </tr>
                  <tr>
                    <td>Salary Advance EMI</td>
                    <td className="num">
                      {canEditEmi ? (
                        <div className="salary-slip-no-print flex items-center justify-end gap-1">
                          <span>₹</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={emiInput}
                            onChange={(e) => setEmiInput(e.target.value)}
                            onBlur={requestEmiChange}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                requestEmiChange();
                              }
                            }}
                            className="h-8 w-28 text-right"
                          />
                        </div>
                      ) : null}
                      <span className={canEditEmi ? "hidden print:inline" : undefined}>
                        ₹{formatINR(advanceEmi)}
                      </span>
                    </td>
                  </tr>
                  <tr className="total-row">
                    <td>Total Deductions</td>
                    <td className="num">₹{formatINR(totalDeductions)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <hr className="divider" />

          <div className="payable-card">
            <div className="payable-title">Total Net Payable</div>
            <div className="payable-sub">Gross Earnings − Total Deductions</div>
            <div className="payable-amount">₹{formatINR(netPayable)}</div>
            <div className="payable-words">Amount In Words: {amountWords}</div>
          </div>

          <hr className="divider" />

          <div className="disclaimer">— This is a system-generated document. —</div>
        </div>
      </div>

      <AlertDialog open={emiConfirmOpen} onOpenChange={setEmiConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm EMI change</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  EMI will change from ₹{formatINR(advanceEmi)} to ₹
                  {formatINR(pendingEmi ?? 0)}. Remaining balance after this
                  month: ₹{formatINR(remainingAfterPendingEmi)}.
                </p>
                <p>
                  <strong className="text-foreground">Redistribute:</strong>{" "}
                  split remaining across the existing{" "}
                  {Math.max(1, futureUndeductedCountForDialog)} future month(s).
                </p>
                <p>
                  <strong className="text-foreground">Extend tenure:</strong>{" "}
                  append months to the schedule, then distribute remaining
                  across existing + appended months.
                </p>
                <div className="space-y-1.5 pt-1">
                  <Label
                    htmlFor="extend_months"
                    className="text-foreground text-xs font-medium"
                  >
                    Months to append (for Extend tenure)
                  </Label>
                  <Input
                    id="extend_months"
                    type="number"
                    min={1}
                    step={1}
                    value={extendMonths}
                    onChange={(e) => setExtendMonths(e.target.value)}
                    className="h-9"
                  />
                  <p className="text-xs">
                    New future schedule length:{" "}
                    {Math.max(0, futureUndeductedCountForDialog) +
                      Math.max(0, Math.floor(Number(extendMonths) || 0))}{" "}
                    month(s)
                    {remainingAfterPendingEmi > 0 &&
                    Math.max(0, futureUndeductedCountForDialog) +
                      Math.max(0, Math.floor(Number(extendMonths) || 0)) >
                      0
                      ? ` · ~₹${formatINR(
                          remainingAfterPendingEmi /
                            Math.max(
                              1,
                              Math.max(0, futureUndeductedCountForDialog) +
                                Math.max(
                                  0,
                                  Math.floor(Number(extendMonths) || 0),
                                ),
                            ),
                        )} / month`
                      : ""}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={isSavingEmi}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              disabled={isSavingEmi}
              onClick={() => applyEmiChange("redistribute")}
            >
              {isSavingEmi && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Redistribute
            </Button>
            <AlertDialogAction
              disabled={isSavingEmi}
              onClick={(e) => {
                e.preventDefault();
                void applyEmiChange("extend");
              }}
            >
              {isSavingEmi && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Extend tenure
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
