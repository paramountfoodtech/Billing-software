"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PageShimmer } from "@/components/page-shimmers";
import {
  resolvePageShimmerConfig,
  type PageShimmerConfig,
  type PageShimmerScope,
  type PageShimmerVariant,
} from "@/lib/resolve-page-shimmer";

const DEFAULT_DELAY_MS = 300;

type PageLoadingFallbackProps = {
  delayMs?: number;
  scope?: PageShimmerScope;
  variant?: PageShimmerVariant;
  rows?: number;
  columns?: number;
  className?: string;
};

export function PageLoadingFallback({
  delayMs = DEFAULT_DELAY_MS,
  scope = "page",
  variant,
  rows,
  columns,
  className,
}: PageLoadingFallbackProps) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, pathname]);

  if (!visible) {
    return null;
  }

  const config: PageShimmerConfig = resolvePageShimmerConfig(pathname, {
    variant,
    rows,
    columns,
  });

  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <PageShimmer config={config} scope={scope} />
    </div>
  );
}
