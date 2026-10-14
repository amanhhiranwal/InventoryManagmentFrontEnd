/** The page numbers to draw for a list of `totalPages`, around `current`.
 *
 * A gap is a "…" entry. The first and last page are always there, so the
 * end of a list is one click away and the number of pages is readable at
 * a glance - a row that stops at 3 and then says "…" leaves somebody on
 * page 3 of 4 with no way to see that 4 exists.
 *
 * Up to seven entries, which is what fits beside the arrows:
 *   1 2 3 4 5 … 12      (near the start)
 *   1 … 5 6 7 … 12      (in the middle)
 *   1 … 8 9 10 11 12    (near the end)
 */
export type PageEntry = number | "gap";

export function pageWindow(current: number, totalPages: number): PageEntry[] {
  const total = Math.max(1, Math.floor(totalPages) || 1);
  const page = Math.min(Math.max(1, Math.floor(current) || 1), total);

  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  if (page <= 4) {
    return [1, 2, 3, 4, 5, "gap", total];
  }

  if (page >= total - 3) {
    return [1, "gap", total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, "gap", page - 1, page, page + 1, "gap", total];
}
