"use client";

/**
 * Purchase Orders: every PO raised from an approved vendor selection, by
 * status. Needs purchase_order.read; the server refuses the list otherwise.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ListPage, ListPageHeader, ListToolbar, TableCard } from "@/components/crm/ListPageShell";
import Pagination from "@/components/crm/Pagination";
import QueueTabs from "@/components/crm/QueueTabs";
import { errorDetail, getPurchaseOrdersApi, type PurchaseOrder } from "@/features/procurement/api/procurement.api";
import DataList, { type Column } from "@/features/procurement/components/DataList";
import { Empty, ErrorState, Loading, ProcStatus, day, money } from "@/features/procurement/components/shared";

const PAGE_SIZE = 20;

const TABS: { value: string | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "SENT", label: "Sent" },
  { value: "ACKNOWLEDGED", label: "Acknowledged" },
  { value: "CLOSED", label: "Closed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const SUB = "mt-0.5 block text-[11px] text-[#777777] dark:text-slate-400";

const COLUMNS: Column<PurchaseOrder>[] = [
  {
    header: "Purchase Order",
    primary: true,
    cell: (po) => (
      <>
        <Link href={`/procurement/purchase-orders/${po.id}`} className="font-semibold text-[#233353] hover:underline dark:text-sky-300">
          {po.po_number}
        </Link>
        <span className={SUB}>{day(po.po_date)}</span>
      </>
    ),
  },
  {
    header: "Vendor",
    cell: (po) => (
      <>
        {po.vendor_name}
        <span className={SUB}>{po.pr_number || "No requisition"}</span>
      </>
    ),
  },
  { header: "Sales Order", cell: (po) => po.sales_order_number || <span className="text-[#999999]">None</span> },
  { header: "Expected Delivery", nowrap: true, cell: (po) => day(po.expected_delivery) },
  { header: "Grand Total", align: "right", nowrap: true, cell: (po) => money(po.grand_total, po.currency) },
  { header: "Status", primary: true, cell: (po) => <ProcStatus status={po.status} /> },
];

export default function PurchaseOrdersPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const answer = await getPurchaseOrdersApi({ status: status ?? undefined, search: query || undefined, page, size: PAGE_SIZE });
      if (request !== latest.current) return;
      setRows(answer.data);
      setTotal(answer.total);
      setCounts(answer.counts || {});
    } catch (failure) {
      if (request === latest.current) setError(errorDetail(failure, "Could not load purchase orders."));
      throw failure;
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [status, query, page]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const all = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <ListPage>
      <ListPageHeader title="Purchase Orders" refreshing={loading} onRefresh={load} />
      <ListToolbar search={search} onSearchChange={setSearch} placeholder="Search by PO number or vendor" />

      <TableCard>
        <QueueTabs
          tabs={TABS.map((t) => ({ ...t, count: t.value ? counts[t.value] || 0 : all }))}
          active={status}
          onChange={(value) => { setStatus(value); setPage(1); }}
          fit
        />

        {loading && !rows.length && !error ? (
          <Loading text="Loading purchase orders..." />
        ) : error ? (
          <ErrorState text={error} onRetry={() => load().catch(() => {})} />
        ) : rows.length === 0 ? (
          <Empty text={query || status ? "No purchase orders match." : "No purchase orders yet. They are generated from approved vendor selections on the Procurement Desk."} />
        ) : (
          <DataList rows={rows} columns={COLUMNS} rowKey={(po) => po.id} rowHref={(po) => `/procurement/purchase-orders/${po.id}`} />
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={total}
          totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          onPageChange={setPage}
          noun="purchase orders"
        />
      </TableCard>
    </ListPage>
  );
}
