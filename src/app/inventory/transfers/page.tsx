"use client";

/**
 * Transfers, under SCM: moving stock between two warehouses of one company.
 *
 * Requested, approved by someone else, shipped (stock leaves the sending
 * warehouse and is in transit) and received at the other end, with any
 * shortage or damage recorded. Lists transfers that leave from or arrive at
 * a warehouse the person works in.
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
import { Page, Transfer, TransferStatus, getTransfersApi } from "@/features/stock/api/transfers.api";
import TransferForm from "@/features/stock/components/TransferForm";
import { SELECT, TH, TransferStatusPill, errorText, qty } from "@/features/stock/components/stockUi";
import { formatDate } from "@/lib/datetime";

const PAGE_SIZE = 20;

export default function TransfersPage() {
  const router = useRouter();
  const canView = hasPermission("stock.read");
  const canCreate = hasPermission("transfer.create");

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [warehouses, setWarehouses] = useState<MyWarehouse[]>([]);
  const [result, setResult] = useState<Page<Transfer, TransferStatus> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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
      const answer = await getTransfersApi({
        warehouse_id: warehouseId || undefined,
        status: status || undefined,
        search: query || undefined,
        page,
        size: PAGE_SIZE,
      });
      if (request === latest.current) setResult(answer);
    } catch (err: unknown) {
      if (request === latest.current) setError(errorText(err, "Could not load transfers."));
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
        <ListPageHeader title="Transfers" />
        <p className="rounded-xl bg-white p-8 text-center text-[13px] text-[#777777] dark:bg-[#071929] dark:text-slate-400">
          You do not have access to warehouse stock. Ask a super admin to tick it for your role in Roles &amp; Access.
        </p>
      </ListPage>
    );
  }

  const counts = result?.counts || {};
  const all = Object.values(counts).reduce((a, b) => a + (b || 0), 0);
  const rows = result?.data || [];

  return (
    <ListPage>
      <ListPageHeader title="Transfers" refreshing={loading} onRefresh={load} />
      <p className="-mt-3 text-[13px] text-[#777777] dark:text-slate-400">
        Stock moving between warehouses of the same company. It leaves when the transfer ships and is in transit until received.
      </p>

      <StatGrid cols={4}>
        <StatCard label="Awaiting Approval" value={counts.SUBMITTED ?? 0} caption="requested, nothing moved" />
        <StatCard label="Ready to Ship" value={counts.APPROVED ?? 0} caption="approved, still on the shelf" />
        <StatCard label="In Transit" value={counts.SHIPPED ?? 0} caption="shipped, awaiting receipt" />
        <StatCard label="Received" value={counts.RECEIVED ?? 0} caption="closed at the other end" />
      </StatGrid>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by transfer number"
        trailing={
          canCreate ? (
            <PrimaryAction onClick={() => setCreating(true)} icon={<FiPlus size={14} />}>
              New Transfer
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
            { value: "SUBMITTED", label: "Awaiting Approval", count: counts.SUBMITTED ?? 0 },
            { value: "APPROVED", label: "Ready to Ship", count: counts.APPROVED ?? 0 },
            { value: "SHIPPED", label: "In Transit", count: counts.SHIPPED ?? 0 },
            { value: "RECEIVED", label: "Received", count: counts.RECEIVED ?? 0 },
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
            <span className="text-xs">Loading transfers...</span>
          </div>
        ) : error ? (
          <p role="alert" className="px-5 py-12 text-center text-[13px] text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-[#777777] dark:text-slate-400">
            {query || status || warehouseId
              ? "No transfers match."
              : warehouses.length === 0
                ? "You have no warehouses yet. Ask a super admin to give you warehouse access in Users."
                : canCreate
                  ? "No transfers yet. Start with New Transfer."
                  : "No transfers yet."}
          </p>
        ) : (
          <div className="max-h-[calc(100vh-380px)] min-h-[260px] overflow-auto">
            <table className={`w-full min-w-[1000px] text-left ${LIST_TABLE}`}>
              <thead className="sticky top-0 z-20">
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:bg-white dark:[&>th]:bg-[#071929]">
                  <th className={TH}>Transfer No.</th>
                  <th className={TH}>Date</th>
                  <th className={TH}>From</th>
                  <th className={TH}>To</th>
                  <th className={`${TH} text-right`}>Units</th>
                  <th className={TH}>Requested By</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    className="cursor-pointer align-top text-[13px] text-[#141414] transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#0b2034]"
                    onClick={() => router.push(`/inventory/transfers/${t.id}`)}
                  >
                    <td className="whitespace-nowrap px-5 py-4">
                      <Link
                        href={`/inventory/transfers/${t.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-[12px] font-semibold text-[#233353] hover:underline dark:text-sky-300"
                      >
                        {t.transfer_number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-[12px]">{formatDate(t.transfer_date)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-[12px]">{t.from_warehouse_name}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-[12px]">{t.to_warehouse_name}</td>
                    <td className="px-5 py-4 text-right">{qty(t.total_quantity)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-[12px]">{t.created_by_name || "-"}</td>
                    <td className="px-5 py-4">
                      <TransferStatusPill status={t.status} />
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
            noun="transfers"
          />
        </div>
      </TableCard>

      {creating && (
        <TransferForm
          warehouses={warehouses}
          editing={null}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setCreating(false);
            router.push(`/inventory/transfers/${saved.id}`);
          }}
        />
      )}
    </ListPage>
  );
}
