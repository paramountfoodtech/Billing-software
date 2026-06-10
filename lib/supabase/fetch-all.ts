/** PostgREST/Supabase default max rows per request */
export const SUPABASE_PAGE_SIZE = 1000;

type PageResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

/**
 * Fetch all rows from a Supabase query, paginating past the 1000-row API limit.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
  pageSize = SUPABASE_PAGE_SIZE,
): Promise<T[]> {
  const results: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }

    const batch = data ?? [];
    results.push(...batch);

    if (batch.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return results;
}
