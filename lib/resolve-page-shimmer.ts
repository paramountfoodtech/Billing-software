export type PageShimmerVariant =
  | "home"
  | "reports"
  | "form"
  | "categories"
  | "kpi-section"
  | "table"
  | "table-filtered";

export type PageShimmerScope = "page" | "content";

export type PageShimmerConfig = {
  variant: PageShimmerVariant;
  columns: number;
  rows: number;
  exportButtons: number;
  showFilterRow: boolean;
  actionButtons: number;
};

const TABLE_FILTERED: Omit<PageShimmerConfig, "variant"> = {
  columns: 8,
  rows: 8,
  exportButtons: 3,
  showFilterRow: true,
  actionButtons: 1,
};

const TABLE_STANDARD: Omit<PageShimmerConfig, "variant"> = {
  columns: 7,
  rows: 8,
  exportButtons: 1,
  showFilterRow: true,
  actionButtons: 1,
};

const PRESETS: Record<PageShimmerVariant, Omit<PageShimmerConfig, "variant">> = {
  home: {
    columns: 6,
    rows: 6,
    exportButtons: 0,
    showFilterRow: false,
    actionButtons: 0,
  },
  reports: {
    columns: 6,
    rows: 10,
    exportButtons: 3,
    showFilterRow: false,
    actionButtons: 0,
  },
  form: {
    columns: 2,
    rows: 0,
    exportButtons: 0,
    showFilterRow: false,
    actionButtons: 0,
  },
  categories: {
    columns: 3,
    rows: 6,
    exportButtons: 0,
    showFilterRow: false,
    actionButtons: 0,
  },
  "kpi-section": {
    columns: 5,
    rows: 0,
    exportButtons: 0,
    showFilterRow: false,
    actionButtons: 0,
  },
  table: TABLE_STANDARD,
  "table-filtered": TABLE_FILTERED,
};

const PATH_OVERRIDES: Record<string, Partial<PageShimmerConfig>> = {
  "/dashboard/clients": { columns: 6 },
  "/dashboard/products": { columns: 5 },
  "/dashboard/users": { columns: 5 },
  "/dashboard/purchasers": { columns: 6 },
  "/dashboard/challans": { columns: 8, exportButtons: 2 },
  "/dashboard/purchase-invoices": { columns: 11, exportButtons: 2 },
  "/dashboard/purchase-payments": { columns: 7 },
  "/dashboard/payments": { columns: 8, exportButtons: 2 },
  "/dashboard/invoices": { columns: 9, exportButtons: 2 },
  "/dashboard/expenses": { columns: 7, exportButtons: 2, actionButtons: 3 },
  "/dashboard/operations/processing": { columns: 8, exportButtons: 1 },
  "/dashboard/operations/stock": { columns: 7, exportButtons: 1 },
  "/dashboard/prices": { columns: 6, actionButtons: 2 },
  "/dashboard/client-pricing": { columns: 6 },
};

function resolveVariant(pathname: string): PageShimmerVariant {
  if (pathname === "/dashboard") return "home";

  if (
    pathname === "/dashboard/reports" ||
    pathname === "/dashboard/purchase-reports" ||
    pathname === "/dashboard/expenses/reports" ||
    pathname === "/dashboard/operations/reports"
  ) {
    return "reports";
  }

  if (pathname === "/dashboard/prices/categories") {
    return "categories";
  }

  if (
    pathname.includes("/new") ||
    pathname.includes("/edit") ||
    pathname.endsWith("/settings") ||
    pathname.endsWith("/notifications")
  ) {
    return "form";
  }

  if (
    pathname === "/dashboard/invoices" ||
    pathname === "/dashboard/payments" ||
    pathname === "/dashboard/purchase-invoices" ||
    pathname === "/dashboard/purchase-payments" ||
    pathname === "/dashboard/expenses" ||
    pathname === "/dashboard/operations/processing" ||
    pathname === "/dashboard/operations/stock"
  ) {
    return "table-filtered";
  }

  return "table";
}

function getPathOverrides(pathname: string): Partial<PageShimmerConfig> {
  if (PATH_OVERRIDES[pathname]) {
    return PATH_OVERRIDES[pathname];
  }

  const matched = Object.entries(PATH_OVERRIDES).find(([path]) =>
    pathname.startsWith(`${path}/`),
  );
  return matched?.[1] ?? {};
}

export function resolvePageShimmerConfig(
  pathname: string,
  overrides?: Partial<PageShimmerConfig>,
): PageShimmerConfig {
  const variant = overrides?.variant ?? resolveVariant(pathname);
  const preset = PRESETS[variant];
  const pathOverrides = getPathOverrides(pathname);

  return {
    variant,
    columns:
      overrides?.columns ?? pathOverrides.columns ?? preset.columns,
    rows: overrides?.rows ?? pathOverrides.rows ?? preset.rows,
    exportButtons:
      overrides?.exportButtons ??
      pathOverrides.exportButtons ??
      preset.exportButtons,
    showFilterRow:
      overrides?.showFilterRow ??
      pathOverrides.showFilterRow ??
      preset.showFilterRow,
    actionButtons:
      overrides?.actionButtons ??
      pathOverrides.actionButtons ??
      preset.actionButtons,
  };
}
