import type { DayAttendanceMark } from "@/lib/hr-calculations";

export type DayMap = Record<string, DayAttendanceMark>; // date -> status

export type AttendanceEdit = {
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

export const STATUS_LABEL: Record<DayAttendanceMark, string> = {
  empty: "",
  present: "P",
  half_day: "HL",
  absent: "A",
  casual_leave: "CL",
};

export const STATUS_NAME: Record<DayAttendanceMark, string> = {
  empty: "Unmarked",
  present: "Present",
  half_day: "Half Day",
  absent: "Absent",
  casual_leave: "Casual Leave",
};

/** Status colors when the day is editable. */
export const STATUS_CLASS_EDITABLE: Record<DayAttendanceMark, string> = {
  empty:
    "bg-white text-slate-500 border-2 border-blue-400 hover:bg-blue-50 hover:border-blue-600 shadow-sm",
  present:
    "bg-green-500 text-white border-2 border-green-600 hover:bg-green-600 shadow-sm",
  half_day:
    "bg-purple-500 text-white border-2 border-purple-600 hover:bg-purple-600 shadow-sm",
  absent:
    "bg-red-500 text-white border-2 border-red-600 hover:bg-red-600 shadow-sm",
  casual_leave:
    "bg-amber-500 text-white border-2 border-amber-600 hover:bg-amber-600 shadow-sm",
};

/** Status colors when the day is locked / not editable. */
export const STATUS_CLASS_LOCKED: Record<DayAttendanceMark, string> = {
  empty: "bg-slate-100 text-slate-300 border border-slate-200",
  present: "bg-green-100/70 text-green-700/50 border border-green-200/60",
  half_day: "bg-purple-100/70 text-purple-700/50 border border-purple-200/60",
  absent: "bg-red-100/70 text-red-700/50 border border-red-200/60",
  casual_leave: "bg-amber-100/70 text-amber-700/50 border border-amber-200/60",
};
