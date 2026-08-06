"use client";

import { useState, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Spinner } from "@/components/ui/spinner";
import {
  Plus, ChevronDown, ChevronUp, Download, FileText, ArrowUpDown, ArrowUp, ArrowDown,
  Pencil, Trash2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { getProfileDisplayName, logEntryHistory } from "@/lib/entry-history";
import { getIndianCurrentMonth } from "@/lib/date-time";
import { generateAdvanceSchedule } from "@/lib/hr-calculations";
import { canEdit, canDelete } from "@/lib/permissions";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table-pagination";
import { exportToCSV, exportToPDF, type ExportColumn, getTimestamp } from "@/lib/export-utils";
import { IconTooltip } from "@/components/icon-tooltip";
import { TableRowActions } from "@/components/table-row-actions";
import type { EmployeeRow, AdvanceRow, AdvanceScheduleRow } from "@/app/dashboard/expenses/payroll/payroll-page-client";

interface AdvancesTabProps {
  employees: EmployeeRow[];
  advances: AdvanceRow[];
  advanceSchedules: AdvanceScheduleRow[];
  userRole: string;
  organizationId: string;
}

const advanceStatusConfig: Record<string, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-blue-100 text-blue-800" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-600" },
};

type SortCol =
  | "employee_name"
  | "advance_amount"
  | "repayment_months"
  | "emi_amount"
  | "start_month"
  | "outstanding_balance"
  | "status";

export function AdvancesTab({
  employees,
  advances,
  advanceSchedules,
  userRole,
  organizationId,
}: AdvancesTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const allowEdit = canEdit(userRole);
  const allowDelete = canDelete(userRole);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<AdvanceRow | null>(null);
  const [deletingAdvance, setDeletingAdvance] = useState<AdvanceRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedAdvanceId, setExpandedAdvanceId] = useState<string | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortColumn, setSortColumn] = useState<SortCol | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [form, setForm] = useState({
    employee_id: "",
    advance_amount: "",
    repayment_months: "",
    start_month: getIndianCurrentMonth(),
    notes: "",
    status: "active" as "active" | "completed" | "cancelled",
  });

  const editingHasDeductions = useMemo(() => {
    if (!editingAdvance) return false;
    return advanceSchedules.some(
      (s) => s.advance_id === editingAdvance.id && s.is_deducted,
    );
  }, [editingAdvance, advanceSchedules]);

  const emiPreview = useMemo(() => {
    const amt = Number(form.advance_amount);
    const months = parseInt(form.repayment_months);
    if (!amt || !months || months <= 0) return null;
    return Math.round((amt / months) * 100) / 100;
  }, [form.advance_amount, form.repayment_months]);

  const employeeOptions = useMemo(
    () =>
      employees
        .filter((e) => e.status === "active" || e.id === form.employee_id)
        .map((e) => ({ value: e.id, label: `${e.employee_id} — ${e.name}` })),
    [employees, form.employee_id],
  );

  const statusOptions = [
    { value: "", label: "All statuses" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const formStatusOptions = [
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const processedAdvances = useMemo(() => {
    let filtered = [...advances];
    if (filterEmployee) {
      filtered = filtered.filter((a) => a.employee_id === filterEmployee);
    }
    if (filterStatus) {
      filtered = filtered.filter((a) => a.status === filterStatus);
    }

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        switch (sortColumn) {
          case "employee_name":
            aVal = (a.employees?.name || "").toLowerCase();
            bVal = (b.employees?.name || "").toLowerCase();
            break;
          case "advance_amount":
            aVal = Number(a.advance_amount);
            bVal = Number(b.advance_amount);
            break;
          case "repayment_months":
            aVal = a.repayment_months;
            bVal = b.repayment_months;
            break;
          case "emi_amount":
            aVal = Number(a.emi_amount);
            bVal = Number(b.emi_amount);
            break;
          case "start_month":
            aVal = a.start_month;
            bVal = b.start_month;
            break;
          case "outstanding_balance":
            aVal = Number(a.outstanding_balance);
            bVal = Number(b.outstanding_balance);
            break;
          case "status":
            aVal = a.status;
            bVal = b.status;
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
  }, [advances, filterEmployee, filterStatus, sortColumn, sortDirection]);

  const pagination = usePagination({ items: processedAdvances, itemsPerPage });

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

  const resetForm = () => {
    setForm({
      employee_id: "",
      advance_amount: "",
      repayment_months: "",
      start_month: getIndianCurrentMonth(),
      notes: "",
      status: "active",
    });
    setEditingAdvance(null);
  };

  const openAddDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (adv: AdvanceRow) => {
    if (!allowEdit) {
      toast({
        variant: "destructive",
        title: "Permission denied",
        description: "Only Super Admin can edit salary advances.",
      });
      return;
    }
    setEditingAdvance(adv);
    setForm({
      employee_id: adv.employee_id,
      advance_amount: String(Number(adv.advance_amount)),
      repayment_months: String(adv.repayment_months),
      start_month: adv.start_month,
      notes: adv.notes || "",
      status: adv.status,
    });
    setDialogOpen(true);
  };

  const handleSaveAdvance = async () => {
    if (!form.employee_id) {
      toast({ variant: "destructive", title: "Missing employee", description: "Please select an employee." });
      return;
    }
    const amount = Number(form.advance_amount);
    const months = parseInt(form.repayment_months);
    if (!amount || amount <= 0) {
      toast({ variant: "destructive", title: "Invalid amount", description: "Advance amount must be greater than 0." });
      return;
    }
    if (!months || months <= 0) {
      toast({ variant: "destructive", title: "Invalid tenure", description: "Repayment months must be at least 1." });
      return;
    }
    if (!form.start_month) {
      toast({ variant: "destructive", title: "Missing start month", description: "Please select a start month." });
      return;
    }

    const isEdit = Boolean(editingAdvance);
    if (isEdit && !allowEdit) {
      toast({
        variant: "destructive",
        title: "Permission denied",
        description: "Only Super Admin can edit salary advances.",
      });
      return;
    }

    if (!isEdit) {
      const currentMonth = getIndianCurrentMonth();
      if (form.start_month < currentMonth) {
        toast({
          variant: "destructive",
          title: "Invalid start month",
          description: `Start month cannot be in the past (${form.start_month}). Please select ${currentMonth} or a future month.`,
        });
        return;
      }
    }

    setIsSaving(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const emp = employees.find((e) => e.id === form.employee_id);
      const userName = await getProfileDisplayName(supabase, user.id);

      if (isEdit && editingAdvance) {
        if (editingHasDeductions) {
          const { error } = await supabase
            .from("hr_salary_advances")
            .update({
              notes: form.notes.trim() || null,
              status: form.status,
              updated_at: new Date().toISOString(),
            })
            .eq("id", editingAdvance.id)
            .eq("organization_id", organizationId);
          if (error) throw error;

          await logEntryHistory(supabase, {
            organizationId,
            entityType: "hr_salary_advance",
            entityId: editingAdvance.id,
            action: "updated",
            userId: user.id,
            userName,
            summary: `Updated salary advance for ${emp?.name || "employee"} (notes/status; schedule locked — EMI already deducted)`,
          });

          toast({
            variant: "success",
            title: "Advance updated",
            description: "Notes and status saved. Amount/schedule were not changed because EMI deductions already exist.",
          });
        } else {
          const emiAmount = Math.round((amount / months) * 100) / 100;
          const schedule = generateAdvanceSchedule(amount, months, form.start_month);

          const { error: advErr } = await supabase
            .from("hr_salary_advances")
            .update({
              employee_id: form.employee_id,
              advance_amount: amount,
              repayment_months: months,
              emi_amount: emiAmount,
              start_month: form.start_month,
              outstanding_balance: amount,
              status: form.status,
              notes: form.notes.trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", editingAdvance.id)
            .eq("organization_id", organizationId);
          if (advErr) throw advErr;

          const { error: delErr } = await supabase
            .from("hr_advance_schedule")
            .delete()
            .eq("advance_id", editingAdvance.id);
          if (delErr) throw delErr;

          const scheduleRows = schedule.map((s) => ({
            advance_id: editingAdvance.id,
            emi_month: s.emiMonth,
            emi_amount: s.emiAmount,
            is_deducted: false,
          }));
          const { error: schedErr } = await supabase
            .from("hr_advance_schedule")
            .insert(scheduleRows);
          if (schedErr) throw schedErr;

          await logEntryHistory(supabase, {
            organizationId,
            entityType: "hr_salary_advance",
            entityId: editingAdvance.id,
            action: "updated",
            userId: user.id,
            userName,
            summary: `Updated salary advance of ₹${amount.toFixed(2)} for ${emp?.name || "employee"} — ${months} months from ${form.start_month}`,
          });

          toast({
            variant: "success",
            title: "Advance updated",
            description: `₹${amount.toLocaleString("en-IN")} over ${months} months (EMI: ₹${emiAmount.toFixed(2)}/month). Schedule rebuilt.`,
          });
        }
      } else {
        const emiAmount = Math.round((amount / months) * 100) / 100;
        const schedule = generateAdvanceSchedule(amount, months, form.start_month);

        const { data: advanceData, error: advErr } = await supabase
          .from("hr_salary_advances")
          .insert({
            organization_id: organizationId,
            employee_id: form.employee_id,
            advance_amount: amount,
            repayment_months: months,
            emi_amount: emiAmount,
            start_month: form.start_month,
            outstanding_balance: amount,
            status: "active",
            notes: form.notes.trim() || null,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (advErr) throw advErr;

        const scheduleRows = schedule.map((s) => ({
          advance_id: advanceData.id,
          emi_month: s.emiMonth,
          emi_amount: s.emiAmount,
          is_deducted: false,
        }));
        const { error: schedErr } = await supabase
          .from("hr_advance_schedule")
          .insert(scheduleRows);
        if (schedErr) throw schedErr;

        await logEntryHistory(supabase, {
          organizationId,
          entityType: "hr_salary_advance",
          entityId: advanceData.id,
          action: "created",
          userId: user.id,
          userName,
          summary: `Salary advance of ₹${amount.toFixed(2)} for ${emp?.name || "employee"} — ${months} months from ${form.start_month}`,
        });

        toast({
          variant: "success",
          title: "Advance created",
          description: `₹${amount.toLocaleString("en-IN")} advance over ${months} months (EMI: ₹${emiAmount.toFixed(2)}/month).`,
        });
      }

      setDialogOpen(false);
      resetForm();
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save advance.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAdvance = async () => {
    if (!deletingAdvance || !allowDelete) return;
    setIsDeleting(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const empName =
        deletingAdvance.employees?.name ||
        employees.find((e) => e.id === deletingAdvance.employee_id)?.name ||
        "employee";

      const { error } = await supabase
        .from("hr_salary_advances")
        .delete()
        .eq("id", deletingAdvance.id)
        .eq("organization_id", organizationId);
      if (error) throw error;

      const userName = await getProfileDisplayName(supabase, user.id);
      await logEntryHistory(supabase, {
        organizationId,
        entityType: "hr_salary_advance",
        entityId: deletingAdvance.id,
        action: "updated",
        userId: user.id,
        userName,
        summary: `Deleted salary advance of ₹${Number(deletingAdvance.advance_amount).toFixed(2)} for ${empName}`,
      });

      toast({
        variant: "success",
        title: "Advance deleted",
        description: `Salary advance for ${empName} has been deleted.`,
      });
      setDeletingAdvance(null);
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete advance.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const getAdvanceExportData = () => {
    const enriched = processedAdvances.map((a) => ({
      ...a,
      employee_name: a.employees?.name || "—",
      employee_code: a.employees?.employee_id || "—",
    }));
    const columns: ExportColumn[] = [
      { key: "employee_code", label: "Employee ID" },
      { key: "employee_name", label: "Name" },
      { key: "advance_amount", label: "Advance Amount", formatter: (v) => Number(v).toFixed(2), align: "right" },
      { key: "repayment_months", label: "Months", align: "right" },
      { key: "emi_amount", label: "EMI/Month", formatter: (v) => Number(v).toFixed(2), align: "right" },
      { key: "start_month", label: "Start Month" },
      { key: "outstanding_balance", label: "Outstanding", formatter: (v) => Number(v).toFixed(2), align: "right" },
      { key: "status", label: "Status" },
    ];
    return { enriched, columns };
  };

  const handleExportCSV = () => {
    const { enriched, columns } = getAdvanceExportData();
    exportToCSV(enriched, columns, `advances_${getTimestamp()}.csv`);
    toast({
      variant: "success",
      title: "Exported",
      description: `${enriched.length} advance${enriched.length === 1 ? "" : "s"} exported to CSV.`,
    });
  };

  const handleExportPDF = async () => {
    const { enriched, columns } = getAdvanceExportData();
    await exportToPDF(enriched, columns, "Salary Advances", `advances_${getTimestamp()}.pdf`);
    toast({
      variant: "success",
      title: "Exported",
      description: `${enriched.length} advance${enriched.length === 1 ? "" : "s"} exported to PDF.`,
    });
  };

  const getScheduleForAdvance = (advanceId: string) =>
    advanceSchedules.filter((s) => s.advance_id === advanceId);

  const colSpan = allowEdit || allowDelete ? 9 : 8;

  return (
    <div className="space-y-8">
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="space-y-1.5 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Employee</Label>
              <SearchableSelect
                options={[{ value: "", label: "All employees" }, ...employeeOptions]}
                value={filterEmployee}
                onValueChange={setFilterEmployee}
                placeholder="Filter by employee"
                triggerClassName="w-full sm:w-48"
              />
            </div>
            <div className="space-y-1.5 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <SearchableSelect
                options={statusOptions}
                value={filterStatus}
                onValueChange={setFilterStatus}
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
                disabled={processedAdvances.length === 0}
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
                disabled={processedAdvances.length === 0}
              >
                <FileText className="h-4 w-4" />
                <span className="ml-2">PDF</span>
              </Button>
            </IconTooltip>
            <IconTooltip label="Record a new salary advance">
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />New Advance
              </Button>
            </IconTooltip>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Salary Advances</h2>
        <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>
                <button type="button" className="font-semibold" onClick={() => handleSort("employee_name")}>
                  Employee <SortIcon column="employee_name" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button type="button" className="font-semibold" onClick={() => handleSort("advance_amount")}>
                  Advance <SortIcon column="advance_amount" />
                </button>
              </TableHead>
              <TableHead className="text-center">
                <button type="button" className="font-semibold" onClick={() => handleSort("repayment_months")}>
                  Months <SortIcon column="repayment_months" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button type="button" className="font-semibold" onClick={() => handleSort("emi_amount")}>
                  EMI/Month <SortIcon column="emi_amount" />
                </button>
              </TableHead>
              <TableHead>
                <button type="button" className="font-semibold" onClick={() => handleSort("start_month")}>
                  Start Month <SortIcon column="start_month" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button type="button" className="font-semibold" onClick={() => handleSort("outstanding_balance")}>
                  Outstanding <SortIcon column="outstanding_balance" />
                </button>
              </TableHead>
              <TableHead>
                <button type="button" className="font-semibold" onClick={() => handleSort("status")}>
                  Status <SortIcon column="status" />
                </button>
              </TableHead>
              <TableHead className="text-right">Schedule</TableHead>
              {(allowEdit || allowDelete) && (
                <TableHead className="text-right">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center py-8 text-muted-foreground">
                  No salary advances found
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((adv) => {
                const statusConf = advanceStatusConfig[adv.status] || { label: adv.status, className: "bg-slate-100 text-slate-800" };
                const isExpanded = expandedAdvanceId === adv.id;
                const schedule = getScheduleForAdvance(adv.id);
                const hasDeductions = schedule.some((s) => s.is_deducted);
                return (
                  <Fragment key={adv.id}>
                    <TableRow>
                      <TableCell>
                        <div className="font-medium">{adv.employees?.name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{adv.employees?.employee_id || ""}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{Number(adv.advance_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">{adv.repayment_months}</TableCell>
                      <TableCell className="text-right">
                        ₹{Number(adv.emi_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{adv.start_month}</TableCell>
                      <TableCell className="text-right">
                        <span className={Number(adv.outstanding_balance) > 0 ? "text-orange-600 font-medium" : "text-green-600"}>
                          ₹{Number(adv.outstanding_balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConf.className}>{statusConf.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <IconTooltip
                          label={
                            isExpanded
                              ? "Hide repayment schedule"
                              : "Show repayment schedule"
                          }
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedAdvanceId(isExpanded ? null : adv.id)}
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </IconTooltip>
                      </TableCell>
                      {(allowEdit || allowDelete) && (
                        <TableCell className="text-right">
                          <TableRowActions>
                            {allowEdit && (
                              <DropdownMenuItem onSelect={() => openEditDialog(adv)}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                            )}
                            {allowDelete && (
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onSelect={() => setDeletingAdvance(adv)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                                {hasDeductions ? "…" : ""}
                              </DropdownMenuItem>
                            )}
                          </TableRowActions>
                        </TableCell>
                      )}
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${adv.id}-schedule`}>
                        <TableCell colSpan={colSpan} className="p-0">
                          <div className="bg-muted/20 border-t p-4">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Repayment Schedule
                            </p>
                            {schedule.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No schedule rows</p>
                            ) : (
                              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                                {schedule.map((s) => (
                                  <div
                                    key={s.id}
                                    className="flex items-center justify-between rounded border bg-white px-3 py-1.5 text-sm"
                                  >
                                    <span>{s.emi_month}</span>
                                    <span className="font-medium">
                                      ₹{Number(s.emi_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </span>
                                    <Badge
                                      className={
                                        s.is_deducted
                                          ? "bg-green-100 text-green-800"
                                          : "bg-amber-100 text-amber-800"
                                      }
                                    >
                                      {s.is_deducted ? "Deducted" : "Pending"}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={processedAdvances.length}
        onPageChange={pagination.goToPage}
        onItemsPerPageChange={setItemsPerPage}
      />
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingAdvance ? "Edit Salary Advance" : "New Salary Advance"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {editingHasDeductions && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                EMI deductions already exist for this advance. Amount, months, and
                schedule cannot be changed — only notes and status.
              </p>
            )}
            <div className="space-y-2">
              <Label>Employee <span className="text-red-500">*</span></Label>
              <SearchableSelect
                options={employeeOptions}
                value={form.employee_id}
                onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}
                placeholder="Select employee"
                disabled={Boolean(editingAdvance) && editingHasDeductions}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Advance Amount (₹) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.advance_amount}
                  onChange={(e) => setForm((f) => ({ ...f, advance_amount: e.target.value }))}
                  placeholder="e.g. 5000"
                  disabled={editingHasDeductions}
                />
              </div>
              <div className="space-y-2">
                <Label>Repayment Months <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min="1"
                  max="60"
                  value={form.repayment_months}
                  onChange={(e) => setForm((f) => ({ ...f, repayment_months: e.target.value }))}
                  placeholder="e.g. 3"
                  disabled={editingHasDeductions}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>First Deduction Month <span className="text-red-500">*</span></Label>
              <Input
                type="month"
                min={editingAdvance ? undefined : getIndianCurrentMonth()}
                value={form.start_month}
                onChange={(e) => setForm((f) => ({ ...f, start_month: e.target.value }))}
                disabled={editingHasDeductions}
              />
            </div>

            {emiPreview !== null && !editingHasDeductions && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm text-blue-800">
                  <span className="font-medium">EMI per month:</span>{" "}
                  ₹{emiPreview.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                {form.start_month && (
                  <div className="text-xs text-blue-600 mt-0.5">
                    First deduction: {form.start_month} · Last:{" "}
                    {(() => {
                      const [y, m] = form.start_month.split("-").map(Number);
                      const endMonth = (y * 12 + m - 1 + parseInt(form.repayment_months) - 1);
                      const endY = Math.floor(endMonth / 12);
                      const endM = (endMonth % 12) + 1;
                      return `${endY}-${String(endM).padStart(2, "0")}`;
                    })()}
                  </div>
                )}
              </div>
            )}

            {editingAdvance && (
              <div className="space-y-2">
                <Label>Status</Label>
                <SearchableSelect
                  options={formStatusOptions}
                  value={form.status}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      status: v as "active" | "completed" | "cancelled",
                    }))
                  }
                  placeholder="Status"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Optional reason or remarks"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <IconTooltip label="Discard and close">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </IconTooltip>
              <IconTooltip
                label={
                  editingAdvance
                    ? "Save salary advance changes"
                    : "Save salary advance and repayment schedule"
                }
              >
                <Button onClick={handleSaveAdvance} disabled={isSaving}>
                  {isSaving && <Spinner className="mr-2 h-4 w-4" />}
                  {editingAdvance ? "Save Changes" : "Create Advance"}
                </Button>
              </IconTooltip>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingAdvance}
        onOpenChange={(open) => !open && setDeletingAdvance(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete salary advance?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the advance for{" "}
              <strong>
                {deletingAdvance?.employees?.name || "this employee"}
              </strong>{" "}
              (₹
              {deletingAdvance
                ? Number(deletingAdvance.advance_amount).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })
                : "0"}
              ) and its repayment schedule.
              {deletingAdvance &&
                advanceSchedules.some(
                  (s) => s.advance_id === deletingAdvance.id && s.is_deducted,
                ) && (
                  <span className="block mt-2 text-amber-700">
                    Warning: some EMI installments were already deducted on salary
                    slips. Deleting will not reverse those salary deductions.
                  </span>
                )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAdvance}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Spinner className="mr-2 h-4 w-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
