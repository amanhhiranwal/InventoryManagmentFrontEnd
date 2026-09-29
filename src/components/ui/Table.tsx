import { Children, ReactNode } from "react";
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
  /** How many records there are in total, across every page. Only needed
      when the table is paginated; the empty state does not use it. */
  totalItems?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}

export default function Table({
  headers,
  children,
  loading = false,
  currentPage = 1,
  totalItems,
  pageSize = 10,
  onPageChange,
}: TableProps) {
  /* Whether there is anything to show is a question about the rows we
     were handed, not about a pagination count. Deciding it from
     totalItems meant any page that did not pass one - four of the
     Masters screens - drew "No records found" over a full list. */
  const rowCount = Children.count(children);

  const records = totalItems ?? rowCount;

  const totalPages =
    Math.ceil(records / pageSize) || 1;

  const showPagination =
    Boolean(onPageChange) && records > 0;

  const startRange =
    records === 0
      ? 0
      : (currentPage - 1) * pageSize + 1;

  const endRange = Math.min(
    currentPage * pageSize,
    records
  );

  const goToPage = (page: number) => {
    if (!onPageChange) return;

    if (page < 1 || page > totalPages) {
      return;
    }

    onPageChange(page);
  };

  return (
    /* Same container and column-header treatment as the CRM lists - see
       TableCard and LIST_TABLE in components/crm/ListPageShell - so a
       Masters table and a Leads table are recognisably the same table. */
    <div className="overflow-hidden rounded-xl bg-white dark:border dark:border-[#17304a] dark:bg-[#071929]">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#e2e2e2] bg-white dark:border-[#17304a] dark:bg-transparent">
              {headers.map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  className="whitespace-nowrap px-4 py-3 text-[12px] font-normal text-[#777777] dark:text-slate-400"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="py-20 text-center"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CgSpinner className="animate-spin text-3xl text-[#233353]" />

                    <span className="text-[13px] text-slate-400">
                      Loading data...
                    </span>
                  </div>
                </td>
              </tr>
            ) : rowCount === 0 ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="py-20 text-center text-[13px] text-slate-400"
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
        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-5 py-3.5 dark:border-[#17304a] dark:bg-transparent">
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
              {records}
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