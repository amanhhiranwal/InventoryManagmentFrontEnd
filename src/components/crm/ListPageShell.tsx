"use client";

import { ReactNode } from "react";
import { FiRefreshCw, FiSearch, FiSliders } from "react-icons/fi";

/**
 * Page chrome shared by the Leads, Opportunity and Sales Order lists so the
 * three screens read as one product: same background, title row, KPI grid,
 * toolbar and table container.
 */

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
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
        <FiSearch
          size={15}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
        />
      </div>

      {children}

      {onToggleFilters && (
        <button
          type="button"
          onClick={onToggleFilters}
          aria-label="Filters"
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-300 dark:hover:bg-[#0b2034]"
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
      className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#233353] px-5 text-xs font-bold text-white shadow-sm transition hover:bg-[#18243a]"
    >
      {icon}
      {children}
    </button>
  );
}

/** White rounded container that wraps the table + its pagination footer. */
export function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#17304a] dark:bg-[#071929]">
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
