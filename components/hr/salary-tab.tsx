"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Download, FileText, RefreshCw, CheckCircle, Printer, Eye, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { getProfileDisplayName, logEntryHistory } from "@/lib/entry-history";
import { getIndianCurrentMonth, getIndianToday } from "@/lib/date-time";
import { calculateSalary } from "@/lib/hr-calculations";
import { isSuperAdmin } from "@/lib/permissions";
import { exportToCSV, exportToPDF, type ExportColumn, getTimestamp } from "@/lib/export-utils";
import { TablePagination } from "@/components/table-pagination";
import { usePagination } from "@/hooks/use-pagination";
import { SalarySlipPrintable } from "@/components/hr/salary-slip-printable";
import { TableRowActions } from "@/components/table-row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EntryHistoryButton } from "@/components/entry-history-button";
import { IconTooltip } from "@/components/icon-tooltip";
import type {
  EmployeeRow, AttendanceRow, SalaryRow, AdvanceRow,
  AdvanceScheduleRow, OrganizationInfo, InvoiceTemplateInfo,
} from "@/app/dashboard/expenses/payroll/payroll-page-client";

interface SalaryTabProps {
  employees: EmployeeRow[];
  attendance: AttendanceRow[];
  salaries: SalaryRow[];
  advances: AdvanceRow[];
  advanceSchedules: AdvanceScheduleRow[];
  organization: OrganizationInfo | null;
  invoiceTemplate: InvoiceTemplateInfo | null;
  userRole: string;
  organizationId: string;
}

const paymentStatusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800" },
};

type MarkPaidTarget = { salaryId: string; employeeName: string; netPayable: number };

type SortCol =
  | "employee_code"
  | "employee_name"
  | "base_salary"
  | "working_days"
  | "days_present"
  | "casual_leave"
  | "loss_of_pay"
  | "earned_salary"
  | "advance_emi_deduction"
  | "net_payable"
  | "payment_status";

export function SalaryTab({
  employees,
  attendance,
  salaries,
  advances,
  advanceSchedules,
  organization,
  invoiceTemplate,
  userRole,
  organizationId,
}: SalaryTabProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [selectedMonth, setSelectedMonth] = useState(getIndianCurrentMonth());
  const [isGenerating, setIsGenerating] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<MarkPaidTarget | null>(null);
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [slipSalary, setSlipSalary] = useState<SalaryRow | null>(null);
  const [editingSalary, setEditingSalary] = useState<SalaryRow | null>(null);
  const [editStatus, setEditStatus] = useState<"pending" | "paid">("pending");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortColumn, setSortColumn] = useState<SortCol | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filters, setFilters] = useState({ name: "", status: "" });

  // Salaries for the selected month
  const monthSalaries = useMemo(
    () => salaries.filter((s) => s.salary_month === selectedMonth),
    [salaries, selectedMonth],
  );

  // Attendance for selected month
  const monthAttendance = useMemo(
    () => attendance.filter((a) => a.attendance_month === selectedMonth),
    [attendance, selectedMonth],
  );

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees],
  );

  // Check if all active employees have finalized attendance or paid salary
  const allAttendanceFinalized = useMemo(() => {
    if (activeEmployees.length === 0) return false;
    return activeEmployees.every((emp) => {
      // If salary is already paid, attendance is considered settled
      const isPaid = monthSalaries.some(
        (s) => s.employee_id === emp.id && s.payment_status === "paid",
      );
      if (isPaid) return true;

      // Otherwise check if attendance is present and finalized
      const att = monthAttendance.find((a) => a.employee_id === emp.id);
      return att ? att.status === "finalized" : false;
    });
  }, [activeEmployees, monthAttendance, monthSalaries]);

  const salaryAlreadyGenerated = monthSalaries.length > 0;

  // Get active advances and due EMIs for the month
  const getEMIForEmployee = (employeeId: string, month: string, currentSalaryId?: string): number => {
    const activeAdvances = advances.filter(
      (a) => a.employee_id === employeeId && (a.status === "active" || a.status === "completed"),
    );
    let totalEmi = 0;
    for (const adv of activeAdvances) {
      const schedule = advanceSchedules.find(
        (s) =>
          s.advance_id === adv.id &&
          s.emi_month === month &&
          (!s.is_deducted || (currentSalaryId && s.salary_id === currentSalaryId)),
      );
      if (schedule) {
        totalEmi += Number(schedule.emi_amount);
      }
    }
    return Math.round(totalEmi * 100) / 100;
  };

  const handleGenerateSalary = async () => {
    if (!allAttendanceFinalized) {
      toast({
        variant: "destructive",
        title: "Attendance not finalized",
        description: "Please finalize attendance for all active employees before generating salary.",
      });
      return;
    }

    setIsGenerating(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      let generated = 0;

      for (const att of monthAttendance) {
        if (att.status !== "finalized") continue;

        const emp = employees.find((e) => e.id === att.employee_id);
        if (!emp) continue;

        const existingSalary = monthSalaries.find((s) => s.employee_id === att.employee_id);

        // Skip if salary is already marked as paid
        if (existingSalary && existingSalary.payment_status === "paid") {
          continue;
        }

        const emiAmount = getEMIForEmployee(emp.id, selectedMonth, existingSalary?.id);

        const { earnedSalary, lopDeduction, advanceEmiDeduction, netPayable } = calculateSalary(
          Number(emp.base_salary),
          att.working_days,
          att.days_present,
          att.casual_leave,
          att.loss_of_pay,
          emiAmount,
        );

        let targetSalaryId = existingSalary?.id;

        if (existingSalary) {
          // Update existing unpaid salary record
          const { error: updateErr } = await supabase
            .from("hr_salary")
            .update({
              attendance_id: att.id,
              base_salary: Number(emp.base_salary),
              working_days: att.working_days,
              days_present: att.days_present,
              casual_leave: att.casual_leave,
              loss_of_pay: att.loss_of_pay,
              earned_salary: earnedSalary,
              lop_deduction: lopDeduction,
              advance_emi_deduction: advanceEmiDeduction,
              net_payable: netPayable,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingSalary.id);
          if (updateErr) throw updateErr;
          generated++;
        } else {
          // Insert new salary record
          const { data: salaryData, error: salaryErr } = await supabase
            .from("hr_salary")
            .insert({
              organization_id: organizationId,
              employee_id: emp.id,
              salary_month: selectedMonth,
              attendance_id: att.id,
              base_salary: Number(emp.base_salary),
              working_days: att.working_days,
              days_present: att.days_present,
              casual_leave: att.casual_leave,
              loss_of_pay: att.loss_of_pay,
              earned_salary: earnedSalary,
              lop_deduction: lopDeduction,
              advance_emi_deduction: advanceEmiDeduction,
              net_payable: netPayable,
              payment_status: "pending",
              amount_paid: 0,
              created_by: user.id,
            })
            .select("id")
            .single();
          if (salaryErr) throw salaryErr;
          targetSalaryId = salaryData?.id;
          generated++;
        }

        // Mark EMI schedule rows as deducted and update advance balance if not already deducted for this salary
        if (emiAmount > 0 && targetSalaryId) {
          const activeAdvances = advances.filter(
            (a) => a.employee_id === emp.id && (a.status === "active" || a.status === "completed"),
          );
          for (const adv of activeAdvances) {
            const scheduleRow = advanceSchedules.find(
              (s) => s.advance_id === adv.id && s.emi_month === selectedMonth,
            );
            if (scheduleRow && (!scheduleRow.is_deducted || scheduleRow.salary_id !== targetSalaryId)) {
              const { error: scheduleErr } = await supabase
                .from("hr_advance_schedule")
                .update({ is_deducted: true, salary_id: targetSalaryId })
                .eq("id", scheduleRow.id);
              if (scheduleErr) throw scheduleErr;

              // Update outstanding balance
              const newBalance = Math.max(
                0,
                Number(adv.outstanding_balance) - Number(scheduleRow.emi_amount),
              );
              const isCompleted = newBalance <= 0;
              const { error: advanceErr } = await supabase
                .from("hr_salary_advances")
                .update({
                  outstanding_balance: newBalance,
                  status: isCompleted ? "completed" : "active",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", adv.id);
              if (advanceErr) throw advanceErr;
            }
          }
        }
      }

      const userName = await getProfileDisplayName(supabase, user.id);
      await logEntryHistory(supabase, {
        organizationId,
        entityType: "hr_salary",
        entityId: selectedMonth,
        action: "created",
        userId: user.id,
        userName,
        summary: `Generated salary for ${selectedMonth} (${generated} employees)`,
      });

      toast({
        variant: "success",
        title: "Salary generated",
        description: `Generated salary for ${generated} employee${generated !== 1 ? "s" : ""}.`,
      });
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate salary.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!markPaidTarget) return;
    setIsMarkingPaid(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const salaryRecord = monthSalaries.find((s) => s.id === markPaidTarget.salaryId);
      if (!salaryRecord) throw new Error("Salary record not found");

      const emp = employees.find((e) => e.id === salaryRecord.employee_id);
      if (!emp) throw new Error("Employee not found");

      // Salary stays in payroll; paid amounts roll into expense reports from hr_salary.
      const { error: salErr } = await supabase
        .from("hr_salary")
        .update({
          payment_status: "paid",
          amount_paid: Number(salaryRecord.net_payable),
          updated_at: new Date().toISOString(),
        })
        .eq("id", markPaidTarget.salaryId);
      if (salErr) throw salErr;

      const userName = await getProfileDisplayName(supabase, user.id);
      await logEntryHistory(supabase, {
        organizationId,
        entityType: "hr_salary",
        entityId: markPaidTarget.salaryId,
        action: "updated",
        userId: user.id,
        userName,
        summary: `Marked salary as paid for ${emp.name} — ${selectedMonth} (₹${Number(salaryRecord.net_payable).toFixed(2)})`,
      });

      toast({
        variant: "success",
        title: "Salary marked as paid",
        description: "Payment status updated. It will appear in Expense Reports for this month.",
      });
      setMarkPaidTarget(null);
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark salary as paid.",
      });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  const handleOpenEditSalary = (sal: SalaryRow) => {
    if (!isSuperAdmin(userRole)) {
      toast({
        variant: "destructive",
        title: "Access denied",
        description: "Only Super Admin can edit salary payment status.",
      });
      return;
    }
    setEditingSalary(sal);
    setEditStatus(sal.payment_status === "paid" ? "paid" : "pending");
  };

  const handleSaveEditSalary = async () => {
    if (!editingSalary) return;
    setIsSavingEdit(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const newPaidAmount = editStatus === "paid" ? Number(editingSalary.net_payable) : 0;

      const { error } = await supabase
        .from("hr_salary")
        .update({
          payment_status: editStatus,
          amount_paid: newPaidAmount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingSalary.id);

      if (error) throw error;

      const empName = editingSalary.employees?.name || "Employee";
      const userName = await getProfileDisplayName(supabase, user.id);
      await logEntryHistory(supabase, {
        organizationId,
        entityType: "hr_salary",
        entityId: editingSalary.id,
        action: "updated",
        userId: user.id,
        userName,
        summary: `Updated salary payment status for ${empName} (${editingSalary.salary_month}) to ${editStatus} (Paid: ₹${newPaidAmount})`,
      });

      toast({
        variant: "success",
        title: "Salary status updated",
        description: `Payment status for ${empName} updated to ${editStatus}.`,
      });

      setEditingSalary(null);
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update salary status.",
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const processedSalaries = useMemo(() => {
    let filtered = [...monthSalaries];
    if (filters.name) {
      const q = filters.name.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          (s.employees?.name || "").toLowerCase().includes(q) ||
          (s.employees?.employee_id || "").toLowerCase().includes(q),
      );
    }
    if (filters.status) {
      filtered = filtered.filter((s) => s.payment_status === filters.status);
    }

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        switch (sortColumn) {
          case "employee_code":
            aVal = (a.employees?.employee_id || "").toLowerCase();
            bVal = (b.employees?.employee_id || "").toLowerCase();
            break;
          case "employee_name":
            aVal = (a.employees?.name || "").toLowerCase();
            bVal = (b.employees?.name || "").toLowerCase();
            break;
          case "base_salary":
            aVal = Number(a.base_salary);
            bVal = Number(b.base_salary);
            break;
          case "working_days":
            aVal = a.working_days;
            bVal = b.working_days;
            break;
          case "days_present":
            aVal = a.days_present;
            bVal = b.days_present;
            break;
          case "casual_leave":
            aVal = a.casual_leave;
            bVal = b.casual_leave;
            break;
          case "loss_of_pay":
            aVal = a.loss_of_pay;
            bVal = b.loss_of_pay;
            break;
          case "earned_salary":
            aVal = Number(a.earned_salary);
            bVal = Number(b.earned_salary);
            break;
          case "advance_emi_deduction":
            aVal = Number(a.advance_emi_deduction);
            bVal = Number(b.advance_emi_deduction);
            break;
          case "net_payable":
            aVal = Number(a.net_payable);
            bVal = Number(b.net_payable);
            break;
          case "payment_status":
            aVal = a.payment_status;
            bVal = b.payment_status;
            break;
          default:
            return 0;
        }
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [monthSalaries, filters, sortColumn, sortDirection]);

  const pagination = usePagination({ items: processedSalaries, itemsPerPage });

  const handleSort = (col: SortCol) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 inline opacity-40" />;
    return sortDirection === "asc"
      ? <ArrowUp className="ml-1 h-3.5 w-3.5 inline" />
      : <ArrowDown className="ml-1 h-3.5 w-3.5 inline" />;
  };

  const getSalaryExportData = () => {
    const enriched = processedSalaries.map((s) => ({
      ...s,
      employee_name: s.employees?.name || "—",
      employee_code: s.employees?.employee_id || "—",
    }));
    const columns: ExportColumn[] = [
      { key: "employee_code", label: "Employee ID" },
      { key: "employee_name", label: "Name" },
      { key: "base_salary", label: "Base Salary", formatter: (v) => Number(v).toFixed(2), align: "right" },
      { key: "working_days", label: "Working Days", align: "right" },
      { key: "days_present", label: "Days Present", align: "right" },
      { key: "casual_leave", label: "CL", align: "right" },
      { key: "loss_of_pay", label: "LOP", align: "right" },
      { key: "earned_salary", label: "Earned", formatter: (v) => Number(v).toFixed(2), align: "right" },
      { key: "advance_emi_deduction", label: "Advance EMI", formatter: (v) => Number(v).toFixed(2), align: "right" },
      { key: "net_payable", label: "Net Payable", formatter: (v) => Number(v).toFixed(2), align: "right" },
      { key: "payment_status", label: "Status" },
    ];
    return { enriched, columns };
  };

  const handleExportCSV = () => {
    const { enriched, columns } = getSalaryExportData();
    exportToCSV(enriched, columns, `salary_${selectedMonth}_${getTimestamp()}.csv`);
    toast({
      variant: "success",
      title: "Exported",
      description: `${enriched.length} salary record${enriched.length === 1 ? "" : "s"} exported to CSV.`,
    });
  };

  const handleExportPDF = async () => {
    const { enriched, columns } = getSalaryExportData();
    await exportToPDF(
      enriched,
      columns,
      `Salary — ${selectedMonth}`,
      `salary_${selectedMonth}_${getTimestamp()}.pdf`,
    );
    toast({
      variant: "success",
      title: "Exported",
      description: `${enriched.length} salary record${enriched.length === 1 ? "" : "s"} exported to PDF.`,
    });
  };

  const monthLabel = selectedMonth
    ? new Date(`${selectedMonth}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : "";

  const slipEmployee = slipSalary
    ? employees.find((e) => e.id === slipSalary.employee_id)
    : null;

  const paymentStatusFilterOptions = [
    { value: "", label: "All statuses" },
    { value: "pending", label: "Pending" },
    { value: "paid", label: "Paid" },
  ];

  return (
    <div className="space-y-8">
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Month</Label>
              <Input
                type="month"
                value={selectedMonth}
                max={getIndianCurrentMonth()}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full sm:w-auto"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Search name / ID..."
                value={filters.name}
                onChange={(e) => setFilters((f) => ({ ...f, name: e.target.value }))}
                className="w-full sm:w-48"
              />
            </div>
            <div className="space-y-1.5 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <SearchableSelect
                options={paymentStatusFilterOptions}
                value={filters.status}
                onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
                placeholder="Status"
                triggerClassName="w-full sm:w-36"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <IconTooltip label="Export to CSV">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={monthSalaries.length === 0}
              >
                <Download className="h-4 w-4" />
                <span className="ml-2">CSV</span>
              </Button>
            </IconTooltip>
            <IconTooltip label="Export to PDF">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={monthSalaries.length === 0}
              >
                <FileText className="h-4 w-4" />
                <span className="ml-2">PDF</span>
              </Button>
            </IconTooltip>
            {!salaryAlreadyGenerated ? (
              <IconTooltip label="Generate salary from finalized attendance">
                <Button onClick={handleGenerateSalary} disabled={isGenerating || !allAttendanceFinalized}>
                  {isGenerating && <Spinner className="mr-2 h-4 w-4" />}
                  <RefreshCw className="h-4 w-4 mr-2" />Generate Salary
                </Button>
              </IconTooltip>
            ) : (
              <IconTooltip label="Refresh salary and add any missing employees">
                <Button variant="outline" onClick={handleGenerateSalary} disabled={isGenerating}>
                  {isGenerating && <Spinner className="mr-2 h-4 w-4" />}
                  <RefreshCw className="h-4 w-4 mr-2" />Refresh / Add Missing
                </Button>
              </IconTooltip>
            )}
          </div>
        </div>
        {monthLabel && (
          <p className="text-xs text-muted-foreground">
            Showing salary for{" "}
            <span className="font-medium text-foreground">{monthLabel}</span>.
          </p>
        )}
      </div>

      {!allAttendanceFinalized && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Attendance is not finalized for all active employees in {monthLabel}. Finalize attendance in the Attendance tab before generating salary.
        </div>
      )}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Salary</h2>
        <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>
                <button type="button" className="font-semibold" onClick={() => handleSort("employee_code")}>
                  Employee ID <SortIcon column="employee_code" />
                </button>
              </TableHead>
              <TableHead>
                <button type="button" className="font-semibold" onClick={() => handleSort("employee_name")}>
                  Name <SortIcon column="employee_name" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button type="button" className="font-semibold" onClick={() => handleSort("base_salary")}>
                  Base Salary <SortIcon column="base_salary" />
                </button>
              </TableHead>
              <TableHead className="text-center">
                <button type="button" className="font-semibold" onClick={() => handleSort("working_days")}>
                  WD <SortIcon column="working_days" />
                </button>
              </TableHead>
              <TableHead className="text-center">
                <button type="button" className="font-semibold" onClick={() => handleSort("days_present")}>
                  Present <SortIcon column="days_present" />
                </button>
              </TableHead>
              <TableHead className="text-center">
                <button type="button" className="font-semibold" onClick={() => handleSort("casual_leave")}>
                  CL <SortIcon column="casual_leave" />
                </button>
              </TableHead>
              <TableHead className="text-center">
                <button type="button" className="font-semibold" onClick={() => handleSort("loss_of_pay")}>
                  LOP <SortIcon column="loss_of_pay" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button type="button" className="font-semibold" onClick={() => handleSort("earned_salary")}>
                  Earned <SortIcon column="earned_salary" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button type="button" className="font-semibold" onClick={() => handleSort("advance_emi_deduction")}>
                  Adv. EMI <SortIcon column="advance_emi_deduction" />
                </button>
              </TableHead>
              <TableHead className="text-right font-semibold">
                <button type="button" className="font-semibold" onClick={() => handleSort("net_payable")}>
                  Net Payable <SortIcon column="net_payable" />
                </button>
              </TableHead>
              <TableHead>
                <button type="button" className="font-semibold" onClick={() => handleSort("payment_status")}>
                  Status <SortIcon column="payment_status" />
                </button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  {allAttendanceFinalized
                    ? 'Click "Generate Salary" to create salary records for this month.'
                    : "Finalize attendance first to generate salary."}
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((sal) => {
                const status = paymentStatusConfig[sal.payment_status] || {
                  label: sal.payment_status,
                  className: "bg-slate-100 text-slate-800",
                };
                return (
                  <TableRow key={sal.id}>
                    <TableCell className="font-medium">{sal.employees?.employee_id || "—"}</TableCell>
                    <TableCell>{sal.employees?.name || "—"}</TableCell>
                    <TableCell className="text-right">₹{Number(sal.base_salary).toLocaleString("en-IN", { minimumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-center">{sal.working_days}</TableCell>
                    <TableCell className="text-center">{sal.days_present}</TableCell>
                    <TableCell className="text-center">{sal.casual_leave}</TableCell>
                    <TableCell className="text-center">
                      <span className={sal.loss_of_pay > 0 ? "text-red-600 font-medium" : ""}>
                        {sal.loss_of_pay}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">₹{Number(sal.earned_salary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right">
                      {Number(sal.advance_emi_deduction) > 0
                        ? <span className="text-orange-600">-₹{Number(sal.advance_emi_deduction).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ₹{Number(sal.net_payable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge className={status.className}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <EntryHistoryButton
                          entityType="hr_salary"
                          entityId={sal.id}
                          createdAt={sal.created_at}
                        />
                        <TableRowActions>
                          <DropdownMenuItem onSelect={() => setSlipSalary(sal)}>
                            <Eye className="h-4 w-4 mr-2" /> View Salary Slip
                          </DropdownMenuItem>
                          {sal.payment_status !== "paid" && (
                            <DropdownMenuItem
                              onSelect={() =>
                                setMarkPaidTarget({
                                  salaryId: sal.id,
                                  employeeName: sal.employees?.name || "Employee",
                                  netPayable: Number(sal.net_payable),
                                })
                              }
                              className="text-green-600 focus:text-green-600 font-medium"
                            >
                              <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Mark as Paid
                            </DropdownMenuItem>
                          )}
                          {isSuperAdmin(userRole) && (
                            <DropdownMenuItem
                              onSelect={() => handleOpenEditSalary(sal)}
                            >
                              <Pencil className="h-4 w-4 mr-2" /> Edit Status
                            </DropdownMenuItem>
                          )}
                        </TableRowActions>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        totalItems={processedSalaries.length}
        itemsPerPage={itemsPerPage}
        onPageChange={pagination.goToPage}
        onItemsPerPageChange={(val) => {
          setItemsPerPage(val);
          pagination.goToPage(1);
        }}
      />
      </div>

      {/* Mark Paid Confirm */}
      <AlertDialog open={!!markPaidTarget} onOpenChange={(open) => !open && setMarkPaidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark salary as Paid?</AlertDialogTitle>
            <AlertDialogDescription>
              Mark salary for {markPaidTarget?.employeeName} (₹
              {markPaidTarget?.netPayable.toFixed(2)}) as Paid. No expense entry
              is created; the paid amount is included in Expense Reports for
              this month.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMarkingPaid}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkPaid} disabled={isMarkingPaid}>
              {isMarkingPaid ? "Processing..." : "Confirm & Pay"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Salary Status Dialog */}
      <Dialog open={!!editingSalary} onOpenChange={(open) => !open && setEditingSalary(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Salary Payment Status</DialogTitle>
          </DialogHeader>
          {editingSalary && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs space-y-1">
                <div className="font-semibold text-slate-800 text-sm">
                  {editingSalary.employees?.name || "Employee"} ({editingSalary.employees?.employee_id})
                </div>
                <div className="text-slate-600">Month: <span className="font-medium text-slate-900">{editingSalary.salary_month}</span></div>
                <div className="text-slate-600">Net Payable: <span className="font-bold text-slate-900">₹{Number(editingSalary.net_payable).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_status" className="text-xs font-semibold">Payment Status</Label>
                <SearchableSelect
                  options={[
                    { value: "pending", label: "Pending" },
                    { value: "paid", label: "Paid" },
                  ]}
                  value={editStatus}
                  onValueChange={(val) => {
                    setEditStatus(val as "pending" | "paid");
                  }}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <IconTooltip label="Discard payment status changes">
                  <Button variant="outline" onClick={() => setEditingSalary(null)} disabled={isSavingEdit}>
                    Cancel
                  </Button>
                </IconTooltip>
                <IconTooltip label="Save payment status changes">
                  <Button onClick={handleSaveEditSalary} disabled={isSavingEdit}>
                    {isSavingEdit && <Spinner className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </IconTooltip>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Salary Slip Dialog */}
      <Dialog open={!!slipSalary} onOpenChange={(open) => !open && setSlipSalary(null)}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-[min(1100px,96vw)] max-h-[92vh] overflow-y-auto print:fixed print:inset-0 print:translate-none print:max-w-none print:max-h-none print:overflow-visible print:border-0 print:p-0 print:shadow-none"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Salary Slip</DialogTitle>
          </DialogHeader>
          {slipSalary && slipEmployee && (
            <SalarySlipPrintable
              salary={slipSalary}
              employee={slipEmployee}
              organization={organization}
              template={invoiceTemplate}
              advances={advances}
              advanceSchedules={advanceSchedules}
              organizationId={organizationId}
              onClose={() => setSlipSalary(null)}
              onSalaryUpdated={(updated) => {
                setSlipSalary(updated);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
