import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShimmerBox,
  ShimmerButton,
  ShimmerCard,
  ShimmerField,
} from "@/components/shimmer-primitives";
import type { PageShimmerConfig, PageShimmerScope } from "@/lib/resolve-page-shimmer";

const cellClass = "px-2 sm:px-4 py-2 sm:py-3";
const headClass = `${cellClass} cursor-default`;
const widthPattern = ["w-full", "w-5/6", "w-3/4", "w-2/3"];

function ToolbarActionsShimmer({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <div className="flex gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerButton key={i} size="icon" />
      ))}
    </div>
  );
}

function FilterToolbarShimmer() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ShimmerBox className="h-4 w-6" />
      <ShimmerBox className="h-9 w-28 rounded-md" />
      <ShimmerBox className="h-4 w-12" />
      <ShimmerBox className="h-9 w-36 rounded-md" />
      <ShimmerBox className="h-4 w-10" />
      <ShimmerBox className="h-9 w-36 rounded-md" />
      <ShimmerBox className="h-4 w-6" />
      <ShimmerBox className="h-9 w-36 rounded-md" />
    </div>
  );
}

function TableToolbarShimmer({
  exportButtons,
  filtered,
}: {
  exportButtons: number;
  filtered?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {filtered ? <FilterToolbarShimmer /> : <div />}
        <ToolbarActionsShimmer count={exportButtons} />
      </div>
    </div>
  );
}

function TablePaginationShimmer() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-4">
      <ShimmerBox className="h-4 w-40" />
      <div className="flex items-center gap-2">
        <ShimmerBox className="h-8 w-8 rounded-md" />
        <ShimmerBox className="h-8 w-8 rounded-md" />
        <ShimmerBox className="h-8 w-8 rounded-md" />
        <ShimmerBox className="h-8 w-8 rounded-md" />
      </div>
    </div>
  );
}

export function DataTableShimmer({
  columns,
  rows,
  showFilterRow = true,
  exportButtons = 1,
  filtered = false,
  showToolbar = true,
  showPagination = true,
}: {
  columns: number;
  rows: number;
  showFilterRow?: boolean;
  exportButtons?: number;
  filtered?: boolean;
  showToolbar?: boolean;
  showPagination?: boolean;
}) {
  return (
    <>
      {showToolbar && (
        <TableToolbarShimmer exportButtons={exportButtons} filtered={filtered} />
      )}
      <div className="rounded-lg border bg-white overflow-x-auto">
        <Table className="text-xs sm:text-sm">
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={`head-${i}`} className={headClass}>
                  <ShimmerBox
                    className={`h-4 ${i === columns - 1 ? "w-12" : "w-3/5"}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                  />
                </TableHead>
              ))}
            </TableRow>
            {showFilterRow && (
              <TableRow>
                {Array.from({ length: columns }).map((_, i) => (
                  <TableHead key={`filter-${i}`} className={cellClass}>
                    {i < columns - 1 ? (
                      <ShimmerBox className="h-7 w-full max-w-[140px] rounded-md" />
                    ) : null}
                  </TableHead>
                ))}
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <TableRow key={`row-${rowIndex}`} className="hover:bg-transparent">
                {Array.from({ length: columns }).map((_, colIndex) => {
                  const widthClass =
                    colIndex === columns - 1
                      ? "w-16"
                      : widthPattern[(rowIndex + colIndex) % widthPattern.length];

                  return (
                    <TableCell key={`cell-${rowIndex}-${colIndex}`} className={cellClass}>
                      <ShimmerBox
                        className={`h-4 ${widthClass}`}
                        style={{
                          animationDelay: `${(rowIndex * columns + colIndex) * 40}ms`,
                        }}
                      />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {showPagination && <TablePaginationShimmer />}
    </>
  );
}

function PageActionsShimmer({ count = 1 }: { count?: number }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerButton key={i} className="w-full sm:w-36" />
      ))}
    </div>
  );
}

function KpiCardShimmer() {
  return (
    <ShimmerCard className="p-0">
      <div className="flex flex-row items-center justify-between p-6 pb-2">
        <ShimmerBox className="h-4 w-24" />
        <ShimmerBox className="h-4 w-4 rounded-full" />
      </div>
      <div className="p-6 pt-0 space-y-2">
        <ShimmerBox className="h-7 w-32" />
        <ShimmerBox className="h-3 w-40" />
      </div>
    </ShimmerCard>
  );
}

function DashboardHomeShimmer() {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <ShimmerBox className="h-4 w-44" />
        <ShimmerBox className="h-7 w-28 rounded-md" />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <KpiCardShimmer key={`fy-${i}`} />
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <ShimmerBox className="h-5 w-48" />
        <div className="flex gap-2">
          <ShimmerBox className="h-8 w-24 rounded-md" />
          <ShimmerBox className="h-8 w-24 rounded-md" />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <KpiCardShimmer key={`month-${i}`} />
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <KpiCardShimmer key={`stat-${i}`} />
        ))}
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mb-8">
        <ShimmerCard className="h-64 p-4 space-y-3">
          <ShimmerBox className="h-4 w-32" />
          <ShimmerBox className="h-full min-h-[180px] w-full rounded-md" />
        </ShimmerCard>
        <ShimmerCard className="h-64 p-4 space-y-3">
          <ShimmerBox className="h-4 w-32" />
          <ShimmerBox className="h-full min-h-[180px] w-full rounded-md" />
        </ShimmerCard>
      </div>

      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <ShimmerBox key={i} className="h-9 w-28 rounded-md" />
          ))}
        </div>
        <DataTableShimmer
          columns={6}
          rows={6}
          showFilterRow={false}
          exportButtons={0}
          showToolbar={false}
        />
      </div>
    </>
  );
}

function ReportsPageShimmer({ columns, rows }: { columns: number; rows: number }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <ShimmerBox key={i} className="h-9 w-32 rounded-md" />
        ))}
      </div>
      <ShimmerCard className="p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ShimmerField />
          <ShimmerField />
          <ShimmerField />
          <ShimmerField />
        </div>
      </ShimmerCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ShimmerBox className="h-5 w-56" />
        <ToolbarActionsShimmer count={3} />
      </div>
      <DataTableShimmer
        columns={columns}
        rows={rows}
        showFilterRow={false}
        exportButtons={0}
        showToolbar={false}
      />
    </div>
  );
}

function FormPageShimmer() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <ShimmerBox className="h-8 w-56" />
        <ShimmerBox className="h-4 w-80 max-w-full" />
      </div>
      <ShimmerCard className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <ShimmerField />
          <ShimmerField />
          <ShimmerField />
          <ShimmerField />
          <ShimmerField className="sm:col-span-2" />
        </div>
        <div className="border-t pt-4 space-y-4">
          <ShimmerBox className="h-4 w-20" />
          <div className="grid gap-4 sm:grid-cols-2">
            <ShimmerField />
            <ShimmerField />
          </div>
        </div>
        <div className="rounded-lg border bg-blue-50/60 p-4 space-y-2">
          <ShimmerBox className="h-4 w-full" />
          <ShimmerBox className="h-4 w-2/3" />
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <ShimmerButton />
          <ShimmerButton />
        </div>
      </ShimmerCard>
    </div>
  );
}

function CategoriesContentShimmer({ cardCount = 6 }: { cardCount?: number }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <ShimmerButton className="w-40" />
        <ShimmerButton className="w-36" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cardCount }).map((_, i) => (
          <ShimmerCard key={i} className="p-6 space-y-3">
            <ShimmerBox className="h-6 w-32" />
            <ShimmerBox className="h-4 w-full" />
            <ShimmerBox className="h-6 w-24" />
            <div className="flex gap-2 pt-2">
              <ShimmerButton size="sm" />
              <ShimmerButton size="sm" />
            </div>
          </ShimmerCard>
        ))}
      </div>
    </div>
  );
}

function CategoriesPageShimmer({ rows }: { rows: number }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <ShimmerBox className="h-8 w-52" />
        <ShimmerBox className="h-4 w-full max-w-xl" />
      </div>
      <CategoriesContentShimmer cardCount={rows} />
    </div>
  );
}

function KpiSectionShimmer() {
  return (
    <div className="mt-8 space-y-6">
      <ShimmerBox className="h-6 w-44" />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <KpiCardShimmer key={i} />
        ))}
      </div>
      <ShimmerBox className="h-6 w-40" />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KpiCardShimmer key={`monthly-${i}`} />
        ))}
      </div>
    </div>
  );
}

export function PageShimmer({
  config,
  scope,
}: {
  config: PageShimmerConfig;
  scope: PageShimmerScope;
}) {
  const pageShell = scope === "page";
  const isFiltered = config.variant === "table-filtered";

  const content = (() => {
    switch (config.variant) {
      case "home":
        return <DashboardHomeShimmer />;
      case "reports":
        return (
          <ReportsPageShimmer columns={config.columns} rows={config.rows} />
        );
      case "form":
        return <FormPageShimmer />;
      case "categories":
        return scope === "content" ? (
          <CategoriesContentShimmer cardCount={config.rows} />
        ) : (
          <CategoriesPageShimmer rows={config.rows} />
        );
      case "kpi-section":
        return <KpiSectionShimmer />;
      default:
        return (
          <DataTableShimmer
            columns={config.columns}
            rows={config.rows}
            showFilterRow={config.showFilterRow}
            exportButtons={config.exportButtons}
            filtered={isFiltered}
          />
        );
    }
  })();

  if (!pageShell) {
    return <div className="space-y-4">{content}</div>;
  }

  if (config.variant === "home") {
    return <div className="w-full p-4 sm:p-6 lg:p-8">{content}</div>;
  }

  if (config.variant === "form") {
    return <div className="w-full p-4 sm:p-6 lg:p-8">{content}</div>;
  }

  if (config.variant === "categories") {
    return <div className="p-6 lg:p-8">{content}</div>;
  }

  if (config.variant === "reports") {
    return (
      <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">{content}</div>
    );
  }

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-4">
      {config.actionButtons > 0 && (
        <PageActionsShimmer count={config.actionButtons} />
      )}
      {content}
    </div>
  );
}
