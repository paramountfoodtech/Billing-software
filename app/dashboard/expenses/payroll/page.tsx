import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/supabase/fetch-all";
import { redirect } from "next/navigation";
import { canAccessAttendance, canAccessPayroll } from "@/lib/permissions";
import { DashboardPageWrapper } from "@/components/dashboard-page-wrapper";
import { PayrollPageClient } from "./payroll-page-client";
import { getIndianCurrentMonth } from "@/lib/date-time";

export const revalidate = 0;

const PAYROLL_TABS = new Set([
  "employees",
  "attendance",
  "salary",
  "advances",
]);

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id || !canAccessAttendance(profile.role)) {
    redirect("/dashboard");
  }

  const organizationId = profile.organization_id;
  const fullPayroll = canAccessPayroll(profile.role);
  const params = await searchParams;

  let initialTab =
    params.tab && PAYROLL_TABS.has(params.tab) ? params.tab : "employees";
  if (!fullPayroll) {
    initialTab = "attendance";
  }

  const currentMonth = getIndianCurrentMonth();
  const [cy, cm] = currentMonth.split("-").map(Number);
  const monthStart = `${currentMonth}-01`;
  const monthEndDate = new Date(cy, cm, 0).getDate();
  const monthEnd = `${currentMonth}-${String(monthEndDate).padStart(2, "0")}`;

  const [
    employees,
    attendance,
    attendanceDays,
    salaries,
    advances,
    orgResult,
    templateResult,
  ] = await Promise.all([
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .range(from, to);
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("hr_attendance")
        .select("*, employees(employee_id, name)")
        .eq("organization_id", organizationId)
        .order("attendance_month", { ascending: false })
        .range(from, to);
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("hr_attendance_days")
        .select("*")
        .eq("organization_id", organizationId)
        .gte("attendance_date", monthStart)
        .lte("attendance_date", monthEnd)
        .order("attendance_date", { ascending: true })
        .range(from, to);
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("hr_salary")
        .select("*, employees(employee_id, name)")
        .eq("organization_id", organizationId)
        .order("salary_month", { ascending: false })
        .range(from, to);
      return { data, error };
    }),
    fetchAllPages(async (from, to) => {
      const { data, error } = await supabase
        .from("hr_salary_advances")
        .select("*, employees(employee_id, name)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .range(from, to);
      return { data, error };
    }),
    supabase
      .from("organizations")
      .select("id, name, address, phone, email")
      .eq("id", organizationId)
      .single(),
    supabase
      .from("invoice_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ]);

  if (orgResult.error) {
    throw new Error(orgResult.error.message);
  }
  if (templateResult.error) {
    throw new Error(templateResult.error.message);
  }

  const advanceIds = advances.map((advance) => advance.id);
  const advanceSchedules =
    advanceIds.length === 0
      ? []
      : await fetchAllPages(async (from, to) => {
          const { data, error } = await supabase
            .from("hr_advance_schedule")
            .select("*")
            .in("advance_id", advanceIds)
            .order("emi_month", { ascending: true })
            .range(from, to);
          return { data, error };
        });

  return (
    <DashboardPageWrapper title="Payroll">
      <PayrollPageClient
        initialTab={initialTab}
        employees={employees}
        attendance={attendance}
        attendanceDays={attendanceDays}
        salaries={salaries}
        advances={advances}
        advanceSchedules={advanceSchedules}
        organization={orgResult.data}
        invoiceTemplate={templateResult.data}
        existingEmployeeIds={employees.map((e) => e.employee_id)}
        userRole={profile.role}
        organizationId={organizationId}
      />
    </DashboardPageWrapper>
  );
}
