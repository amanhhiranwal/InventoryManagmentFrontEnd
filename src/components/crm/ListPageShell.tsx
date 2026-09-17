"use client";

import { ReactNode } from "react";
import { FiRefreshCw, FiSearch, FiSliders } from "react-icons/fi";

/**
 * Page chrome shared by the Leads, Opportunity and Sales Order lists so the
 * three screens read as one product: same background, title row, KPI grid,
 * toolbar and table container.
 */

/**
 * List-table look from the design, applied on the <table>: regular 12px
 * #777 column headers over a light rule, and rows without dividers.
 */
export const LIST_TABLE = [
  "[&_thead_tr]:border-b",
  "[&_thead_tr]:border-[#e2e2e2]",
  "[&_thead_tr]:bg-white",
  "dark:[&_thead_tr]:border-[#17304a]",
  "dark:[&_thead_tr]:bg-transparent",
  "[&_th]:text-[12px]",
  "[&_th]:font-normal",
  "[&_th]:normal-case",
  "[&_th]:tracking-normal",
  "[&_th]:text-[#777777]",
  "dark:[&_th]:text-slate-400",
  "[&_th>button]:text-[12px]",
  "[&_th>button]:font-normal",
  "[&_th>button]:text-[#777777]",
  "dark:[&_th>button]:text-slate-400",
  "[&_th>span]:font-normal",
  "[&_tbody>tr]:border-b-0",
].join(" ");

export function ListPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full space-y-5 pb-8">{children}</div>
  );
}

export function ListPageHeader({
  title,
  refreshing,
  onRefresh,
  actions,
}: {
  title: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Right-hand slot, typically the overflow menu. */
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">
          {title}
        </h1>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            aria-label={`Refresh ${title}`}
            className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:hover:bg-[#0b2034]"
          >
            <FiRefreshCw
              size={11}
              className={refreshing ? "animate-spin" : ""}
            />
          </button>
        )}
      </div>

      {actions}
    </div>
  );
}

/** Responsive KPI grid. Pass StatCard children. */
export function StatGrid({
  children,
  cols = 4,
}: {
  children: ReactNode;
  /** Cards per row on wide screens: four, or six (Quotation), from 1100px. */
  cols?: 4 | 6;
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${
        cols === 6
          ? "lg:grid-cols-3 min-[68.75rem]:grid-cols-6"
          : "min-[68.75rem]:grid-cols-4"
      }`}
    >
      {children}
    </div>
  );
}

export function ListToolbar({
  search,
  onSearchChange,
  placeholder = "Search",
  activeFilterCount = 0,
  onToggleFilters,
  children,
  trailing,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  activeFilterCount?: number;
  onToggleFilters?: () => void;
  /** Slot between the search box and the filter button (e.g. List/Board). */
  children?: ReactNode;
  /** Primary action, e.g. the "Add New ..." button. */
  trailing?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="h-[39px] w-full rounded-lg border border-[#cccccc] bg-[#f3f3f3] pl-3.5 pr-10 text-[13px] text-[#141414] outline-none transition placeholder:text-[#aaaaaa] focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
        />

        <FiSearch
          size={15}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#131313] dark:text-slate-400"
        />
      </div>

      {children}

      {onToggleFilters && (
        <button
          type="button"
          onClick={onToggleFilters}
          aria-label="Filters"
          className="relative flex h-[39px] w-[39px] shrink-0 items-center justify-center rounded-lg bg-white text-[#131313] transition hover:bg-slate-50 dark:border dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-300 dark:hover:bg-[#0b2034]"
        >
          <FiSliders size={16} />

          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#233353] px-1 text-[9px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      )}

      {trailing}
    </div>
  );
}

/** Primary dark action button used for every "Add New ..." on these pages. */
export function PrimaryAction({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[39px] shrink-0 items-center justify-center gap-2 rounded-lg bg-[#273756] px-4 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#18243a]"
    >
      {icon}
      {children}
    </button>
  );
}

/** White rounded container that wraps the table + its pagination footer. */
export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-white dark:border dark:border-[#17304a] dark:bg-[#071929]">
      {children}
    </div>
  );
}

/** Shared table column header cell typography. */
export function Th({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 ${className}`}
    >
      {children}
    </th>
  );
}
