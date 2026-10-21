"use client";

import { ReactNode, useCallback, useMemo, useState } from "react";

/**
 * One sort for a list, shared by every table on the portal.
 *
 * The carets in the headers used to be decoration - a pair of glyphs
 * with nothing behind them - and only the proforma invoice list could
 * actually reorder itself. This is that list's behaviour, lifted out so
 * the rest of the portal sorts the same way.
 *
 * One column at a time, as asked: clicking a second column drops the
 * first. Clicking the same column again reverses it, and a third click
 * returns the list to the order the page loaded it in.
 */

export type SortState<K extends string> = { key: K; dir: 1 | -1 } | null;

/** Pull the comparable value out of a row, per column. */
export type SortValues<K extends string, Row> = Record<
  K,
  (row: Row) => string | number
>;

export function useTableSort<K extends string, Row>(
  values: SortValues<K, Row>,
  initial: SortState<K> = null,
) {
  const [sort, setSort] = useState<SortState<K>>(initial);

  const toggleSort = useCallback((key: K) => {
    setSort((current) =>
      current?.key === key
        ? current.dir === 1
          ? { key, dir: -1 }
          : null
        : { key, dir: 1 },
    );
  }, []);

  /* Rows come back untouched while nothing is sorted, so a list that has
     its own order - newest first, say - keeps it until someone asks for
     something else. */
  const sortRows = useCallback(
    (rows: Row[]) => {
      if (!sort) return rows;

      const valueOf = values[sort.key];

      if (!valueOf) return rows;

      return [...rows].sort((a, b) => {
        const left = valueOf(a);
        const right = valueOf(b);

        if (typeof left === "number" && typeof right === "number") {
          return (left - right) * sort.dir;
        }

        return (
          String(left).localeCompare(String(right), undefined, {
            numeric: true,
            sensitivity: "base",
          }) * sort.dir
        );
      });
    },
    // `values` is rebuilt on every render by most callers; the keys and
    // what they read never change, so only the sort itself matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sort],
  );

  return useMemo(
    () => ({ sort, setSort, toggleSort, sortRows }),
    [sort, toggleSort, sortRows],
  );
}

/**
 * A header cell that sorts. Drop-in for a plain <th>: pass the column's
 * key and the state from useTableSort.
 */
export function SortTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  align = "left",
  className = "",
  children,
}: {
  label?: string;
  sortKey: K;
  sort: SortState<K>;
  onSort: (key: K) => void;
  align?: "left" | "right" | "center";
  className?: string;
  /** Use instead of `label` when the heading is not plain text. */
  children?: ReactNode;
}) {
  const active = sort?.key === sortKey;

  return (
    <th
      aria-sort={
        active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"
      }
      className={`whitespace-nowrap px-4 py-4 ${
        align === "right"
          ? "text-right"
          : align === "center"
            ? "text-center"
            : "text-left"
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={`Sort by ${label ?? sortKey}`}
        className={`flex w-full items-center gap-1.5 ${
          align === "right"
            ? "justify-end"
            : align === "center"
              ? "justify-center"
              : "justify-start"
        }`}
      >
        <span>{children ?? label}</span>

        <SortCarets dir={active ? sort!.dir : null} />
      </button>
    </th>
  );
}

/** The up/down pair, with the active direction picked out. */
export function SortCarets({ dir }: { dir: 1 | -1 | null }) {
  return (
    <span
      aria-hidden
      className="flex flex-col text-[7px] leading-[7px] text-slate-300 dark:text-slate-600"
    >
      <span className={dir === 1 ? "text-slate-700 dark:text-white" : ""}>
        ▲
      </span>

      <span className={dir === -1 ? "text-slate-700 dark:text-white" : ""}>
        ▼
      </span>
    </span>
  );
}
