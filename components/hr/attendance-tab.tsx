"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Save, Lock, Unlock, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table-pagination";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { getProfileDisplayName, logEntryHistory } from "@/lib/entry-history";
import { getIndianCurrentMonth, getIndianToday } from "@/lib/date-time";
import {
  type DayAttendanceMark,
  type DayAttendanceStatus,
  daysInMonth,
  defaultMonthDayStatuses,
  getEmployeeCasualLeaveLimit,
  rollupDailyAttendance,
  calculateSalary,
} from "@/lib/hr-calculations";
import { canUnlockAttendance, isSuperAdmin } from "@/lib/permissions";
import { IconTooltip } from "@/components/icon-tooltip";
import { cn } from "@/lib/utils";
import type {
  EmployeeRow,
  AttendanceRow,
  AttendanceDayRow,
  SalaryRow,
} from "@/app/dashboard/expenses/payroll/payroll-page-client";

interface AttendanceTabProps {
  employees: EmployeeRow[];
  attendance: AttendanceRow[];
  attendanceDays: AttendanceDayRow[];
  salaries: SalaryRow[];
  userRole: string;
  organizationId: string;
}

type DayMap = Record<string, DayAttendanceMark>; // date -> status

type AttendanceEdit = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  existingId: string | null;
  days: DayMap;
  workingDays: number;
  daysPresent: number;
  casualLeave: number;
  lop: number;
  status: "draft" | "finalized";
  maxCL: number;
  isPaid: boolean;
};

type SortCol =
  | "employeeCode"
  | "employeeName"
  | "daysPresent"
  | "casualLeave"
  | "lop"
  | "status";

const STATUS_LABEL: Record<DayAttendanceMark, string> = {
  empty: "",
  present: "P",
  absent: "A",
  casual_leave: "CL",
};

/** Status colors when the day is editable. */
const STATUS_CLASS_EDITABLE: Record<DayAttendanceMark, string> = {
  empty:
    "bg-white text-slate-500 border-2 border-blue-400 hover:bg-blue-50 hover:border-blue-600 shadow-sm",
  present:
    "bg-green-500 text-white border-2 border-green-600 hover:bg-green-600 shadow-sm",
  absent:
    "bg-red-500 text-white border-2 border-red-600 hover:bg-red-600 shadow-sm",
  casual_leave:
    "bg-amber-500 text-white border-2 border-amber-600 hover:bg-amber-600 shadow-sm",
};

/** Status colors when the day is locked / not editable. */
const STATUS_CLASS_LOCKED: Record<DayAttendanceMark, string> = {
  empty: "bg-slate-100 text-slate-300 border border-slate-200",
  present: "bg-green-100/70 text-green-700/50 border border-green-200/60",
  absent: "bg-red-100/70 text-red-700/50 border border-red-200/60",
  casual_leave: "bg-amber-100/70 text-amber-700/50 border border-amber-200/60",
};

function monthDateRange(monthKey: string) {
  const n = daysInMonth(monthKey);
  const [y, m] = monthKey.split("-").map(Number);
  return {
    start: `${monthKey}-01`,
    end: `${monthKey}-${String(n).padStart(2, "0")}`,
    dayCount: n,
    year: y,
    month: m,
  };
}

export function AttendanceTab({
  employees,
  attendance,
  attendanceDays: initialAttendanceDays,
  salaries,
  userRole,
  organizationId,
}: AttendanceTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedMonth, setSelectedMonth] = useState(getIndianCurrentMonth());
  const monthLabel = useMemo(() => {
    return selectedMonth
      ? new Date(`${selectedMonth}-01`).toLocaleDateString("en-IN", {
          month: "long",
          year: "numeric",
        })
      : "";
  }, [selectedMonth]);

  const [dayRecords, setDayRecords] = useState<AttendanceDayRow[]>(
    initialAttendanceDays,
  );
  const [isLoadingDays, setIsLoadingDays] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);

  const [filters, setFilters] = useState({ name: "", status: "" });
  const [sortColumn, setSortColumn] = useState<SortCol | null>("employeeCode");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const attendanceStatusOptions = [
    { value: "draft", label: "Draft" },
    { value: "finalized", label: "Finalized" },
    { value: "paid", label: "Salary Paid" },
  ];

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === "active"),
    [employees],
  );

  const monthAttendance = useMemo(
    () => attendance.filter((a) => a.attendance_month === selectedMonth),
    [attendance, selectedMonth],
  );

  const dayNumbers = useMemo(() => {
    const n = daysInMonth(selectedMonth);
    return Array.from({ length: n }, (_, i) => i + 1);
  }, [selectedMonth]);

  const loadDaysForMonth = useCallback(
    async (month: string) => {
      const { start, end } = monthDateRange(month);
      setIsLoadingDays(true);
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from("hr_attendance_days")
          .select("*")
          .eq("organization_id", organizationId)
          .gte("attendance_date", start)
          .lte("attendance_date", end)
          .order("attendance_date", { ascending: true });
        if (error) throw error;
        setDayRecords((data || []) as AttendanceDayRow[]);
      } catch (error: unknown) {
        toast({
          variant: "destructive",
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to load daily attendance.",
        });
      } finally {
        setIsLoadingDays(false);
      }
    },
    [organizationId, toast],
  );

  useEffect(() => {
    const current = getIndianCurrentMonth();
    if (selectedMonth === current) {
      setDayRecords(initialAttendanceDays);
    } else {
      void loadDaysForMonth(selectedMonth);
    }
  }, [selectedMonth, initialAttendanceDays, loadDaysForMonth]);

  const buildRows = useCallback((): AttendanceEdit[] => {
    const defaults = defaultMonthDayStatuses(selectedMonth);

    return activeEmployees.map((emp) => {
      const existing = monthAttendance.find((a) => a.employee_id === emp.id);
      const existingSalary = salaries.find(
        (s) => s.salary_month === selectedMonth && s.employee_id === emp.id,
      );
      const isPaid = existingSalary?.payment_status === "paid";
      const maxCL = getEmployeeCasualLeaveLimit(emp.casual_leaves_per_month);

      const empDays = dayRecords.filter((d) => d.employee_id === emp.id);
      const days: DayMap = {};
      for (const def of defaults) {
        const found = empDays.find((d) => d.attendance_date === def.date);
        days[def.date] = (found?.status as DayAttendanceStatus) || "empty";
      }

      const rollup = rollupDailyAttendance(Object.values(days), maxCL);

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        employeeCode: emp.employee_id,
        existingId: existing?.id || null,
        days,
        workingDays: rollup.workingDays,
        daysPresent: rollup.daysPresent,
        casualLeave: rollup.casualLeave,
        lop: rollup.lop,
        status: (existing?.status as "draft" | "finalized") || "draft",
        maxCL,
        isPaid,
      };
    });
  }, [
    activeEmployees,
    monthAttendance,
    salaries,
    selectedMonth,
    dayRecords,
  ]);

  const [rows, setRows] = useState<AttendanceEdit[]>(() => buildRows());

  useEffect(() => {
    setRows(buildRows());
  }, [buildRows]);

  const cycleDayStatus = (
    employeeId: string,
    date: string,
  ) => {
    const row = rows.find((r) => r.employeeId === employeeId);
    if (!row) return;

    if (!canEditDay(date, row)) {
      if (date > today) {
        toast({
          variant: "destructive",
          title: "Future dates locked",
          description: "Attendance cannot be marked for future dates.",
        });
      } else if (!allowPastDateEdits && date < today) {
        toast({
          variant: "destructive",
          title: "Past dates locked",
          description:
            "Only Super Admin can add or edit attendance for previous dates.",
        });
      }
      return;
    }

    const statusCycle: DayAttendanceMark[] =
      row.maxCL > 0
        ? ["empty", "present", "absent", "casual_leave"]
        : ["empty", "present", "absent"];

    const current = row.days[date] || "empty";
    // If CL was marked but employee has no CL entitlement, treat as empty for cycling
    const normalizedCurrent =
      current === "casual_leave" && row.maxCL <= 0 ? "empty" : current;
    const currentIndex = statusCycle.indexOf(normalizedCurrent);
    let next =
      statusCycle[
        (currentIndex >= 0 ? currentIndex + 1 : 0) % statusCycle.length
      ];

    if (next === "casual_leave") {
      const usedCL = Object.entries(row.days).filter(
        ([d, s]) => d !== date && s === "casual_leave",
      ).length;
      if (usedCL >= row.maxCL) {
        toast({
          variant: "destructive",
          title: "CL limit reached",
          description: `${row.employeeName} has used all ${row.maxCL} casual leave day(s) this month.`,
        });
        next = "absent";
      }
    }

    setRows((prev) => {
      const idx = prev.findIndex((r) => r.employeeId === employeeId);
      if (idx === -1) return prev;
      const latest = prev[idx];
      const days = { ...latest.days, [date]: next };
      const rollup = rollupDailyAttendance(Object.values(days), latest.maxCL);
      const updated = [...prev];
      updated[idx] = {
        ...latest,
        days,
        workingDays: rollup.workingDays,
        daysPresent: rollup.daysPresent,
        casualLeave: rollup.casualLeave,
        lop: rollup.lop,
      };
      return updated;
    });
  };

  const handleSort = (col: SortCol) => {
    if (sortColumn === col) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column)
      return <ArrowUpDown className="ml-1 h-3.5 w-3.5 inline opacity-40" />;
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 h-3.5 w-3.5 inline" />
    ) : (
      <ArrowDown className="ml-1 h-3.5 w-3.5 inline" />
    );
  };

  const processedRows = useMemo(() => {
    let filtered = [...rows];

    if (filters.name.trim()) {
      const query = filters.name.trim().toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(query) ||
          r.employeeCode.toLowerCase().includes(query),
      );
    }

    if (filters.status) {
      if (filters.status === "paid") {
        filtered = filtered.filter((r) => r.isPaid);
      } else {
        filtered = filtered.filter(
          (r) => r.status === filters.status && !r.isPaid,
        );
      }
    }

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        switch (sortColumn) {
          case "employeeCode":
            aVal = a.employeeCode;
            bVal = b.employeeCode;
            break;
          case "employeeName":
            aVal = a.employeeName.toLowerCase();
            bVal = b.employeeName.toLowerCase();
            break;
          case "daysPresent":
            aVal = a.daysPresent;
            bVal = b.daysPresent;
            break;
          case "casualLeave":
            aVal = a.casualLeave;
            bVal = b.casualLeave;
            break;
          case "lop":
            aVal = a.lop;
            bVal = b.lop;
            break;
          case "status":
            aVal = a.isPaid ? "paid" : a.status;
            bVal = b.isPaid ? "paid" : b.status;
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
  }, [rows, filters, sortColumn, sortDirection]);

  const pagination = usePagination({ items: processedRows, itemsPerPage });

  const allFinalized =
    rows.length > 0 && rows.every((r) => r.status === "finalized" || r.isPaid);
  const canUnlock = canUnlockAttendance(userRole);
  const hasFinalizedToUnlock = rows.some(
    (r) => r.status === "finalized" && !r.isPaid,
  );
  const today = getIndianToday();
  const allowPastDateEdits = isSuperAdmin(userRole);

  const canEditDay = (date: string, row: AttendanceEdit) => {
    if (row.isPaid || row.status === "finalized") return false;
    // Future dates are locked for everyone
    if (date > today) return false;
    if (allowPastDateEdits) return true;
    // Admin / accountant: today only
    return date === today;
  };

  const persistDailyAndMonthly = async (
    supabase: ReturnType<typeof createClient>,
    userId: string,
    finalize: boolean,
  ) => {
    const now = new Date().toISOString();

    for (const row of rows) {
      if (row.isPaid) continue;
      if (!finalize && row.status === "finalized") continue;

      const dayPayloads = Object.entries(row.days)
        .filter(([date, status]) => {
          if (status === "empty") return false;
          if (date > today) return false;
          if (!allowPastDateEdits && date < today) return false;
          return true;
        })
        .map(([date, status]) => ({
          organization_id: organizationId,
          employee_id: row.employeeId,
          attendance_date: date,
          status: status as DayAttendanceStatus,
          updated_at: now,
        }));

      const emptyDates = Object.entries(row.days)
        .filter(([date, status]) => {
          if (status !== "empty") return false;
          if (date > today) return false;
          if (!allowPastDateEdits && date < today) return false;
          return true;
        })
        .map(([date]) => date);

      if (emptyDates.length > 0) {
        const { error: delError } = await supabase
          .from("hr_attendance_days")
          .delete()
          .eq("organization_id", organizationId)
          .eq("employee_id", row.employeeId)
          .in("attendance_date", emptyDates);
        if (delError) throw delError;
      }

      if (dayPayloads.length > 0) {
        const { error: daysError } = await supabase
          .from("hr_attendance_days")
          .upsert(dayPayloads, {
            onConflict: "organization_id,employee_id,attendance_date",
          });
        if (daysError) throw daysError;
      }

      const monthlyPayload = {
        organization_id: organizationId,
        employee_id: row.employeeId,
        attendance_month: selectedMonth,
        working_days: row.workingDays,
        days_present: row.daysPresent,
        casual_leave: row.casualLeave,
        loss_of_pay: row.lop,
        status: finalize ? ("finalized" as const) : ("draft" as const),
        ...(finalize
          ? { finalized_by: userId, finalized_at: now }
          : {}),
        updated_at: now,
      };

      if (row.existingId) {
        const { error } = await supabase
          .from("hr_attendance")
          .update(monthlyPayload)
          .eq("id", row.existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("hr_attendance")
          .insert({ ...monthlyPayload, created_by: userId })
          .select("id")
          .single();
        if (error) throw error;
        row.existingId = data.id;
      }
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      await persistDailyAndMonthly(supabase, user.id, false);

      const userName = await getProfileDisplayName(supabase, user.id);
      await logEntryHistory(supabase, {
        organizationId,
        entityType: "hr_attendance",
        entityId: selectedMonth,
        action: "updated",
        userId: user.id,
        userName,
        summary: `Saved daily attendance draft for ${selectedMonth} (${rows.length} employees)`,
      });

      toast({
        variant: "success",
        title: "Draft saved",
        description: "Daily attendance draft updated successfully.",
      });
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save attendance draft.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    setIsFinalizing(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      for (const row of rows) {
        if (row.isPaid) continue;
        if (row.workingDays <= 0) {
          throw new Error(
            `Working days must be greater than 0 for ${row.employeeName}.`,
          );
        }
      }

      await persistDailyAndMonthly(supabase, user.id, true);

      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          status: "finalized" as const,
        })),
      );

      // Recalc unpaid salaries for this month if they exist
      const { data: existingSalaries } = await supabase
        .from("hr_salary")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("salary_month", selectedMonth)
        .neq("payment_status", "paid");

      if (existingSalaries && existingSalaries.length > 0) {
        for (const sal of existingSalaries) {
          const row = rows.find((r) => r.employeeId === sal.employee_id);
          if (!row) continue;
          const result = calculateSalary(
            Number(sal.base_salary),
            row.workingDays,
            row.daysPresent,
            row.casualLeave,
            row.lop,
            Number(sal.advance_emi_deduction),
          );
          await supabase
            .from("hr_salary")
            .update({
              working_days: row.workingDays,
              days_present: row.daysPresent,
              casual_leave: row.casualLeave,
              loss_of_pay: row.lop,
              earned_salary: result.earnedSalary,
              lop_deduction: result.lopDeduction,
              net_payable: result.netPayable,
              attendance_id: row.existingId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sal.id);
        }
      }

      const userName = await getProfileDisplayName(supabase, user.id);
      await logEntryHistory(supabase, {
        organizationId,
        entityType: "hr_attendance",
        entityId: selectedMonth,
        action: "updated",
        userId: user.id,
        userName,
        summary: `Finalized daily attendance for ${selectedMonth}`,
      });

      toast({
        variant: "success",
        title: "Attendance finalized",
        description: `Attendance for ${monthLabel} is locked.`,
      });
      setFinalizeDialogOpen(false);
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to finalize attendance.",
      });
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleUnlock = async () => {
    setIsUnlocking(true);
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const paidEmployeeIds = new Set(
        salaries
          .filter(
            (s) =>
              s.salary_month === selectedMonth && s.payment_status === "paid",
          )
          .map((s) => s.employee_id),
      );

      const idsToUnlock = rows
        .filter((r) => r.existingId && !paidEmployeeIds.has(r.employeeId))
        .map((r) => r.existingId!);

      if (idsToUnlock.length > 0) {
        const { error } = await supabase
          .from("hr_attendance")
          .update({
            status: "draft",
            finalized_by: null,
            finalized_at: null,
            updated_at: new Date().toISOString(),
          })
          .in("id", idsToUnlock);
        if (error) throw error;
      }

      const userName = await getProfileDisplayName(supabase, user.id);
      await logEntryHistory(supabase, {
        organizationId,
        entityType: "hr_attendance",
        entityId: selectedMonth,
        action: "updated",
        userId: user.id,
        userName,
        summary: `Unlocked attendance for ${selectedMonth}`,
      });

      toast({
        variant: "success",
        title: "Attendance unlocked",
        description: "You can edit daily marks again.",
      });
      setUnlockDialogOpen(false);
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to unlock attendance.",
      });
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="space-y-6">
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
                className="w-full sm:w-44"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Search name / ID..."
                value={filters.name}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, name: e.target.value }))
                }
                className="w-full sm:w-48"
              />
            </div>
            <div className="space-y-1.5 min-w-[140px]">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <SearchableSelect
                options={[
                  { value: "", label: "All statuses" },
                  ...attendanceStatusOptions,
                ]}
                value={filters.status}
                onValueChange={(v) =>
                  setFilters((f) => ({ ...f, status: v }))
                }
                placeholder="Status"
                triggerClassName="w-full sm:w-40"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <IconTooltip label="Save attendance as draft">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={isSaving || isFinalizing || allFinalized}
              >
                {isSaving ? (
                  <Spinner className="mr-2 h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Draft
              </Button>
            </IconTooltip>
            <IconTooltip label="Finalize attendance for the month">
              <Button
                size="sm"
                onClick={() => setFinalizeDialogOpen(true)}
                disabled={isSaving || isFinalizing || allFinalized || rows.length === 0}
              >
                {isFinalizing ? (
                  <Spinner className="mr-2 h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                Finalize
              </Button>
            </IconTooltip>
            {canUnlock && hasFinalizedToUnlock && (
              <IconTooltip label="Unlock finalized attendance (Super Admin only)">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUnlockDialogOpen(true)}
                  disabled={isUnlocking}
                >
                  {isUnlocking ? (
                    <Spinner className="mr-2 h-4 w-4" />
                  ) : (
                    <Unlock className="h-4 w-4 mr-2" />
                  )}
                  Unlock
                </Button>
              </IconTooltip>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex flex-wrap items-center gap-x-1">
            Click editable days to cycle: empty →
            <Badge className="bg-green-500 text-white">P</Badge> Present
            <Badge className="bg-red-500 text-white">A</Badge> Absent
            <Badge className="bg-amber-500 text-white">CL</Badge> Casual Leave
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-blue-400 bg-white text-[9px] font-semibold text-blue-600">
              ·
            </span>
            Editable
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-100 text-[9px] text-slate-300">
              ·
            </span>
            Locked
          </span>
          {!allowPastDateEdits && (
            <span className="inline-flex items-center leading-none">
              Today only · Past: Super Admin · Future: locked
            </span>
          )}
          {allowPastDateEdits && (
            <span className="inline-flex items-center leading-none">
              Past + today editable · Future locked
            </span>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">
          Daily Attendance — {monthLabel}
          {isLoadingDays && (
            <Spinner className="inline-block ml-2 h-4 w-4" />
          )}
        </h2>
        <div className="border rounded-lg overflow-x-auto">
          <Table className="border-separate border-spacing-0">
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead className="sticky left-0 z-30 w-[130px] min-w-[130px] max-w-[130px] bg-muted border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]">
                  <button
                    type="button"
                    className="font-semibold"
                    onClick={() => handleSort("employeeCode")}
                  >
                    ID <SortIcon column="employeeCode" />
                  </button>
                </TableHead>
                <TableHead className="sticky left-[130px] z-30 w-[160px] min-w-[160px] max-w-[160px] bg-muted border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]">
                  <button
                    type="button"
                    className="font-semibold"
                    onClick={() => handleSort("employeeName")}
                  >
                    Name <SortIcon column="employeeName" />
                  </button>
                </TableHead>
                {dayNumbers.map((d) => {
                  const date = `${selectedMonth}-${String(d).padStart(2, "0")}`;
                  const isToday = date === today;
                  return (
                    <TableHead
                      key={d}
                      className={cn(
                        "text-center px-1 min-w-[36px] w-[36px] text-[10px]",
                        isToday
                          ? "bg-blue-100 text-blue-800 font-bold"
                          : "bg-muted",
                      )}
                    >
                      {d}
                    </TableHead>
                  );
                })}
                <TableHead className="text-center min-w-[48px] bg-muted">
                  <button
                    type="button"
                    className="font-semibold text-xs"
                    onClick={() => handleSort("daysPresent")}
                  >
                    P <SortIcon column="daysPresent" />
                  </button>
                </TableHead>
                <TableHead className="text-center min-w-[48px] bg-muted">
                  <button
                    type="button"
                    className="font-semibold text-xs"
                    onClick={() => handleSort("casualLeave")}
                  >
                    CL <SortIcon column="casualLeave" />
                  </button>
                </TableHead>
                <TableHead className="text-center min-w-[48px] bg-muted">
                  <button
                    type="button"
                    className="font-semibold text-xs"
                    onClick={() => handleSort("lop")}
                  >
                    LOP <SortIcon column="lop" />
                  </button>
                </TableHead>
                <TableHead className="min-w-[90px] bg-muted">
                  <button
                    type="button"
                    className="font-semibold"
                    onClick={() => handleSort("status")}
                  >
                    Status <SortIcon column="status" />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.paginatedItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={dayNumbers.length + 6}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No active employees found
                  </TableCell>
                </TableRow>
              ) : (
                pagination.paginatedItems.map((row) => {
                  const rowLocked = row.isPaid || row.status === "finalized";
                  return (
                    <TableRow key={row.employeeId}>
                      <TableCell className="sticky left-0 z-20 w-[130px] min-w-[130px] max-w-[130px] bg-white border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] font-medium text-xs truncate">
                        {row.employeeCode}
                      </TableCell>
                      <TableCell className="sticky left-[130px] z-20 w-[160px] min-w-[160px] max-w-[160px] bg-white border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] text-xs">
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{row.employeeName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {row.maxCL > 0
                              ? `CL left: ${Math.max(0, row.maxCL - row.casualLeave)}/${row.maxCL}`
                              : "No CL · Absent = LOP"}
                          </span>
                        </div>
                      </TableCell>
                      {dayNumbers.map((d) => {
                        const date = `${selectedMonth}-${String(d).padStart(2, "0")}`;
                        const status: DayAttendanceMark =
                          row.days[date] || "empty";
                        const dayEditable = canEditDay(date, row);
                        const isToday = date === today;
                        return (
                          <TableCell
                            key={date}
                            className={cn(
                              "p-0.5 text-center",
                              isToday && "bg-blue-50/80",
                            )}
                          >
                            <button
                              type="button"
                              disabled={!dayEditable}
                              onClick={() =>
                                cycleDayStatus(row.employeeId, date)
                              }
                              className={cn(
                                "h-7 w-7 rounded text-[10px] font-bold transition-all",
                                dayEditable
                                  ? cn(
                                      "cursor-pointer ring-offset-1 hover:ring-2 hover:ring-blue-300",
                                      STATUS_CLASS_EDITABLE[status],
                                    )
                                  : cn(
                                      "cursor-not-allowed",
                                      STATUS_CLASS_LOCKED[status],
                                    ),
                              )}
                              title={
                                date > today
                                  ? `${date}: future date (locked)`
                                  : !dayEditable &&
                                      !rowLocked &&
                                      date < today
                                    ? `${date}: past date (Super Admin only)`
                                    : dayEditable
                                      ? `${date}: ${status === "empty" ? "unmarked — click to mark" : status + " — click to change"}`
                                      : `${date}: ${status === "empty" ? "unmarked" : status} (locked)`
                              }
                            >
                              {STATUS_LABEL[status] || (dayEditable ? "+" : "·")}
                            </button>
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center text-xs font-medium">
                        {row.daysPresent}
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium">
                        {row.casualLeave}
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium text-red-700">
                        {row.lop}
                      </TableCell>
                      <TableCell>
                        {row.isPaid ? (
                          <Badge className="bg-green-100 text-green-800">
                            Paid
                          </Badge>
                        ) : row.status === "finalized" ? (
                          <Badge className="bg-blue-100 text-blue-800">
                            Finalized
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Draft</Badge>
                        )}
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
          itemsPerPage={itemsPerPage}
          totalItems={processedRows.length}
          onPageChange={pagination.goToPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      </div>

      <AlertDialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalize attendance?</AlertDialogTitle>
            <AlertDialogDescription>
              This locks daily attendance for {monthLabel}. You will need a Super
              Admin to unlock before further edits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isFinalizing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalize} disabled={isFinalizing}>
              {isFinalizing && <Spinner className="mr-2 h-4 w-4" />}
              Finalize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock attendance?</AlertDialogTitle>
            <AlertDialogDescription>
              Reopen draft editing for unpaid employees in {monthLabel}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnlocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlock} disabled={isUnlocking}>
              {isUnlocking && <Spinner className="mr-2 h-4 w-4" />}
              Unlock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
