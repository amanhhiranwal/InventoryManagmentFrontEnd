import { ReactNode } from "react";
import { CgSpinner } from "react-icons/cg";
import {
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";

interface TableProps {
  headers: string[];
  children: ReactNode;
  loading?: boolean;
  currentPage?: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}

export default function Table({
  headers,
  children,
  loading = false,
  currentPage = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
}: TableProps) {
  const totalPages =
    Math.ceil(totalItems / pageSize) || 1;

  const showPagination =
    Boolean(onPageChange) && totalItems > 0;

  const startRange =
    totalItems === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;

  const endRange = Math.min(
    currentPage * pageSize,
    totalItems
  );

  const goToPage = (page: number) => {
    if (!onPageChange) return;

    if (page < 1 || page > totalPages) {
      return;
    }

    onPageChange(page);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 dark:border-[#0d2336] bg-slate-50/60 dark:bg-[#071929]/20">
              {headers.map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  className="px-4 py-3.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-[#0d2336]">
            {loading ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="py-20 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CgSpinner className="animate-spin text-3xl text-[#233353]" />

                    <span className="text-xs text-slate-400 font-semibold">
                      Loading data...
                    </span>
                  </div>
                </td>
              </tr>
            ) : totalItems === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="py-20 text-center text-xs text-slate-400"
                >
                  No records found.
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-[#0d2336] bg-white dark:bg-[#051422]">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Showing{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {startRange}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {endRange}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {totalItems}
            </span>{" "}
            records
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() =>
                goToPage(currentPage - 1)
              }
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <FiChevronLeft />
            </button>

            {Array.from(
              {
                length: Math.min(
                  totalPages,
                  3
                ),
              },
              (_, index) => index + 1
            ).map((page) => (
              <button
                type="button"
                key={page}
                onClick={() =>
                  goToPage(page)
                }
                className={`w-8 h-8 rounded-lg text-xs font-semibold ${
                  currentPage === page
                    ? "bg-[#233353] text-white"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#071929]"
                }`}
              >
                {page}
              </button>
            ))}

            {totalPages > 3 && (
              <span className="px-1 text-slate-400">
                ...
              </span>
            )}

            <button
              type="button"
              disabled={
                currentPage >= totalPages
              }
              onClick={() =>
                goToPage(currentPage + 1)
              }
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <FiChevronRight />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}