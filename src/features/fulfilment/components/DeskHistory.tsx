"use client";

/* What a desk has already decided, next to what is waiting on it.
 *
 * DeskWithHistory puts Pending / Approved / Rejected over a desk: Pending
 * is the desk's own queue, Approved and Rejected are the orders it moved
 * on or put on hold, newest first, with who decided, when and why. The
 * same on Accounts, Production and Logistics. Read from the activity each
 * decision writes on the order, so it reaches back before these screens
 * existed. */

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

import Pagination from "@/components/crm/Pagination";
import { TableCard } from "@/components/crm/ListPageShell";
import {
  getDeskHistoryApi,
  money,
  type DeskDecision,
  type HistoryDesk,
} from "@/features/fulfilment/api/fulfilment.api";
import DataList, { type Column } from "@/features/procurement/components/DataList";
import { Empty, ErrorState, Loading, day, humanize, when } from "@/features/procurement/components/shared";

const PAGE_SIZE = 25;
const SUB = "mt-0.5 block text-[11px] text-[#777777] dark:text-slate-400";

const VIEWS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
] as const;

type View = (typeof VIEWS)[number]["value"];

const TITLES: Record<HistoryDesk, string> = {
  accounts: "Accounts Desk",
  production: "Production",
  logistics: "Logistics",
};

/** Pending / Approved / Rejected over a desk; ``children`` is the desk's queue. */
export function DeskWithHistory({ desk, children }: { desk: HistoryDesk; children: ReactNode }) {
  const [view, setView] = useState<View>("PENDING");

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label={`${TITLES[desk]} views`} className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-[#17304a] dark:bg-[#071929]">
        {VIEWS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={view === option.value}
            onClick={() => setView(option.value)}
            className={`rounded-md px-3.5 py-1.5 text-[12px] font-medium transition-colors ${
              view === option.value
                ? "bg-[#233353] text-white dark:bg-[#2b4470]"
                : "text-[#474747] hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#0b2034]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {view === "PENDING" ? (
        children
      ) : (
        <>
          <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">
            {TITLES[desk]} · {view === "APPROVED" ? "Approved" : "Rejected"}
          </h1>
          <DeskHistory desk={desk} decision={view} />
        </>
      )}
    </div>
  );
}

export default function DeskHistory({ desk, decision }: { desk: HistoryDesk; decision: "APPROVED" | "REJECTED" }) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<DeskDecision[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const answer = await getDeskHistoryApi(desk, decision, page, PAGE_SIZE);
      if (request !== latest.current) return;
      setRows(answer.rows);
      setTotal(answer.total);
    } catch (failure) {
      if (request === latest.current) {
        const detail = (failure as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail || "Could not load the history.");
      }
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [desk, decision, page]);

  useEffect(() => {
    load();
  }, [load]);

  const approved = decision === "APPROVED";
  const accounts = desk === "accounts";

  const columns: Column<DeskDecision>[] = [
    {
      header: approved ? "Approved" : "Rejected",
      primary: true,
      nowrap: true,
      cell: (r) => (
        <>
          {when(r.decided_at)}
          <span className={SUB}>by {r.decided_by_name}</span>
        </>
      ),
    },
    {
      header: "Sales Order",
      primary: true,
      cell: (r) => (
        <>
          <Link href={`/sales/orders/${r.order_id}`} className="font-semibold text-[#233353] hover:underline dark:text-sky-300">
            {r.order_number}
          </Link>
          <span className={SUB}>{r.customer_name || r.company_name || "—"}</span>
        </>
      ),
    },
    {
      header: approved ? "Step" : "At",
      cell: (r) => (
        <>
          {r.kind === "BALANCE" ? "Balance settlement" : r.kind === "ADVANCE" ? "Advance verification" : approved ? r.action : r.stage}
          <span className={SUB}>{r.kind === "STAGE" ? `from ${r.stage}` : r.action}</span>
          {r.vehicle_number && approved && r.action === "Out For Delivery" && (
            <span className={SUB}>Vehicle {r.vehicle_number} · {r.driver_name}</span>
          )}
        </>
      ),
    },
    {
      header: accounts ? "Amount" : "Order Value",
      align: "right",
      nowrap: true,
      cell: (r) => (
        <>
          {money(r.amount)}
          {accounts && (
            <span className={SUB}>{r.received_date ? `received ${day(r.received_date)}` : `of ${money(r.grand_total)}`}</span>
          )}
        </>
      ),
    },
    {
      header: approved ? "Remarks" : "Reason",
      cell: (r) => r.remarks || <span className="text-[#999999]">—</span>,
    },
    {
      header: "Order Now",
      nowrap: true,
      cell: (r) => humanize(r.current_status),
    },
  ];

  return (
    <TableCard>
      {loading && !rows.length && !error ? (
        <Loading text="Loading the history..." />
      ) : error ? (
        <ErrorState text={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <Empty
          text={
            approved
              ? "Nothing approved yet. Orders this desk moves on appear here."
              : "Nothing rejected. Orders this desk puts on hold appear here, with the reason."
          }
        />
      ) : (
        <DataList rows={rows} columns={columns} rowKey={(r) => r.id} rowHref={(r) => `/sales/orders/${r.order_id}`} />
      )}

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        totalItems={total}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        onPageChange={setPage}
        noun={approved ? "approvals" : "rejections"}
      />
    </TableCard>
  );
}
