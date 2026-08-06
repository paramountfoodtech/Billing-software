"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmployeesTab } from "@/components/hr/employees-tab";
import { AttendanceTab } from "@/components/hr/attendance-tab";
import { SalaryTab } from "@/components/hr/salary-tab";
import { AdvancesTab } from "@/components/hr/advances-tab";
import { Users, CalendarDays, Banknote, HandCoins } from "lucide-react";
import { canAccessPayroll } from "@/lib/permissions";

/* ---------- shared types ---------- */

export interface EmployeeRow {
  id: string;
  organization_id: string;
  employee_id: string;
  name: string;
  mobile_number: string | null;
  date_of_joining: string;
  date_of_leaving: string | null;
  base_salary: string;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  casual_leaves_per_month: number;
  status: "active" | "inactive";
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRow {
  id: string;
  organization_id: string;
  employee_id: string;
  attendance_month: string;
  working_days: number;
  days_present: number;
  casual_leave: number;
  loss_of_pay: number;
  status: "draft" | "finalized";
  finalized_by: string | null;
  finalized_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  employees?: { employee_id: string; name: string } | null;
}

export interface AttendanceDayRow {
  id: string;
  organization_id: string;
  employee_id: string;
  attendance_date: string;
  status: "present" | "absent" | "casual_leave";
  created_at: string;
  updated_at: string;
}

export interface SalaryRow {
  id: string;
  organization_id: string;
  employee_id: string;
  salary_month: string;
  attendance_id: string | null;
  base_salary: string;
  working_days: number;
  days_present: number;
  casual_leave: number;
  loss_of_pay: number;
  earned_salary: string;
  lop_deduction: string;
  advance_emi_deduction: string;
  net_payable: string;
  payment_status: "pending" | "partial" | "paid";
  amount_paid: string;
  expense_entry_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  employees?: { employee_id: string; name: string } | null;
}

export interface AdvanceRow {
  id: string;
  organization_id: string;
  employee_id: string;
  advance_amount: string;
  repayment_months: number;
  emi_amount: string;
  start_month: string;
  outstanding_balance: string;
  status: "active" | "completed" | "cancelled";
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  employees?: { employee_id: string; name: string } | null;
}

export interface AdvanceScheduleRow {
  id: string;
  advance_id: string;
  emi_month: string;
  emi_amount: string;
  is_deducted: boolean;
  salary_id: string | null;
  created_at: string;
}

export interface OrganizationInfo {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

export interface InvoiceTemplateInfo {
  id?: string;
  company_name?: string;
  company_address?: string;
  company_phone?: string;
  company_email?: string;
  company_logo_url?: string | null;
  company_logo_file?: string | null;
}

/* ---------- props ---------- */

interface PayrollPageClientProps {
  initialTab: string;
  employees: EmployeeRow[];
  attendance: AttendanceRow[];
  attendanceDays: AttendanceDayRow[];
  salaries: SalaryRow[];
  advances: AdvanceRow[];
  advanceSchedules: AdvanceScheduleRow[];
  organization: OrganizationInfo | null;
  invoiceTemplate: InvoiceTemplateInfo | null;
  existingEmployeeIds: string[];
  userRole: string;
  organizationId: string;
}

const ALL_TABS = [
  { value: "employees", label: "Employees", icon: Users },
  { value: "attendance", label: "Attendance", icon: CalendarDays },
  { value: "salary", label: "Salary", icon: Banknote },
  { value: "advances", label: "Advances", icon: HandCoins },
] as const;

export function PayrollPageClient({
  initialTab,
  employees,
  attendance,
  attendanceDays,
  salaries,
  advances,
  advanceSchedules,
  organization,
  invoiceTemplate,
  existingEmployeeIds,
  userRole,
  organizationId,
}: PayrollPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fullPayrollAccess = canAccessPayroll(userRole);

  const visibleTabs = useMemo(
    () =>
      fullPayrollAccess
        ? ALL_TABS
        : ALL_TABS.filter((tab) => tab.value === "attendance"),
    [fullPayrollAccess],
  );

  const tabValues = useMemo(
    () => new Set(visibleTabs.map((tab) => tab.value)),
    [visibleTabs],
  );

  const resolveTab = (tab: string | null | undefined): string => {
    if (tab && tabValues.has(tab as (typeof ALL_TABS)[number]["value"])) {
      return tab;
    }
    return fullPayrollAccess ? "employees" : "attendance";
  };

  const [activeTab, setActiveTab] = useState(() => resolveTab(initialTab));

  const tabParam = searchParams.get("tab");
  useEffect(() => {
    const nextTab = resolveTab(tabParam ?? initialTab);
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam, initialTab, fullPayrollAccess]);

  const handleTabChange = (value: string) => {
    if (!tabValues.has(value as (typeof ALL_TABS)[number]["value"])) return;
    setActiveTab(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`/dashboard/expenses/payroll?${params.toString()}`, {
      scroll: false,
    });
  };

  const activeTabMeta =
    visibleTabs.find((tab) => tab.value === activeTab) || visibleTabs[0];

  const tabDescriptions: Record<string, string> = {
    employees: "Manage employee records and base salary",
    attendance: "Record daily attendance, casual leave, and loss of pay",
    salary: "Generate salary, mark payments, and print salary slips",
    advances: "Track salary advances and EMI repayment schedules",
  };

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {activeTabMeta.label}:{" "}
            <span className="font-semibold text-foreground">
              {tabDescriptions[activeTab] || "Payroll"}
            </span>
          </p>
        </div>
      </div>

      <Tabs
        id="payroll-tabs"
        value={activeTab}
        onValueChange={handleTabChange}
        className="space-y-6"
      >
        <TabsList className="flex w-full flex-wrap justify-start sm:w-auto h-auto">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {fullPayrollAccess && (
          <TabsContent value="employees" className="space-y-8 outline-none">
            <EmployeesTab
              employees={employees}
              salaries={salaries}
              existingEmployeeIds={existingEmployeeIds}
              userRole={userRole}
              organizationId={organizationId}
            />
          </TabsContent>
        )}

        <TabsContent value="attendance" className="space-y-8 outline-none">
          <AttendanceTab
            employees={employees}
            attendance={attendance}
            attendanceDays={attendanceDays}
            salaries={salaries}
            userRole={userRole}
            organizationId={organizationId}
          />
        </TabsContent>

        {fullPayrollAccess && (
          <TabsContent value="salary" className="space-y-8 outline-none">
            <SalaryTab
              employees={employees}
              attendance={attendance}
              salaries={salaries}
              advances={advances}
              advanceSchedules={advanceSchedules}
              organization={organization}
              invoiceTemplate={invoiceTemplate}
              userRole={userRole}
              organizationId={organizationId}
            />
          </TabsContent>
        )}

        {fullPayrollAccess && (
          <TabsContent value="advances" className="space-y-8 outline-none">
            <AdvancesTab
              employees={employees}
              advances={advances}
              advanceSchedules={advanceSchedules}
              userRole={userRole}
              organizationId={organizationId}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
