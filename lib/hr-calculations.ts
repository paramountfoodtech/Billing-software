/**
 * HR salary & attendance calculation utilities.
 * Pure functions — no side effects, no DB calls.
 */

export type DayAttendanceStatus = "present" | "absent" | "casual_leave";

/** Day mark including unmarked (empty) cells. */
export type DayAttendanceMark = DayAttendanceStatus | "empty";

export type LopResult = {
  /** Actual casual leave used (capped at entitlement) */
  actualCasualLeave: number;
  /** Loss of pay days */
  lop: number;
};

/**
 * Calculate casual leave and LOP from attendance figures.
 */
export function calculateLOP(
  workingDays: number,
  daysPresent: number,
  clRequested: number,
  maxCL: number,
): LopResult {
  const absentDays = Math.max(0, workingDays - daysPresent);
  const actualCasualLeave = Math.min(clRequested, maxCL, absentDays);
  const lop = Math.max(0, absentDays - actualCasualLeave);
  return { actualCasualLeave, lop };
}

/**
 * Auto-calculate casual leave and LOP when days present or working days change.
 */
export function autoCalculateLeaveAndLOP(
  workingDays: number,
  daysPresent: number,
  maxCL: number,
): { casualLeave: number; lop: number } {
  const absentDays = Math.max(0, workingDays - daysPresent);
  const casualLeave = Math.min(absentDays, maxCL);
  const lop = Math.max(0, absentDays - casualLeave);
  return { casualLeave, lop };
}

/**
 * Employee-level casual leave entitlement (null/undefined → 0).
 */
export function getEmployeeCasualLeaveLimit(
  employeeCL: number | null | undefined,
): number {
  return Math.max(0, Math.floor(Number(employeeCL ?? 0)));
}

/** @deprecated Use getEmployeeCasualLeaveLimit — org defaults removed. */
export function getEffectiveCasualLeaves(
  employeeOverride: number | null | undefined,
  _orgDefault?: number,
): number {
  return getEmployeeCasualLeaveLimit(employeeOverride);
}

/**
 * Roll up daily attendance statuses into monthly totals.
 * Empty/unmarked days are ignored. Excess CL beyond maxCL is treated as LOP.
 */
export function rollupDailyAttendance(
  statuses: DayAttendanceMark[],
  maxCL: number,
): {
  workingDays: number;
  daysPresent: number;
  casualLeave: number;
  lop: number;
} {
  let daysPresent = 0;
  let casualLeaveRaw = 0;
  let absent = 0;

  for (const status of statuses) {
    if (status === "empty" || !status) continue;
    if (status === "present") daysPresent += 1;
    else if (status === "casual_leave") casualLeaveRaw += 1;
    else if (status === "absent") absent += 1;
  }

  const casualLeave = Math.min(casualLeaveRaw, Math.max(0, maxCL));
  const excessCL = casualLeaveRaw - casualLeave;
  const lop = absent + excessCL;
  const workingDays = daysPresent + casualLeave + lop;

  return { workingDays, daysPresent, casualLeave, lop };
}

/** Number of calendar days in YYYY-MM. */
export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

/** Build default empty marks for every day in a month. */
export function defaultMonthDayStatuses(
  monthKey: string,
): { date: string; status: DayAttendanceMark }[] {
  const n = daysInMonth(monthKey);
  const [y, m] = monthKey.split("-").map(Number);
  const rows: { date: string; status: DayAttendanceMark }[] = [];
  for (let d = 1; d <= n; d++) {
    rows.push({
      date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      status: "empty",
    });
  }
  return rows;
}

export type SalaryResult = {
  earnedSalary: number;
  lopDeduction: number;
  advanceEmiDeduction: number;
  netPayable: number;
};

/**
 * Calculate monthly salary breakdown.
 */
export function calculateSalary(
  baseSalary: number,
  workingDays: number,
  daysPresent: number,
  casualLeave: number,
  lop: number,
  advanceEmi: number,
): SalaryResult {
  if (workingDays <= 0) {
    return { earnedSalary: 0, lopDeduction: 0, advanceEmiDeduction: 0, netPayable: 0 };
  }

  const clampedPresent = Math.min(Math.max(0, daysPresent), workingDays);
  const paidDays = clampedPresent + casualLeave;
  const perDaySalary = baseSalary / workingDays;
  const earnedSalary = Math.round(perDaySalary * paidDays * 100) / 100;
  const lopDeduction = Math.round(perDaySalary * lop * 100) / 100;
  const advanceEmiDeduction = Math.max(0, advanceEmi);
  const netPayable = Math.max(0, Math.round((earnedSalary - advanceEmiDeduction) * 100) / 100);

  return { earnedSalary, lopDeduction, advanceEmiDeduction, netPayable };
}

export type AdvanceScheduleItem = {
  emiMonth: string; // YYYY-MM
  emiAmount: number;
};

/**
 * Generate EMI repayment schedule for a salary advance.
 */
export function generateAdvanceSchedule(
  advanceAmount: number,
  repaymentMonths: number,
  startMonth: string,
): AdvanceScheduleItem[] {
  if (repaymentMonths <= 0 || advanceAmount <= 0) return [];

  const baseEmi = Math.floor((advanceAmount / repaymentMonths) * 100) / 100;
  const schedule: AdvanceScheduleItem[] = [];
  let remaining = advanceAmount;

  const [startYear, startMonthNum] = startMonth.split("-").map(Number);

  for (let i = 0; i < repaymentMonths; i++) {
    const monthOffset = startMonthNum - 1 + i;
    const year = startYear + Math.floor(monthOffset / 12);
    const month = (monthOffset % 12) + 1;
    const emiMonth = `${year}-${String(month).padStart(2, "0")}`;

    const isLast = i === repaymentMonths - 1;
    const emiAmount = isLast
      ? Math.round(remaining * 100) / 100
      : Math.min(baseEmi, remaining);

    schedule.push({ emiMonth, emiAmount });
    remaining = Math.round((remaining - emiAmount) * 100) / 100;
  }

  return schedule;
}

/**
 * Increment a YYYY-MM month string by N months.
 */
export function addMonths(monthKey: string, count: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const totalMonths = y * 12 + (m - 1) + count;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

export type ScheduleRebuildResult = {
  currentMonthEmi: number;
  futureSchedule: AdvanceScheduleItem[];
  /** EMI amount to store on the advance for future months (base). */
  baseEmiAmount: number;
  totalRepaymentMonths: number;
};

/**
 * After altering this month's EMI, extend tenure by appending `extraMonths`
 * to the existing future schedule length, then distribute remaining balance
 * evenly across (existingFutureMonthCount + extraMonths) months.
 */
export function rebuildScheduleExtendTenure(params: {
  outstandingBeforeCurrent: number;
  newCurrentEmi: number;
  currentMonth: string;
  existingFutureMonthCount: number;
  extraMonths: number;
  alreadyDeductedMonths: number;
}): ScheduleRebuildResult {
  const newCurrentEmi = Math.max(
    0,
    Math.round(params.newCurrentEmi * 100) / 100,
  );
  const remaining = Math.max(
    0,
    Math.round((params.outstandingBeforeCurrent - newCurrentEmi) * 100) / 100,
  );

  const extraMonths = Math.max(0, Math.floor(params.extraMonths));
  const existingFuture = Math.max(0, Math.floor(params.existingFutureMonthCount));
  const totalFutureMonths = Math.max(1, existingFuture + extraMonths);

  if (remaining <= 0.009) {
    return {
      currentMonthEmi: newCurrentEmi,
      futureSchedule: [],
      baseEmiAmount: newCurrentEmi,
      totalRepaymentMonths: params.alreadyDeductedMonths + 1,
    };
  }

  const baseEmi = Math.floor((remaining / totalFutureMonths) * 100) / 100;
  const futureSchedule: AdvanceScheduleItem[] = [];
  let left = remaining;

  for (let i = 0; i < totalFutureMonths; i++) {
    const isLast = i === totalFutureMonths - 1;
    const emiAmount = isLast
      ? Math.round(left * 100) / 100
      : Math.min(baseEmi, left);
    futureSchedule.push({
      emiMonth: addMonths(params.currentMonth, i + 1),
      emiAmount,
    });
    left = Math.round((left - emiAmount) * 100) / 100;
  }

  return {
    currentMonthEmi: newCurrentEmi,
    futureSchedule,
    baseEmiAmount: baseEmi,
    totalRepaymentMonths:
      params.alreadyDeductedMonths + 1 + futureSchedule.length,
  };
}

/**
 * After altering this month's EMI, redistribute leftover outstanding evenly
 * across the existing count of future undeducted months (or 1 if none).
 */
export function rebuildScheduleRedistribute(params: {
  outstandingBeforeCurrent: number;
  newCurrentEmi: number;
  currentMonth: string;
  futureMonthCount: number;
  alreadyDeductedMonths: number;
}): ScheduleRebuildResult {
  const newCurrentEmi = Math.max(
    0,
    Math.round(params.newCurrentEmi * 100) / 100,
  );
  const remaining = Math.max(
    0,
    Math.round((params.outstandingBeforeCurrent - newCurrentEmi) * 100) / 100,
  );

  if (remaining <= 0.009) {
    return {
      currentMonthEmi: newCurrentEmi,
      futureSchedule: [],
      baseEmiAmount: newCurrentEmi,
      totalRepaymentMonths: params.alreadyDeductedMonths + 1,
    };
  }

  const monthCount = Math.max(1, params.futureMonthCount);
  const baseEmi = Math.floor((remaining / monthCount) * 100) / 100;
  const futureSchedule: AdvanceScheduleItem[] = [];
  let left = remaining;

  for (let i = 0; i < monthCount; i++) {
    const isLast = i === monthCount - 1;
    const emiAmount = isLast
      ? Math.round(left * 100) / 100
      : Math.min(baseEmi, left);
    futureSchedule.push({
      emiMonth: addMonths(params.currentMonth, i + 1),
      emiAmount,
    });
    left = Math.round((left - emiAmount) * 100) / 100;
  }

  return {
    currentMonthEmi: newCurrentEmi,
    futureSchedule,
    baseEmiAmount: baseEmi,
    totalRepaymentMonths:
      params.alreadyDeductedMonths + 1 + futureSchedule.length,
  };
}
