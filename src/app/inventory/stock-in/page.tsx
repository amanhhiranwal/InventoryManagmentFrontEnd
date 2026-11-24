"use client";

/**
 * Stock In, under SCM: goods received at a warehouse (GRN).
 *
 * The storekeeper records what came in - against a PO, or as a return or
 * goods with no documents - and sends it for quality check. The inspector
 * splits each line into accepted and rejected and posts it: only then does
 * stock move. Lists only GRNs of the warehouses the person works in.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiPlus } from "react-icons/fi";

import {
  LIST_TABLE,
  ListPage,
  ListPageHeader,
  ListToolbar,
  PrimaryAction,
  StatGrid,
  TableCard,
} from "@/components/crm/ListPageShell";
import Pagination from "@/components/crm/Pagination";
import QueueTabs from "@/components/crm/QueueTabs";
import StatCard from "@/components/crm/StatCard";
import { hasPermission } from "@/features/auth/utils/permissions";
import { getMyWarehousesApi, MyWarehouse } from "@/features/locations/api/locations.api";
import { GrnPage, getGrnsApi } from "@/features/stock/api/grn.api";
import { GrnStatusPill, SELECT, TH, errorText, qty } from "@/features/stock/components/stockUi";
import { formatDate } from "@/lib/datetime";

const PAGE_SIZE = 20;

export default function StockInPage() {
  const router = useRouter();
  const canView = hasPermission("grn.read");
  const canCreate = hasPermission("grn.create");

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [warehouses, setWarehouses] = useState<MyWarehouse[]>([]);
  const [result, setResult] = useState<GrnPage | null>(null);
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

  useEffect(() => {
    if (!canView) return;
    getMyWarehousesApi()
      .then(setWarehouses)
      .catch((err: unknown) => setError(errorText(err, "Could not load your warehouses.")));
  }, [canView]);

  const load = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const answer = await getGrnsApi({
        warehouse_id: warehouseId || undefined,
        status: status || undefined,
        search: query || undefined,
        page,
        size: PAGE_SIZE,
      });
      if (request === latest.current) setResult(answer);
    } catch (err: unknown) {
      if (request === latest.current) setError(errorText(err, "Could not load goods receipts."));
      throw err;
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [warehouseId, status, query, page]);

  useEffect(() => {
    if (!canView) return;
    load().catch(() => {
      /* Shown on the page by load itself. */
    });
  }, [canView, load]);

  if (!canView) {
    return (
      <ListPage>
        <ListPageHeader title="Stock In" />
        <p className="rounded-xl bg-white p-8 text-center text-[13px] text-[#777777] dark:bg-[#071929] dark:text-slate-400">
          You do not have access to Stock In. Ask a super admin to tick it for your role in Roles &amp; Access.
        </p>
      </ListPage>
    );
  }

  const counts = result?.counts || {};
  const all = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  const rows = result?.data || [];

  return (
    <ListPage>
      <ListPageHeader title="Stock In" refreshing={loading} onRefresh={load} />
      <p className="-mt-3 text-[13px] text-[#777777] dark:text-slate-400">
        Goods received at your warehouses. Posting the receipt puts them in quarantine; quality check makes accepted goods available.
      </p>

      <StatGrid cols={5}>
        <StatCard label="Receiving In Progress" value={counts.DRAFT ?? 0} caption="drafts not yet sent in" />
        <StatCard label="Awaiting Receipt Posting" value={counts.SUBMITTED ?? 0} caption="sent in, no stock yet" />
        <StatCard label="QC Pending" value={counts.QC_PENDING ?? 0} caption="in quarantine, awaiting inspection" />
        <StatCard label="GRN Generated" value={counts.POSTED ?? 0} caption="posted to stock" />
      </StatGrid>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by GRN number, PO, supplier or delivery note"
        trailing={
          canCreate ? (
            <PrimaryAction onClick={() => router.push("/inventory/stock-in/new")} icon={<FiPlus size={14} />}>
              New Stock-In
            </PrimaryAction>
          ) : undefined
        }
      >
        <select
          aria-label="Filter by warehouse"
          className={SELECT}
          value={warehouseId}
          onChange={(e) => {
            setWarehouseId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All Warehouses</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.location_name} ({w.location_code})
            </option>
          ))}
        </select>
      </ListToolbar>

      <TableCard>
        <QueueTabs
          tabs={[
            { value: null, label: "All", count: all },
            { value: "DRAFT", label: "Receiving", count: counts.DRAFT ?? 0 },
            { value: "SUBMITTED", label: "Awaiting Receipt", count: counts.SUBMITTED ?? 0 },
            { value: "QC_PENDING", label: "QC Pending", count: counts.QC_PENDING ?? 0 },
            { value: "POSTED", label: "GRN Generated", count: counts.POSTED ?? 0 },
            { value: "CANCELLED", label: "Cancelled", count: counts.CANCELLED ?? 0 },
          ]}
          active={status}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />

        {loading && !result ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
            <CgSpinner className="animate-spin text-3xl text-primary" />
            <span className="text-xs">Loading goods receipts...</span>
          </div>
        ) : error ? (
          <p role="alert" className="px-5 py-12 text-center text-[13px] text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-[#777777] dark:text-slate-400">
            {query || status || warehouseId
              ? "No GRNs match."
              : warehouses.length === 0
                ? "You have no warehouses yet. Ask a super admin to give you warehouse access in Users."
                : "No goods received yet. Start with New Stock-In."}
          </p>
        ) : (
          <div className="max-h-[calc(100vh-380px)] min-h-[260px] overflow-auto">
            <table className={`w-full min-w-[1150px] text-left ${LIST_TABLE}`}>
              <thead className="sticky top-0 z-20">
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:bg-white dark:[&>th]:bg-[#071929]">
                  <th className={TH}>GRN Number</th>
                  <th className={TH}>Date of Receipt</th>
                  <th className={TH}>PO Number</th>
                  <th className={TH}>Supplier</th>
                  <th className={TH}>Warehouse</th>
                  <th className={`${TH} text-right`}>Received</th>
                  <th className={`${TH} text-right`}>Accepted</th>
                  <th className={`${TH} text-right`}>Rejected</th>
                  <th className={TH}>Received By</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((grn) => (
                  <tr
                    key={grn.id}
                    className="cursor-pointer align-top text-[13px] text-[#141414] transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#0b2034]"
                    onClick={() => router.push(`/inventory/stock-in/${grn.id}`)}
                  >
                    <td className="whitespace-nowrap px-5 py-4">
                      <Link
                        href={`/inventory/stock-in/${grn.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-[12px] font-semibold text-[#233353] hover:underline dark:text-sky-300"
                      >
                        {grn.grn_number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-[12px]">{formatDate(grn.receipt_date)}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-[12px]">{grn.po_number || "N/A"}</td>
                    <td className="min-w-[180px] px-5 py-4">{grn.supplier_name}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-[12px]">{grn.warehouse_name}</td>
                    <td className="px-5 py-4 text-right">{qty(grn.totals.received)}</td>
                    <td className="px-5 py-4 text-right text-emerald-600">{grn.status === "POSTED" ? qty(grn.totals.accepted) : "-"}</td>
                    <td className="px-5 py-4 text-right text-rose-600">
                      {grn.status === "POSTED" ? qty(grn.totals.rejected + grn.totals.damaged) : "-"}
                    </td>
                    <td className="px-5 py-4 text-[12px]">{grn.received_by_name || "-"}</td>
                    <td className="px-5 py-4">
                      <GrnStatusPill status={grn.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-slate-100 px-5 py-2 dark:border-[#17304a]">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={result?.total ?? 0}
            totalPages={Math.max(1, Math.ceil((result?.total ?? 0) / PAGE_SIZE))}
            onPageChange={setPage}
            noun="GRNs"
          />
        </div>
      </TableCard>
    </ListPage>
  );
}
