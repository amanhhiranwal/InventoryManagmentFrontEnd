/**
 * Month-over-month figures for the StatCard % pill.
 *
 * "This month" and "last month" are calendar months in the viewer's local
 * time, and a record belongs to the month it was created in.
 */

export type KpiChange = {
  /** Unsigned percentage such as "12.4%". */
  text: string;
  /** Whether the figure rose (or held steady). */
  up: boolean;
};

/** Start of the current month, or `offset` months from it, in ms. */
export const startOfMonth = (offset = 0) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1).getTime();
};

/** Percentage change from `previous` to `current`. Growth from nothing
    counts as 100%, and nothing either time as 0%. */
export function percentChange(current: number, previous: number): KpiChange {
  const change = previous
    ? ((current - previous) / previous) * 100
    : current
      ? 100
      : 0;

  return { text: `${Math.abs(change).toFixed(1)}%`, up: change >= 0 };
}

/** Change of a figure measured over this month's records against last
    month's. */
export function monthOverMonth<T>(
  records: T[],
  createdAt: (record: T) => string | null | undefined,
  measure: (records: T[]) => number,
): KpiChange {
  const thisMonth = startOfMonth();
  const lastMonth = startOfMonth(-1);

  const created = (record: T) => new Date(createdAt(record) || 0).getTime();

  const current = measure(records.filter((r) => created(r) >= thisMonth));
  const previous = measure(
    records.filter((r) => created(r) >= lastMonth && created(r) < thisMonth),
  );

  return percentChange(current, previous);
}
