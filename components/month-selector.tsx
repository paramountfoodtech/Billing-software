"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/icon-tooltip";

interface MonthSelectorProps {
  currentYear: number;
  currentMonth: number; // 1-indexed
}

export function MonthSelector({ currentYear, currentMonth }: MonthSelectorProps) {
  const router = useRouter();

  const navigate = (year: number, month: number) => {
    router.push(`/dashboard/reports?year=${year}&month=${month}`);
  };

  const prevMonth = () => {
    if (currentMonth === 1) navigate(currentYear - 1, 12);
    else navigate(currentYear, currentMonth - 1);
  };

  const nextMonth = () => {
    const today = new Date();
    const isCurrent =
      currentYear === today.getFullYear() &&
      currentMonth === today.getMonth() + 1;
    if (isCurrent) return;
    if (currentMonth === 12) navigate(currentYear + 1, 1);
    else navigate(currentYear, currentMonth + 1);
  };

  const today = new Date();
  const isCurrentMonth =
    currentYear === today.getFullYear() &&
    currentMonth === today.getMonth() + 1;

  const monthName = new Date(currentYear, currentMonth - 1, 1).toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric" },
  );

  return (
    <div className="flex items-center gap-2">
      <IconTooltip label="Previous month">
        <Button
          variant="outline"
          size="sm"
          onClick={prevMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </IconTooltip>
      <span className="text-sm font-medium min-w-[130px] text-center">
        {monthName}
      </span>
      <IconTooltip label="Next month">
        <Button
          variant="outline"
          size="sm"
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </IconTooltip>
    </div>
  );
}
