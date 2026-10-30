"use client";

/**
 * Stock Out, under SCM.
 *
 * Every unit that has left inventory for an order, read from the records
 * the desks write as it goes: the serial, what it is, the order and the
 * customer, where it is going, who issued it and when. Nothing here is
 * worked out afresh - it is the stored record, shown in the Inventory
 * page's format.
 *
 * Its own permission, stock_out.read: a super admin sees it, and Roles &
 * Access can give it to anyone else. A unit whose order was held or
 * cancelled afterwards came back; it stays listed, marked returned.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CgSpinner } from "react-icons/cg";

import {
  LIST_TABLE,
  ListPage,
  ListPageHeader,
  ListToolbar,
  StatGrid,
  TableCard,
} from "@/components/crm/ListPageShell";
import Pagination from "@/components/crm/Pagination";
import QueueTabs from "@/components/crm/QueueTabs";
import StatCard from "@/components/crm/StatCard";
import { hasPermission } from "@/features/auth/utils/permissions";
import {
  getStockOutApi,
  type StockOutPage,
} from "@/features/inventory/api/inventory.api";
import { formatDateTime } from "@/lib/datetime";

const PAGE_SIZE = 20;

/** Wait this long after the last keystroke before searching. */
const SEARCH_DELAY_MS = 300;

type View = "out" | "returned" | null;

const TH =
  "px-5 py-3 text-[12px] font-normal text-[#777777] dark:text-slate-400";

export default function StockOutPage() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>(null);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<StockOutPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Which request is the newest: a slower, older answer arriving late
     must not replace what the table shows for the current search. */
  const latest = useRef(0);

  const canOpenOrders = hasPermission("order.read");

  /* The search waits for a pause in typing, and starts again from page one. */
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);

    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const request = ++latest.current;

    setLoading(true);
    setError(null);

    try {
      const answer = await getStockOutApi({
        search: query || undefined,
        view: view ?? undefined,
        page,
        size: PAGE_SIZE,
      });

      if (request === latest.current) setResult(answer);
    } catch (failure: unknown) {
      const detail = (failure as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail;

      if (request === latest.current) {
        setError(detail || "Could not load stock out records.");
      }
      throw failure;
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [query, view, page]);

  useEffect(() => {
    load().catch(() => {
      /* Shown on the page by load itself. */
    });
  }, [load]);

  const summary = result?.summary;
  const counts = result?.counts;
  const rows = result?.rows || [];

  return (
    <ListPage>
      <ListPageHeader title="Stock Out" refreshing={loading} onRefresh={load} />

      <p className="-mt-3 text-[13px] text-[#777777] dark:text-slate-400">
        Every unit issued from inventory to an order: which serial, for whom,
        where it went, and who sent it.
      </p>

      <StatGrid cols={4}>
        <StatCard
          label="Units Out"
          value={summary?.units_out ?? "—"}
          caption="issued and still out"
        />
        <StatCard
          label="Orders"
          value={summary?.orders ?? "—"}
          caption="with units out"
        />
        <StatCard
          label="Last 30 Days"
          value={summary?.last_30_days ?? "—"}
          caption="units issued"
        />
        <StatCard
          label="Returned"
          value={summary?.returned ?? "—"}
          caption="put back after a hold or cancel"
        />
      </StatGrid>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by serial, product, order, customer or place"
      />

      <TableCard>
        <QueueTabs
          tabs={[
            { value: null, label: "All", count: counts?.all ?? 0 },
            { value: "out", label: "Out", count: counts?.out ?? 0 },
            {
              value: "returned",
              label: "Returned",
              count: counts?.returned ?? 0,
            },
          ]}
          active={view}
          onChange={(value) => {
            setView(value as View);
            setPage(1);
          }}
        />

        {loading && !result ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
            <CgSpinner className="animate-spin text-3xl text-primary" />
            <span className="text-xs">Loading stock out records...</span>
          </div>
        ) : error ? (
          <p
            role="alert"
            className="px-5 py-12 text-center text-[13px] text-rose-600 dark:text-rose-400"
          >
            {error}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-[#777777] dark:text-slate-400">
            {query || view
              ? "No units match."
              : "Nothing has been issued from inventory yet."}
          </p>
        ) : (
          <div className="max-h-[calc(100vh-360px)] min-h-[260px] overflow-auto">
            <table className={`w-full min-w-[1400px] text-left ${LIST_TABLE}`}>
              <thead className="sticky top-0 z-20">
                <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:bg-white dark:[&>th]:bg-[#071929]">
                  <th className={TH}>Serial Number</th>
                  <th className={TH}>Item Name</th>
                  <th className={TH}>Model Number</th>
                  <th className={TH}>Qty</th>
                  <th className={TH}>Order</th>
                  <th className={TH}>Customer</th>
                  <th className={TH}>Sent To</th>
                  <th className={TH}>Issued By</th>
                  <th className={TH}>Issued On</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="align-top text-[13px] text-[#141414] transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#0b2034]"
                  >
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-[12px] font-semibold">
                      {row.by_serial ? row.serial_number || "—" : "—"}
                      {!row.by_serial && (
                        <span className="mt-1 block font-sans text-[11px] font-normal text-[#777777] dark:text-slate-400">
                          Counted by quantity
                        </span>
                      )}
                    </td>
                    <td className="min-w-[220px] px-5 py-4">
                      <span className="font-semibold">
                        {row.product || "—"}
                      </span>
                      {row.line_product && (
                        <span className="mt-1 block text-[11px] text-[#777777] dark:text-slate-400">
                          {row.line_product}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-[12px]">
                      {row.model_number || "—"}
                    </td>
                    <td className="px-5 py-4">{row.quantity}</td>
                    <td className="px-5 py-4">
                      {row.order_id && canOpenOrders ? (
                        <Link
                          href={`/sales/orders/${row.order_id}`}
                          className="whitespace-nowrap font-semibold text-[#233353] hover:underline dark:text-sky-300"
                        >
                          {row.order_number || row.order_id}
                        </Link>
                      ) : (
                        <span className="font-semibold">
                          {row.order_number || "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">{row.customer_name || "—"}</td>
                    <td className="min-w-[240px] max-w-[320px] px-5 py-4 text-[12px] text-[#555555] dark:text-slate-300">
                      {row.place || row.state || "—"}
                    </td>
                    <td className="px-5 py-4 text-[12px]">
                      {row.actor || "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-[12px]">
                      {formatDateTime(row.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      {row.returned ? (
                        <span
                          title={`Returned ${formatDateTime(row.returned_at)}`}
                          className="rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-600 dark:bg-amber-950/30 dark:text-amber-400"
                        >
                          Returned
                        </span>
                      ) : (
                        <span className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                          Out
                        </span>
                      )}
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
            totalPages={Math.max(
              1,
              Math.ceil((result?.total ?? 0) / PAGE_SIZE),
            )}
            onPageChange={setPage}
            noun="units"
          />
        </div>
      </TableCard>
    </ListPage>
  );
}
