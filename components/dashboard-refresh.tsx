"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/icon-tooltip";
import { formatIndianTime } from "@/lib/date-time";

export function DashboardRefresh() {
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    setLastUpdated(new Date());
    const interval = setInterval(() => {
      router.refresh();
      setLastUpdated(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, [router]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setLastUpdated(new Date());
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {lastUpdated && (
        <span>Updated {formatIndianTime(lastUpdated)}</span>
      )}
      <IconTooltip label="Refresh data">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualRefresh}
          className="h-7 w-7 p-0"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </IconTooltip>
    </div>
  );
}
