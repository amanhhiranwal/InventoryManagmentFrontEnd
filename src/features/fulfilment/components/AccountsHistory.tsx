"use client";

/* What the accounts desk has already decided: advances verified and
 * balances settled (Approved), or orders put on hold (Rejected), newest
 * first, with who decided, when, the amount and the reason. Read from the
 * activity each decision writes on the order, so it reaches back before
 * this screen existed. */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import Pagination from "@/components/crm/Pagination";
import { TableCard } from "@/components/crm/ListPageShell";
import {
  getAccountsHistoryApi,
  money,
  type DeskDecision,
} from "@/features/fulfilment/api/fulfilment.api";
import DataList, { type Column } from "@/features/procurement/components/DataList";
import { Empty, ErrorState, Loading, day, humanize, when } from "@/features/procurement/components/shared";

const PAGE_SIZE = 25;
const SUB = "mt-0.5 block text-[11px] text-[#777777] dark:text-slate-400";

export default function AccountsHistory({ decision }: { decision: "APPROVED" | "REJECTED" }) {
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
      const answer = await getAccountsHistoryApi(decision, page, PAGE_SIZE);
      if (request !== latest.current) return;
      setRows(answer.rows);
      setTotal(answer.total);
    } catch (failure) {
      if (request === latest.current) {
        const detail = (failure as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(detail || "Could not load the accounts history.");
      }
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [decision, page]);

  useEffect(() => {
    load();
  }, [load]);

  const approved = decision === "APPROVED";

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
      header: "For",
      cell: (r) => (
        <>
          {r.kind === "BALANCE" ? "Balance settlement" : "Advance verification"}
          <span className={SUB}>{r.action}</span>
        </>
      ),
    },
    {
      header: "Amount",
      align: "right",
      nowrap: true,
      cell: (r) => (
        <>
          {money(r.amount)}
          <span className={SUB}>{r.received_date ? `received ${day(r.received_date)}` : `of ${money(r.grand_total)}`}</span>
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
              ? "Nothing approved yet. Verified advances and settled balances appear here."
              : "Nothing rejected. Orders accounts put on hold appear here, with the reason."
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
