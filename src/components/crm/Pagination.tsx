"use client";

import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

/**
 * Table footer shared by the Leads, Opportunity and Sales Order lists:
 * "Showing 1-10 of 1,284 leads" on the left, page controls on the right.
 */
export default function Pagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  noun = "records",
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Plural noun shown in the count, e.g. "leads". */
  noun?: string;
}) {
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  /* Window of page numbers around the current page, so long lists stay
     readable instead of rendering hundreds of buttons. */
  const pages: number[] = [];
  const from = Math.max(1, Math.min(page - 1, totalPages - 2));
  const to = Math.min(totalPages, from + 2);

  for (let i = from; i <= to; i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-[#17304a]">
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        Showing{" "}
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {start}-{end}
        </span>{" "}
        of{" "}
        <span className="font-semibold text-slate-700 dark:text-slate-200">
          {totalItems.toLocaleString("en-IN")}
        </span>{" "}
        {noun}
      </p>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#17304a] dark:hover:bg-[#0b2034]"
        >
          <FiChevronLeft size={14} />
        </button>

        {pages.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === page ? "page" : undefined}
            className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-[11px] font-semibold transition ${
              item === page
                ? "bg-[#233353] text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-300 dark:hover:bg-[#0b2034]"
            }`}
          >
            {item}
          </button>
        ))}

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#17304a] dark:hover:bg-[#0b2034]"
        >
          <FiChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
