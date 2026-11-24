"use client";

/**
 * Dispatch, under SCM: sending sales orders out of the warehouse.
 *
 * Stock is reserved for an order, a dispatch order takes some or all of it,
 * it is picked (serials) and packed, the challan, gate pass and e-way bill
 * are recorded, and committing it is the one moment stock goes out. Proof
 * of delivery closes it. Lists only the warehouses the person works in.
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
import { DispatchPage, getDispatchesApi } from "@/features/stock/api/dispatch.api";
import { DispatchStatusPill, SELECT, TH, errorText, qty } from "@/features/stock/components/stockUi";
import { formatDate } from "@/lib/datetime";

const PAGE_SIZE = 20;

export default function DispatchListPage() {
  const router = useRouter();
  const canView = hasPermission("dispatch.read");
  const canStart = hasPermission("dispatch.manage") || hasPermission("stock.reserve");

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [warehouses, setWarehouses] = useState<MyWarehouse[]>([]);
  const [result, setResult] = useState<DispatchPage | null>(null);
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
      const answer = await getDispatchesApi({
        warehouse_id: warehouseId || undefined,
        status: status || undefined,
        search: query || undefined,
        page,
        size: PAGE_SIZE,
      });
      if (request === latest.current) setResult(answer);
    } catch (err: unknown) {
      if (request === latest.current) setError(errorText(err, "Could not load dispatch orders."));
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
        <ListPageHeader title="Dispatch" />
        <p className="rounded-xl bg-white p-8 text-center text-[13px] text-[#777777] dark:bg-[#071929] dark:text-slate-400">
          You do not have access to Dispatch. Ask a super admin to tick it for your role in Roles &amp; Access.
        </p>
      </ListPage>
    );
  }

  const counts = result?.counts || {};
  const all = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  const rows = result?.data || [];

  return (
    <ListPage>
      <ListPageHeader title="Dispatch" refreshing={loading} onRefresh={load} />
      <p className="-mt-3 text-[13px] text-[#777777] dark:text-slate-400">
        Sales orders going out of your warehouses. Picking and packing move no stock; committing the dispatch does, once.
      </p>

      <StatGrid cols={5}>
        <StatCard label="Draft" value={counts.DRAFT ?? 0} caption="to be picked" />
        <StatCard label="Picked" value={counts.PICKED ?? 0} caption="to be packed" />
        <StatCard label="Ready to Dispatch" value={counts.PACKED ?? 0} caption="packed, awaiting commit" />
        <StatCard label="Dispatched" value={counts.DISPATCHED ?? 0} caption="awaiting proof of delivery" />
        <StatCard label="Delivered" value={counts.DELIVERED ?? 0} caption="proof of delivery recorded" />
      </StatGrid>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by dispatch number, sales order or customer"
        trailing={
          canStart ? (
            <PrimaryAction onClick={() => router.push("/inventory/dispatch/new")} icon={<FiPlus size={14} />}>
              New Dispatch
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
            { value: "DRAFT", label: "Draft", count: counts.DRAFT ?? 0 },
            { value: "PICKED", label: "Picked", count: counts.PICKED ?? 0 },
            { value: "PACKED", label: "Ready to Dispatch", count: counts.PACKED ?? 0 },
            { value: "DISPATCHED", label: "Dispatched", count: counts.DISPATCHED ?? 0 },
            { value: "DELIVERED", label: "Delivered", count: counts.DELIVERED ?? 0 },
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
            <span className="text-xs">Loading dispatch orders...</span>
          </div>
        ) : error ? (
          <p role="alert" className="px-5 py-12 text-center text-[13px] text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-[#777777] dark:text-slate-400">
            {query || status || warehouseId
              ? "No dispatch orders match."
              : warehouses.length === 0
                ? "You have no warehouses yet. Ask a super admin to give you warehouse access in Users."
                : "Nothing dispatched yet. Start with New Dispatch."}
          </p>
        ) : (
          <div className="max-h-[calc(100vh-380px)] min-h-[260px] overflow-auto">
            <table className={`w-full min-w-[1100px] text-left ${LIST_TABLE}`}>
              <thead className="sticky top-0 z-20">
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:bg-white dark:[&>th]:bg-[#071929]">
                  <th className={TH}>Dispatch No.</th>
                  <th className={TH}>Date</th>
                  <th className={TH}>Sales Order</th>
                  <th className={TH}>Customer</th>
                  <th className={TH}>Warehouse</th>
                  <th className={`${TH} text-right`}>Units</th>
                  <th className={TH}>Challan / Vehicle</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr
                    key={d.id}
                    className="cursor-pointer align-top text-[13px] text-[#141414] transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#0b2034]"
                    onClick={() => router.push(`/inventory/dispatch/${d.id}`)}
                  >
                    <td className="whitespace-nowrap px-5 py-4">
                      <Link
                        href={`/inventory/dispatch/${d.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-[12px] font-semibold text-[#233353] hover:underline dark:text-sky-300"
                      >
                        {d.do_number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-[12px]">{formatDate(d.dispatch_date)}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-[12px]">{d.order_number || d.sales_order_id}</td>
                    <td className="min-w-[180px] px-5 py-4">{d.customer_name || "-"}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-[12px]">{d.warehouse_name}</td>
                    <td className="px-5 py-4 text-right">{qty(d.total_qty)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-[12px]">
                      {d.challan_no || "-"}
                      {d.vehicle_number && <span className="block text-[11px] text-[#777777]">{d.vehicle_number}</span>}
                    </td>
                    <td className="px-5 py-4">
                      <DispatchStatusPill status={d.status} />
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
            noun="dispatch orders"
          />
        </div>
      </TableCard>
    </ListPage>
  );
}
