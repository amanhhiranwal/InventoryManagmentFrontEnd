"use client";

/* Rows of records that fit the page instead of scrolling sideways.
 *
 * From tablet width up it is a table sized to its container: no fixed
 * minimum width, cells wrap, so a laptop shows every column at once. On a
 * phone each record becomes a card - the primary columns as its heading,
 * the rest as label / value pairs - because a table squeezed to 375px is
 * either unreadable or a sideways scroll. */

import { useRouter } from "next/navigation";
import { MouseEvent, ReactNode } from "react";

import { LIST_TABLE } from "@/components/crm/ListPageShell";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "right";
  /** Shown as the card's heading on a phone instead of a labelled pair. */
  primary?: boolean;
  /** Width hint for the table column, e.g. "w-[18%]". */
  width?: string;
  /** Keep the column on one line (dates, amounts). */
  nowrap?: boolean;
}

const HEAD = "px-3 py-3 text-[12px] font-normal text-[#777777] dark:text-slate-400";
const CELL = "px-3 py-3 align-top text-[13px] text-[#141414] dark:text-slate-200";

export default function DataList<T>({
  rows,
  columns,
  rowKey,
  footer,
  dense = false,
  rowHref,
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  /** Totals or a note under the rows, shown in both layouts. */
  footer?: ReactNode;
  /** Tighter rows for tables inside a detail panel. */
  dense?: boolean;
  /** Where clicking anywhere on a row goes. Links and buttons inside the
      row keep their own action. */
  rowHref?: (row: T) => string;
  /** Or run this instead, e.g. open a dialog. */
  onRowClick?: (row: T) => void;
}) {
  const router = useRouter();

  /* A click on a link, button or field inside the row is that control's,
     not the row's. */
  const open = (row: T) => (event: MouseEvent<HTMLElement>) => {
    if (!rowHref && !onRowClick) return;
    if ((event.target as HTMLElement).closest("a,button,input,select,textarea,label")) return;
    if (onRowClick) return onRowClick(row);
    if (!rowHref) return;
    if (event.metaKey || event.ctrlKey) window.open(rowHref(row), "_blank");
    else router.push(rowHref(row));
  };
  /* Mouse only: each row already holds a real link to the same page
     (its first cell), which is the keyboard and screen-reader path, so the
     row is not made a second tab stop. */
  const clickable = Boolean(rowHref || onRowClick);
  const rowProps = (row: T) => (clickable ? { onClick: open(row) } : {});

  const primary = columns.filter((c) => c.primary);
  const rest = columns.filter((c) => !c.primary);
  const pad = dense ? "py-2.5" : "";

  return (
    <>
      <table className={`hidden w-full table-auto text-left md:table ${LIST_TABLE}`}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.header} className={`${HEAD} ${c.width || ""} ${c.align === "right" ? "text-right" : ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              {...rowProps(row)}
              className={`transition hover:bg-slate-50 dark:hover:bg-[#0b2034] ${
                clickable ? "cursor-pointer" : ""
              }`}
            >
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={`${CELL} ${pad} ${c.align === "right" ? "text-right" : ""} ${c.nowrap ? "whitespace-nowrap" : "break-words"}`}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-[#f0f0f0] md:hidden dark:divide-[#17304a]">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            {...rowProps(row)}
            className={`px-4 py-3.5 ${clickable ? "cursor-pointer active:bg-slate-50 dark:active:bg-[#0b2034]" : ""}`}
          >
            {primary.length > 0 && (
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2 text-[13px] text-[#141414] dark:text-slate-200">
                {primary.map((c) => (
                  <div key={c.header} className={c.align === "right" ? "text-right" : "min-w-0"}>
                    {c.cell(row)}
                  </div>
                ))}
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              {rest.map((c) => (
                <div key={c.header} className="min-w-0">
                  <dt className="text-[11px] text-[#777777] dark:text-slate-400">{c.header}</dt>
                  <dd className="break-words text-[13px] text-[#141414] dark:text-slate-200">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      {footer}
    </>
  );
}

/** Totals under a lines list, right-aligned, label beside value. */
export function Totals({ rows }: { rows: { label: string; value: ReactNode; strong?: boolean }[] }) {
  return (
    <dl className="ml-auto mt-3 w-full max-w-xs space-y-1.5 border-t border-[#f3f3f3] px-3 pt-3 text-[13px] dark:border-[#17304a]">
      {rows.map((r) => (
        <div key={r.label} className={`flex justify-between gap-4 ${r.strong ? "text-[15px] font-semibold text-[#141414] dark:text-white" : ""}`}>
          <dt className={r.strong ? "" : "text-[#777777]"}>{r.label}</dt>
          <dd className="whitespace-nowrap">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
