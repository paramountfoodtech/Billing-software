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
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Download, FileText, Pencil, UserX, UserCheck, ArrowUpDown, ArrowUp, ArrowDown, Eye, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { suggestNextNumber } from "@/lib/purchase-document-numbers";
import { getProfileDisplayName, logEntryHistory } from "@/lib/entry-history";
import { formatIndianDate, getIndianToday, getIndianCurrentMonth } from "@/lib/date-time";
import { canEdit, isSuperAdmin } from "@/lib/permissions";
import { usePagination } from "@/hooks/use-pagination";
import { TablePagination } from "@/components/table-pagination";
import { EntryHistoryButton } from "@/components/entry-history-button";
import { TableRowActions } from "@/components/table-row-actions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { IconTooltip } from "@/components/icon-tooltip";
import { exportToCSV, exportToPDF, type ExportColumn, getTimestamp } from "@/lib/export-utils";
import type { EmployeeRow, SalaryRow } from "@/app/dashboard/expenses/payroll/payroll-page-client";

interface EmployeesTabProps {
  employees: EmployeeRow[];
  salaries?: SalaryRow[];
  existingEmployeeIds: string[];
  userRole: string;
  organizationId: string;
}

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

type SortCol = "employee_id" | "name" | "base_salary" | "date_of_joining" | "status" | "casual_leaves_per_month";

export function EmployeesTab({
  employees,
  salaries = [],
  existingEmployeeIds,
  userRole,
  organizationId,
}: EmployeesTabProps) {
  const router = useRouter();
  const { toast } = useToast();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clWarningDialogOpen, setClWarningDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<EmployeeRow | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState<EmployeeRow | null>(null);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [employeeToToggle, setEmployeeToToggle] = useState<EmployeeRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Table state
  const [sortColumn, setSortColumn] = useState<SortCol | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [filters, setFilters] = useState({ name: "", status: "" });

  // Form state
  const [form, setForm] = useState({
    employee_id: "",
    name: "",
    mobile_number: "",
    date_of_joining: getIndianToday(),
    date_of_leaving: "",
    base_salary: "",
    bank_name: "",
    bank_account_number: "",
    bank_ifsc: "",
    casual_leaves_per_month: "2",
    notes: "",
  });

  const openAddDialog = () => {
    const suggested = suggestNextNumber("EMP", existingEmployeeIds);
    setEditingEmployee(null);
    setForm({
      employee_id: suggested,
      name: "",
      mobile_number: "",
      date_of_joining: getIndianToday(),
      date_of_leaving: "",
      base_salary: "",
      bank_name: "",
      bank_account_number: "",
      bank_ifsc: "",
      casual_leaves_per_month: "2",
      notes: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (emp: EmployeeRow) => {
    setEditingEmployee(emp);
    setForm({
      employee_id: emp.employee_id,
      name: emp.name,
      mobile_number: emp.mobile_number || "",
      date_of_joining: emp.date_of_joining,
      date_of_leaving: emp.date_of_leaving || "",
      base_salary: String(Number(emp.base_salary) || ""),
      bank_name: emp.bank_name || "",
      bank_account_number: emp.bank_account_number || "",
      bank_ifsc: emp.bank_ifsc || "",
      casual_leaves_per_month:
        emp.casual_leaves_per_month != null
          ? String(emp.casual_leaves_per_month)
          : "2",
      notes: emp.notes || "",
    });
    setDialogOpen(true);
  };

  const handlePreSave = async () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Missing name", description: "Please enter the employee name." });
      return;
    }
    if ((Number(form.base_salary) || 0) < 0) {
      toast({ variant: "destructive", title: "Invalid salary", description: "Base salary must be zero or more." });
      return;
    }
    if (
      form.casual_leaves_per_month === "" ||
      Number.isNaN(Number(form.casual_leaves_per_month)) ||
      Number(form.casual_leaves_per_month) < 0
    ) {
      toast({
        variant: "destructive",
        title: "Invalid casual leaves",
        description: "Please enter casual leaves per month (0 or more).",
      });
      return;
    }

    const newCL = Number(form.casual_leaves_per_month);
    const oldCL = editingEmployee?.casual_leaves_per_month ?? null;
    const isCLChanged = newCL !== oldCL;

    if (editingEmployee && isCLChanged) {
      const supabase = createClient();
      const currentMonth = getIndianCurrentMonth();

      const { data: currentAtt } = await supabase
        .from("hr_attendance")
        .select("status")
        .eq("organization_id", organizationId)
        .eq("employee_id", editingEmployee.id)
        .eq("attendance_month", currentMonth)
        .eq("status", "finalized")
        .limit(1);

      const { data: currentSal } = await supabase
        .from("hr_salary")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("employee_id", editingEmployee.id)
        .eq("salary_month", currentMonth)
        .limit(1);

      const isFinalizedAndNoSalary = currentAtt && currentAtt.length > 0 && (!currentSal || currentSal.length === 0);

      if (isFinalizedAndNoSalary) {
        setClWarningDialogOpen(true);
        return;
      }
    }

    await executeSaveEmployee(false);
  };

  const executeSaveEmployee = async (redirectToAttendance: boolean = false) => {
    setIsSaving(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const payload = {
        name: form.name.trim(),
        mobile_number: form.mobile_number.trim() || null,
        date_of_joining: form.date_of_joining,
        date_of_leaving: form.date_of_leaving || null,
        base_salary: Number(form.base_salary) || 0,
        bank_name: form.bank_name.trim() || null,
        bank_account_number: form.bank_account_number.trim() || null,
        bank_ifsc: form.bank_ifsc.trim() || null,
        casual_leaves_per_month: Number(form.casual_leaves_per_month),
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      let entityId = editingEmployee?.id;

      if (editingEmployee) {
        const { error } = await supabase
          .from("employees")
          .update(payload)
          .eq("id", editingEmployee.id)
          .eq("organization_id", organizationId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("employees")
          .insert({
            ...payload,
            employee_id: form.employee_id.trim(),
            organization_id: organizationId,
            status: "active",
            created_by: user.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        entityId = data?.id;
      }

      if (entityId) {
        const userName = await getProfileDisplayName(supabase, user.id);
        await logEntryHistory(supabase, {
          organizationId,
          entityType: "employee",
          entityId,
          action: editingEmployee ? "updated" : "created",
          userId: user.id,
          userName,
          summary: editingEmployee
            ? `Updated employee: ${form.name.trim()}`
            : `Created employee: ${form.name.trim()} (${form.employee_id})`,
        });
      }

      toast({
        variant: "success",
        title: editingEmployee ? "Employee updated" : "Employee added",
        description: `${form.name.trim()} has been ${editingEmployee ? "updated" : "added"} successfully.`,
      });

      setClWarningDialogOpen(false);
      setDialogOpen(false);

      if (redirectToAttendance) {
        router.push("/dashboard/expenses/payroll?tab=attendance");
      } else {
        router.refresh();
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error
          ? error.message.includes("unique")
            ? "This Employee ID already exists."
            : error.message
          : "Failed to save employee.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!employeeToToggle) return;
    setIsToggling(true);
    const supabase = createClient();
    const newStatus = employeeToToggle.status === "active" ? "inactive" : "active";

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const { error } = await supabase
        .from("employees")
        .update({
          status: newStatus,
          date_of_leaving: newStatus === "inactive" ? getIndianToday() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", employeeToToggle.id);
      if (error) throw error;

      const userName = await getProfileDisplayName(supabase, user.id);
      await logEntryHistory(supabase, {
        organizationId,
        entityType: "employee",
        entityId: employeeToToggle.id,
        action: "updated",
        userId: user.id,
        userName,
        summary: `${newStatus === "inactive" ? "Deactivated" : "Reactivated"} employee: ${employeeToToggle.name}`,
      });

      toast({
        variant: "success",
        title: newStatus === "inactive" ? "Employee deactivated" : "Employee reactivated",
        description: `${employeeToToggle.name} is now ${newStatus}.`,
      });
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update status.",
      });
    } finally {
      setIsToggling(false);
      setDeactivateDialogOpen(false);
      setEmployeeToToggle(null);
    }
  };

  const handleRequestDelete = (emp: EmployeeRow) => {
    if (!isSuperAdmin(userRole)) {
      toast({
        variant: "destructive",
        title: "Access denied",
        description: "Only Super Admin can delete employees.",
      });
      return;
    }

    const hasSalaryHistory = salaries.some((s) => s.employee_id === emp.id);
    if (hasSalaryHistory) {
      toast({
        variant: "destructive",
        title: "Cannot Delete Employee",
        description: "Employees with salary history cannot be deleted; only deactivated.",
      });
      return;
    }

    setDeletingEmployee(emp);
  };

  const handleDeleteEmployee = async () => {
    if (!deletingEmployee) return;
    setIsDeleting(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", deletingEmployee.id);

      if (error) throw error;

      toast({
        variant: "success",
        title: "Employee deleted",
        description: `Employee ${deletingEmployee.name} has been deleted successfully.`,
      });
      setDeletingEmployee(null);
      router.refresh();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete employee.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter + sort
  const processedEmployees = useMemo(() => {
    let filtered = [...employees];
    if (filters.name) {
      const q = filters.name.toLowerCase();
      filtered = filtered.filter(
        (e) => e.name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q),
      );
    }
    if (filters.status) {
      filtered = filtered.filter((e) => e.status === filters.status);
    }

    if (sortColumn) {
      filtered.sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        switch (sortColumn) {
          case "employee_id": aVal = a.employee_id; bVal = b.employee_id; break;
          case "name": aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
          case "casual_leaves_per_month":
            aVal = Number(a.casual_leaves_per_month);
            bVal = Number(b.casual_leaves_per_month);
            break;
          case "base_salary": aVal = Number(a.base_salary); bVal = Number(b.base_salary); break;
          case "date_of_joining":
            aVal = new Date(a.date_of_joining).getTime();
            bVal = new Date(b.date_of_joining).getTime();
            break;
          case "status": aVal = a.status; bVal = b.status; break;
          default: return 0;
        }
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [employees, filters, sortColumn, sortDirection]);

  const pagination = usePagination({ items: processedEmployees, itemsPerPage });

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

  const getEmployeeExportData = () => {
    const enriched = processedEmployees.map((e) => ({
      ...e,
      formatted_joining: formatIndianDate(e.date_of_joining, { year: "numeric", month: "2-digit", day: "2-digit" }),
    }));
    const columns: ExportColumn[] = [
      { key: "employee_id", label: "Employee ID" },
      { key: "name", label: "Name" },
      { key: "mobile_number", label: "Mobile" },
      { key: "casual_leaves_per_month", label: "CL / Month" },
      { key: "formatted_joining", label: "Date of Joining" },
      { key: "base_salary", label: "Base Salary", formatter: (v) => Number(v).toFixed(2), align: "right" },
      { key: "status", label: "Status" },
    ];
    return { enriched, columns };
  };

  const handleExportCSV = () => {
    const { enriched, columns } = getEmployeeExportData();
    exportToCSV(enriched, columns, `employees_${getTimestamp()}.csv`);
    toast({
      variant: "success",
      title: "Exported",
      description: `${enriched.length} employee${enriched.length === 1 ? "" : "s"} exported to CSV.`,
    });
  };

  const handleExportPDF = async () => {
    const { enriched, columns } = getEmployeeExportData();
    await exportToPDF(enriched, columns, "Employees", `employees_${getTimestamp()}.pdf`);
    toast({
      variant: "success",
      title: "Exported",
      description: `${enriched.length} employee${enriched.length === 1 ? "" : "s"} exported to PDF.`,
    });
  };

  const allowEdit = canEdit(userRole);

  return (
    <div className="space-y-8">
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
                options={[{ value: "", label: "All statuses" }, ...statusOptions]}
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
                disabled={processedEmployees.length === 0}
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
                disabled={processedEmployees.length === 0}
              >
                <FileText className="h-4 w-4" />
                <span className="ml-2">PDF</span>
              </Button>
            </IconTooltip>
            <IconTooltip label="Add a new employee">
              <Button onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />Add Employee
              </Button>
            </IconTooltip>
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Employees</h2>
        <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>
                <button type="button" className="font-semibold" onClick={() => handleSort("employee_id")}>
                  Employee ID <SortIcon column="employee_id" />
                </button>
              </TableHead>
              <TableHead>
                <button type="button" className="font-semibold" onClick={() => handleSort("name")}>
                  Name <SortIcon column="name" />
                </button>
              </TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>
                <button type="button" className="font-semibold" onClick={() => handleSort("casual_leaves_per_month")}>
                  CL / Month <SortIcon column="casual_leaves_per_month" />
                </button>
              </TableHead>
              <TableHead>
                <button type="button" className="font-semibold" onClick={() => handleSort("date_of_joining")}>
                  Joined <SortIcon column="date_of_joining" />
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button type="button" className="font-semibold" onClick={() => handleSort("base_salary")}>
                  Base Salary <SortIcon column="base_salary" />
                </button>
              </TableHead>
              <TableHead>
                <button type="button" className="font-semibold" onClick={() => handleSort("status")}>
                  Status <SortIcon column="status" />
                </button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No employees found
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedItems.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell className="font-medium">{emp.employee_id}</TableCell>
                  <TableCell>{emp.name}</TableCell>
                  <TableCell>{emp.mobile_number || "—"}</TableCell>
                  <TableCell className="text-center">
                    {Number(emp.casual_leaves_per_month ?? 0)}
                  </TableCell>
                  <TableCell>
                    {formatIndianDate(emp.date_of_joining, { year: "numeric", month: "short", day: "numeric" })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₹{Number(emp.base_salary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <Badge className={emp.status === "active" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}>
                      {emp.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <EntryHistoryButton
                        entityType="employee"
                        entityId={emp.id}
                        createdAt={emp.created_at}
                      />
                      <TableRowActions>
                        <DropdownMenuItem onSelect={() => setViewingEmployee(emp)}>
                          <Eye className="h-4 w-4 mr-2" /> View Details
                        </DropdownMenuItem>
                        {allowEdit && (
                          <DropdownMenuItem onSelect={() => openEditDialog(emp)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onSelect={() => {
                            setEmployeeToToggle(emp);
                            setDeactivateDialogOpen(true);
                          }}
                        >
                          {emp.status === "active" ? <><UserX className="h-4 w-4 mr-2" /> Deactivate</> : <><UserCheck className="h-4 w-4 mr-2" /> Reactivate</>}
                        </DropdownMenuItem>
                        {isSuperAdmin(userRole) && (
                          <DropdownMenuItem
                            onSelect={() => handleRequestDelete(emp)}
                            className="text-red-600 focus:text-red-600 font-medium"
                          >
                            <Trash2 className="h-4 w-4 mr-2 text-red-600" /> Delete
                          </DropdownMenuItem>
                        )}
                      </TableRowActions>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={processedEmployees.length}
        onPageChange={pagination.goToPage}
        onItemsPerPageChange={setItemsPerPage}
      />
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Employee ID</Label>
                <Input value={form.employee_id} disabled readOnly className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Name <span className="text-red-500">*</span></Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2">
                <Label>Mobile Number</Label>
                <Input
                  value={form.mobile_number}
                  onChange={(e) => setForm((f) => ({ ...f, mobile_number: e.target.value }))}
                  placeholder="10-digit mobile"
                />
              </div>
              <div className="space-y-2">
                <Label>Date of Joining <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.date_of_joining}
                  onChange={(e) => setForm((f) => ({ ...f, date_of_joining: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Date of Leaving</Label>
                <Input
                  type="date"
                  value={form.date_of_leaving}
                  onChange={(e) => setForm((f) => ({ ...f, date_of_leaving: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Base Salary (₹/month) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.base_salary}
                  onChange={(e) => setForm((f) => ({ ...f, base_salary: e.target.value }))}
                  placeholder="Monthly salary"
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Casual Leaves / Month <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={form.casual_leaves_per_month}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      casual_leaves_per_month: e.target.value,
                    }))
                  }
                  placeholder="e.g. 2"
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3 text-muted-foreground">Bank Details (Optional)</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Bank Name</Label>
                  <Input
                    value={form.bank_name}
                    onChange={(e) => setForm((f) => ({ ...f, bank_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Number</Label>
                  <Input
                    value={form.bank_account_number}
                    onChange={(e) => setForm((f) => ({ ...f, bank_account_number: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>IFSC Code</Label>
                  <Input
                    value={form.bank_ifsc}
                    onChange={(e) => setForm((f) => ({ ...f, bank_ifsc: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <IconTooltip label="Discard changes and close">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
                  Cancel
                </Button>
              </IconTooltip>
              <IconTooltip
                label={
                  editingEmployee
                    ? "Save employee changes"
                    : "Create employee record"
                }
              >
                <Button onClick={handlePreSave} disabled={isSaving}>
                  {isSaving && <Spinner className="mr-2 h-4 w-4" />}
                  {editingEmployee ? "Save Changes" : "Add Employee"}
                </Button>
              </IconTooltip>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Warning AlertDialog for Finalized Attendance on Employee CL Edit */}
      <AlertDialog open={clWarningDialogOpen} onOpenChange={setClWarningDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Current Month Attendance is Finalized</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <span className="block">
                Attendance for <strong>{form.name}</strong> in <strong>{getIndianCurrentMonth()}</strong> is already finalized. To apply the updated CL entitlement, attendance must be unlocked in the Attendance tab and finalized again.
              </span>
              <span className="block font-medium text-slate-900 pt-1">
                Save changes and go to Attendance tab?
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClWarningDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => executeSaveEmployee(true)}>
              Save & Go to Attendance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deactivate/Reactivate Confirm */}
      <AlertDialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {employeeToToggle?.status === "active" ? "Deactivate" : "Reactivate"} employee?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {employeeToToggle?.status === "active"
                ? `${employeeToToggle?.name} will be deactivated. Historical data will be preserved.`
                : `${employeeToToggle?.name} will be reactivated and can be assigned attendance again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isToggling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleStatus}
              disabled={isToggling}
              className={employeeToToggle?.status === "active" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {isToggling ? "Processing..." : employeeToToggle?.status === "active" ? "Deactivate" : "Reactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Employee Details Dialog */}
      <Dialog open={!!viewingEmployee} onOpenChange={(open) => !open && setViewingEmployee(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Employee Profile — {viewingEmployee?.employee_id}</DialogTitle>
          </DialogHeader>
          {viewingEmployee && (
            <div className="space-y-4 pt-2 text-sm">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{viewingEmployee.name}</h3>
                  <p className="text-xs text-muted-foreground">{viewingEmployee.employee_id}</p>
                </div>
                <div className="flex gap-2">
                  <Badge className={viewingEmployee.status === "active" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}>
                    {viewingEmployee.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block font-medium">Mobile Number</span>
                  <span className="font-semibold text-slate-800">{viewingEmployee.mobile_number || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-medium">Base Monthly Salary</span>
                  <span className="font-semibold text-slate-800">
                    ₹{Number(viewingEmployee.base_salary).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-medium">Date of Joining</span>
                  <span className="font-semibold text-slate-800">
                    {formatIndianDate(viewingEmployee.date_of_joining, { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block font-medium">Date of Leaving</span>
                  <span className="font-semibold text-slate-800">
                    {viewingEmployee.date_of_leaving
                      ? formatIndianDate(viewingEmployee.date_of_leaving, { year: "numeric", month: "short", day: "numeric" })
                      : "—"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block font-medium">Casual Leave Allocation</span>
                  <span className="font-semibold text-slate-800">
                    {Number(viewingEmployee.casual_leaves_per_month ?? 0)} days / month
                  </span>
                </div>
              </div>

              {viewingEmployee.bank_name && (
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs space-y-1">
                  <span className="font-semibold text-slate-700 block">Bank Account Details</span>
                  <div>Bank: <span className="font-medium">{viewingEmployee.bank_name}</span></div>
                  <div>Account No: <span className="font-medium">{viewingEmployee.bank_account_number || "—"}</span></div>
                  <div>IFSC Code: <span className="font-medium">{viewingEmployee.bank_ifsc || "—"}</span></div>
                </div>
              )}

              {viewingEmployee.notes && (
                <div className="text-xs">
                  <span className="text-muted-foreground block font-medium mb-1">Notes</span>
                  <p className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-700">{viewingEmployee.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Employee Confirm Dialog */}
      <AlertDialog open={!!deletingEmployee} onOpenChange={(open) => !open && setDeletingEmployee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete employee {deletingEmployee?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete employee {deletingEmployee?.name} ({deletingEmployee?.employee_id})?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEmployee}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Employee"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
