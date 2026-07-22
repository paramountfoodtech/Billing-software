import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ShimmerBox } from "@/components/shimmer-primitives";

interface TableShimmerProps {
  rows?: number;
  columns?: number;
  columnWidths?: (string | number)[];
  showFilterRow?: boolean;
}

/** @deprecated Prefer PageLoadingFallback / DataTableShimmer for route-aware layouts. */
export function TableShimmer({
  rows = 8,
  columns = 6,
  columnWidths,
  showFilterRow = true,
}: TableShimmerProps) {
  const getColumnWidth = (index: number) => {
    if (!columnWidths || index >= columnWidths.length) return undefined;
    const width = columnWidths[index];
    return typeof width === "number" ? `${width}px` : width;
  };

  const widthPattern = ["w-full", "w-5/6", "w-3/4"];

  return (
    <div
      className="rounded-lg border bg-white overflow-hidden"
      role="status"
      aria-busy="true"
      aria-label="Loading table data"
    >
      <Table className="text-xs sm:text-sm">
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead
                key={`header-${i}`}
                className="px-2 sm:px-4 py-2 sm:py-3"
                style={{ width: getColumnWidth(i) }}
              >
                <ShimmerBox className="h-4 w-3/5" />
              </TableHead>
            ))}
          </TableRow>
          {showFilterRow && (
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={`filter-${i}`} className="px-2 sm:px-4 py-2 sm:py-3">
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
                const patternIndex = (rowIndex + colIndex) % widthPattern.length;
                const widthClass =
                  colIndex === columns - 1
                    ? "w-16"
                    : widthPattern[patternIndex];

                return (
                  <TableCell
                    key={`cell-${rowIndex}-${colIndex}`}
                    className="px-2 sm:px-4 py-2 sm:py-3"
                    style={{ width: getColumnWidth(colIndex) }}
                  >
                    <ShimmerBox className={`h-4 ${widthClass}`} />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function TableRowShimmer({
  columns = 6,
  columnWidths,
}: Omit<TableShimmerProps, "rows">) {
  const getColumnWidth = (index: number) => {
    if (!columnWidths || index >= columnWidths.length) return undefined;
    const width = columnWidths[index];
    return typeof width === "number" ? `${width}px` : width;
  };

  const widthPattern = ["w-full", "w-5/6", "w-3/4"];

  return (
    <TableRow className="hover:bg-transparent">
      {Array.from({ length: columns }).map((_, colIndex) => {
        const patternIndex = colIndex % widthPattern.length;
        const widthClass =
          colIndex === columns - 1 ? "w-16" : widthPattern[patternIndex];

        return (
          <TableCell
            key={`cell-${colIndex}`}
            className="px-2 sm:px-4 py-2 sm:py-3"
            style={{ width: getColumnWidth(colIndex) }}
          >
            <ShimmerBox className={`h-4 ${widthClass}`} />
          </TableCell>
        );
      })}
    </TableRow>
  );
}
