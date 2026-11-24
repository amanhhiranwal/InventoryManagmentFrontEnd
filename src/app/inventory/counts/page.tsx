"use client";

/**
 * Stock Count, under SCM: counting what is on the shelf.
 *
 * Starting a count copies what the ledger says each store bin holds; the
 * counter enters what is really there; someone else approves it, and only
 * then are the differences posted as adjustments.
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
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { hasPermission } from "@/features/auth/utils/permissions";
import { WarehouseBin, getBinsApi, getMyWarehousesApi, MyWarehouse } from "@/features/locations/api/locations.api";
import { CountStatus, Page, StockCount, createCountApi, getCountsApi } from "@/features/stock/api/transfers.api";
import { CountStatusPill, SELECT, TH, errorText, money } from "@/features/stock/components/stockUi";
import { formatDate, toDateInput } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

const PAGE_SIZE = 20;
const FIELD =
  "w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-primary focus:bg-white dark:focus:bg-[#071929]";
const LABEL = "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider";

function StartCount({ warehouses, onClose, onStarted }: { warehouses: MyWarehouse[]; onClose: () => void; onStarted: (c: StockCount) => void }) {
  const { addToast } = useUIStore();
  const [warehouseId, setWarehouseId] = useState(warehouses.length === 1 ? warehouses[0].id : "");
  const [binId, setBinId] = useState("");
  const [date, setDate] = useState(toDateInput(new Date()));
  const [remarks, setRemarks] = useState("");
  const [bins, setBins] = useState<WarehouseBin[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!warehouseId) return;
    getBinsApi(warehouseId)
      .then((rows) => setBins(rows.filter((b) => b.bin_type === "STORE")))
      .catch((err: unknown) => addToast(errorText(err, "Could not load the bins."), "error"));
  }, [warehouseId, addToast]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) return addToast("Choose the warehouse to count.", "warning");
    try {
      setSaving(true);
      const started = await createCountApi({
        warehouse_id: warehouseId,
        bin_id: binId || undefined,
        count_date: date || undefined,
        remarks: remarks.trim() || undefined,
      });
      addToast(`${started.count_number} started with ${started.lines.length} line(s) to count.`, "success");
      onStarted(started);
    } catch (err: unknown) {
      addToast(errorText(err, "Could not start the count."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Start a Stock Count" size="lg">
      <form onSubmit={start} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="count-warehouse" className={LABEL}>
              Warehouse *
            </label>
            <select
              id="count-warehouse"
              className={FIELD}
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                setBinId("");
              }}
            >
              <option value="">Select warehouse...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.location_name} ({w.location_code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="count-bin" className={LABEL}>
              Bin
            </label>
            <select id="count-bin" className={FIELD} disabled={!warehouseId} value={binId} onChange={(e) => setBinId(e.target.value)}>
              <option value="">Every store bin</option>
              {bins.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
          </div>
          <Input label="Count Date *" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Remarks" placeholder="e.g. Monthly count, rack A" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 dark:border-[#0d2336]">
          <p className="text-xs text-slate-500">Available stock is copied now. Avoid moving stock in these bins until the count is approved.</p>
          <div className="flex gap-3">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Start Count
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function StockCountsPage() {
  const router = useRouter();
  const canView = hasPermission("stock.read");
  const canCreate = hasPermission("stock.count.create");

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [warehouses, setWarehouses] = useState<MyWarehouse[]>([]);
  const [result, setResult] = useState<Page<StockCount, CountStatus> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
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
      const answer = await getCountsApi({
        warehouse_id: warehouseId || undefined,
        status: status || undefined,
        search: query || undefined,
        page,
        size: PAGE_SIZE,
      });
      if (request === latest.current) setResult(answer);
    } catch (err: unknown) {
      if (request === latest.current) setError(errorText(err, "Could not load stock counts."));
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
        <ListPageHeader title="Stock Count" />
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
      <ListPageHeader title="Stock Count" refreshing={loading} onRefresh={load} />
      <p className="-mt-3 text-[13px] text-[#777777] dark:text-slate-400">
        Count the shelf against the ledger. Differences change stock only when someone other than the counter approves them.
      </p>

      <StatGrid cols={4}>
        <StatCard label="Counting" value={counts.OPEN ?? 0} caption="started, being counted" />
        <StatCard label="Awaiting Approval" value={counts.SUBMITTED ?? 0} caption="counted, nothing posted" />
        <StatCard label="Posted" value={counts.POSTED ?? 0} caption="differences adjusted" />
        <StatCard label="Cancelled" value={counts.CANCELLED ?? 0} caption="stopped, nothing posted" />
      </StatGrid>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by count number"
        trailing={
          canCreate ? (
            <PrimaryAction onClick={() => setStarting(true)} icon={<FiPlus size={14} />}>
              New Count
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
            { value: "OPEN", label: "Counting", count: counts.OPEN ?? 0 },
            { value: "SUBMITTED", label: "Awaiting Approval", count: counts.SUBMITTED ?? 0 },
            { value: "POSTED", label: "Posted", count: counts.POSTED ?? 0 },
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
            <span className="text-xs">Loading stock counts...</span>
          </div>
        ) : error ? (
          <p role="alert" className="px-5 py-12 text-center text-[13px] text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-[#777777] dark:text-slate-400">
            {query || status || warehouseId
              ? "No counts match."
              : warehouses.length === 0
                ? "You have no warehouses yet. Ask a super admin to give you warehouse access in Users."
                : canCreate
                  ? "No counts yet. Start with New Count."
                  : "No counts yet."}
          </p>
        ) : (
          <div className="max-h-[calc(100vh-380px)] min-h-[260px] overflow-auto">
            <table className={`w-full min-w-[900px] text-left ${LIST_TABLE}`}>
              <thead className="sticky top-0 z-20">
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:bg-white dark:[&>th]:bg-[#071929]">
                  <th className={TH}>Count No.</th>
                  <th className={TH}>Date</th>
                  <th className={TH}>Warehouse / Bin</th>
                  <th className={`${TH} text-right`}>Lines Counted</th>
                  <th className={`${TH} text-right`}>Differences</th>
                  <th className={`${TH} text-right`}>Value of Differences</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer align-top text-[13px] text-[#141414] transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#0b2034]"
                    onClick={() => router.push(`/inventory/counts/${c.id}`)}
                  >
                    <td className="whitespace-nowrap px-5 py-4">
                      <Link
                        href={`/inventory/counts/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono text-[12px] font-semibold text-[#233353] hover:underline dark:text-sky-300"
                      >
                        {c.count_number}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-[12px]">{formatDate(c.count_date)}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-[12px]">
                      {c.warehouse_name}
                      <span className="block text-[11px] text-[#777777]">{c.bin_code ? `Bin ${c.bin_code}` : "Every store bin"}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {c.lines_counted} / {c.lines.length}
                    </td>
                    <td className="px-5 py-4 text-right">{c.status === "OPEN" ? "—" : c.lines_with_variance}</td>
                    <td className="px-5 py-4 text-right">{c.status === "OPEN" ? "—" : money(c.variance_value)}</td>
                    <td className="px-5 py-4">
                      <CountStatusPill status={c.status} />
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
            noun="counts"
          />
        </div>
      </TableCard>

      {starting && (
        <StartCount
          warehouses={warehouses}
          onClose={() => setStarting(false)}
          onStarted={(c) => {
            setStarting(false);
            router.push(`/inventory/counts/${c.id}`);
          }}
        />
      )}
    </ListPage>
  );
}
