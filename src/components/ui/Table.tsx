import { ReactNode } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import Button from "./Button";

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
  pageSize = 20,
  onPageChange,
}: TableProps) {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const showPagination = onPageChange && totalItems > 0;

  const startRange = (currentPage - 1) * pageSize + 1;
  const endRange = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/10">
              {headers.map((h, i) => (
                <th key={i} className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#0d2336]">
            {loading ? (
              <tr>
                <td colSpan={headers.length} className="py-20 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <CgSpinner className="animate-spin text-3xl text-primary" />
                    <span className="text-xs text-slate-400 font-semibold">Loading data...</span>
                  </div>
                </td>
              </tr>
            ) : (onPageChange && totalItems === 0) ? (
              <tr>
                <td colSpan={headers.length} className="py-20 text-center text-xs text-slate-400 italic">
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
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/10 text-xs">
          <div className="text-slate-500 dark:text-slate-400 font-medium">
            Showing <span className="font-bold text-slate-700 dark:text-slate-200">{startRange}</span> to{" "}
            <span className="font-bold text-slate-700 dark:text-slate-200">{endRange}</span> of{" "}
            <span className="font-bold text-slate-700 dark:text-slate-200">{totalItems}</span> records
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              icon={<FiChevronLeft />}
            >
              Previous
            </Button>
            <span className="text-slate-500 dark:text-slate-400 font-semibold px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              icon={<FiChevronRight />}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
