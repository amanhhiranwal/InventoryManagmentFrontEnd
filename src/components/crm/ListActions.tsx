"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { FiDownload, FiGrid, FiMoreVertical } from "react-icons/fi";

import { useUIStore } from "@/lib/store/ui.store";

/**
 * The overflow menu at the top right of a list screen: export the rows,
 * or download the numbers above them as a chart.
 *
 * Six pages had grown their own copy of this, each with its own button
 * styling and its own CSV writer, and three screens - Inventory and the
 * two fulfilment desks - had a bare record count sitting where the menu
 * should be, which read as a stray number rather than as a control. This
 * is the one implementation; a page supplies what its rows and its chart
 * are made of and gets the same menu as everywhere else.
 */

export interface ExportColumn<Row> {
  header: string;
  /** The cell's value. Anything not a string is stringified. */
  value: (row: Row) => string | number | null | undefined;
}

export interface ChartBar {
  label: string;
  value: number;
}

/** A CSV cell: quoted, with embedded quotes doubled, as Excel expects. */
function cell(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

/** Rows to a CSV file, named for the screen and the day. */
export function exportRows<Row>(
  name: string,
  columns: ExportColumn<Row>[],
  rows: Row[],
): void {
  const csv = [
    columns.map((column) => cell(column.header)).join(","),
    ...rows.map((row) =>
      columns.map((column) => cell(column.value(row))).join(","),
    ),
  ].join("\n");

  save(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    `${slug(name)}-${today()}.csv`,
  );
}

/** A screen's name as a file name: "Accounts Desk" -> "accounts-desk". */
function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** The screen's headline numbers as a bar chart PNG. */
export function downloadChart(title: string, bars: ChartBar[]): void {
  const canvas = document.createElement("canvas");

  canvas.width = 1200;
  canvas.height = 600;

  const ctx = canvas.getContext("2d");

  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 32px Arial";
  ctx.fillText(title, 60, 70);

  const drawn = bars.slice(0, 6);
  const max = Math.max(...drawn.map((bar) => bar.value), 1);

  const chartTop = 140;
  const chartBottom = 500;
  // The bars share the width between them, so four numbers and six read
  // the same way rather than six being squeezed off the right edge.
  const span = (canvas.width - 160) / Math.max(drawn.length, 1);
  const barWidth = Math.min(150, span * 0.6);

  drawn.forEach((bar, index) => {
    const x = 80 + index * span + (span - barWidth) / 2;
    const height = (bar.value / max) * (chartBottom - chartTop);

    ctx.fillStyle = "#1d2b45";
    ctx.fillRect(x, chartBottom - height, barWidth, height);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      bar.value.toLocaleString("en-IN"),
      x + barWidth / 2,
      chartBottom - height - 15,
    );

    ctx.font = "16px Arial";
    ctx.fillText(bar.label, x + barWidth / 2, chartBottom + 35);
  });

  const link = document.createElement("a");

  link.download = `${slug(title)}-chart.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

export function DropdownMenu({ children }: { children: ReactNode }) {
  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-[#0d2336] dark:bg-[#051422]">
      {children}
    </div>
  );
}

export function DropdownButton({
  icon,
  children,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-[#071929] dark:disabled:text-slate-600"
    >
      {icon}
      {children}
    </button>
  );
}

export default function ListActionsMenu<Row>({
  name,
  columns,
  rows,
  chart,
  extra,
}: {
  /** The screen, as it should read in the file name and chart title. */
  name: string;
  columns: ExportColumn<Row>[];
  rows: Row[];
  /** The numbers along the top. Omit to hide the chart item. */
  chart?: ChartBar[];
  /** Anything else this screen puts in the menu, above the two staples. */
  extra?: (close: () => void) => ReactNode;
}) {
  const { addToast } = useUIStore();
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (holder.current && !holder.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", outside);

    return () => document.removeEventListener("mousedown", outside);
  }, []);

  const close = () => setOpen(false);

  return (
    <div ref={holder} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-label={`${name} actions`}
        aria-expanded={open}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-300 dark:hover:bg-[#0b2034]"
      >
        <FiMoreVertical size={15} />
      </button>

      {open && (
        <DropdownMenu>
          {extra?.(close)}

          <DropdownButton
            icon={<FiDownload size={14} />}
            disabled={rows.length === 0}
            onClick={() => {
              exportRows(name, columns, rows);
              close();
              addToast(
                `${rows.length} ${rows.length === 1 ? "record" : "records"} exported.`,
                "success",
              );
            }}
          >
            Export Data
          </DropdownButton>

          {chart && chart.length > 0 && (
            <DropdownButton
              icon={<FiGrid size={14} />}
              onClick={() => {
                downloadChart(name, chart);
                close();
                addToast("Chart downloaded.", "success");
              }}
            >
              Download Chart
            </DropdownButton>
          )}
        </DropdownMenu>
      )}
    </div>
  );
}
