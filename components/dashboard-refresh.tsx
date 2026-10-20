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
    <div className="bi-chip">
      <span className="bi-live-dot" aria-hidden />
      {lastUpdated ? (
        <span>
          Updated <strong>{formatIndianTime(lastUpdated)}</strong>
        </span>
      ) : (
        <span>Live</span>
      )}
      <IconTooltip label="Refresh data">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleManualRefresh}
          className="-mr-1.5 h-6 w-6 rounded-full p-0"
        >
          <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
        </Button>
      </IconTooltip>
    </div>
  );
}
