"use client";

/**
 * New Dispatch: find the sales order, see what each line needs against
 * what the warehouse holds, reserve stock, and create a dispatch order for
 * some or all of what is reserved. Reserving moves no stock; it holds it.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiPackage, FiSearch, FiTruck } from "react-icons/fi";

import { ListPage } from "@/components/crm/ListPageShell";
import Button from "@/components/ui/Button";
import { hasPermission } from "@/features/auth/utils/permissions";
import { getMyWarehousesApi, MyWarehouse } from "@/features/locations/api/locations.api";
import { getSalesOrdersPageApi, SalesOrderModel } from "@/features/salesOrders/api/salesOrders.api";
import {
  Availability,
  createDispatchApi,
  getAvailabilityApi,
  releaseStockApi,
  reserveStockApi,
} from "@/features/stock/api/dispatch.api";
import { errorText, qty } from "@/features/stock/components/stockUi";
import { useUIStore } from "@/lib/store/ui.store";

const CARD = "rounded-xl border border-slate-200 bg-white p-5 dark:border-[#17304a] dark:bg-[#071929]";
const FIELD =
  "w-full rounded-lg border border-[#cccccc] bg-white px-3 py-2 text-[13px] text-[#141414] outline-none transition focus:border-[#233353] disabled:bg-slate-50 disabled:text-slate-500 dark:border-[#17304a] dark:bg-[#071929] dark:text-white";
const TH = "px-2 py-2 font-normal";

function NewDispatch() {
  const router = useRouter();
  const params = useSearchParams();
  const { addToast } = useUIStore();
  const canReserve = hasPermission("stock.reserve");
  const canCreate = hasPermission("dispatch.manage");

  const [warehouses, setWarehouses] = useState<MyWarehouse[]>([]);
  const [search, setSearch] = useState("");
  const [found, setFound] = useState<SalesOrderModel[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(params.get("order") ? Number(params.get("order")) : null);
  const [warehouseId, setWarehouseId] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reserveQty, setReserveQty] = useState<Record<number, string>>({});
  const [dispatchQty, setDispatchQty] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<"reserve" | "release" | "create" | null>(null);

  useEffect(() => {
    getMyWarehousesApi()
      .then((rows) => {
        setWarehouses(rows);
        if (rows.length === 1) setWarehouseId(rows[0].id);
      })
      .catch((err: unknown) => setLoadError(errorText(err, "Could not load your warehouses.")));
  }, []);

  const findOrders = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!search.trim()) return;
    try {
      setSearching(true);
      const page = await getSalesOrdersPageApi({ page: 1, size: 10, search: search.trim() });
      setFound(page.orders);
    } catch (err: unknown) {
      addToast(errorText(err, "Could not search sales orders."), "error");
    } finally {
      setSearching(false);
    }
  };

  const load = useCallback(async (id: number, wh: string) => {
    try {
      setLoadError(null);
      const answer = await getAvailabilityApi(id, wh || undefined);
      setAvailability(answer);
      if (answer.fixed_warehouse_id) setWarehouseId(answer.fixed_warehouse_id);
      setReserveQty({});
      setDispatchQty({});
    } catch (err: unknown) {
      setAvailability(null);
      setLoadError(errorText(err, "Could not load this order's availability."));
    }
  }, []);

  useEffect(() => {
    if (orderId && warehouseId) load(orderId, warehouseId);
  }, [orderId, warehouseId, load]);

  const numbers = (values: Record<number, string>) =>
    Object.entries(values)
      .filter(([, v]) => v.trim() !== "")
      .map(([k, v]) => ({ so_line_id: Number(k), qty: Number(v) }));

  const reserve = async () => {
    if (!availability) return;
    const lines = numbers(reserveQty);
    if (lines.length === 0) return addToast("Enter how many to reserve on at least one line.", "warning");
    if (lines.some((l) => !Number.isFinite(l.qty) || l.qty <= 0)) return addToast("Reserve quantities must be above zero.", "warning");
    try {
      setBusy("reserve");
      setAvailability(await reserveStockApi(availability.sales_order_id, warehouseId, lines));
      setReserveQty({});
      addToast("Stock reserved for the order.", "success");
    } catch (err: unknown) {
      addToast(errorText(err, "Could not reserve stock."), "error");
    } finally {
      setBusy(null);
    }
  };

  const release = async () => {
    if (!availability) return;
    const reason = window.prompt("Why is the reservation being released?");
    if (reason === null) return;
    if (!reason.trim()) return addToast("Say why it is released.", "warning");
    try {
      setBusy("release");
      setAvailability(await releaseStockApi(availability.sales_order_id, reason.trim()));
      addToast("Reservation released. The stock is available again.", "success");
    } catch (err: unknown) {
      addToast(errorText(err, "Could not release the reservation."), "error");
    } finally {
      setBusy(null);
    }
  };

  const create = async () => {
    if (!availability) return;
    const lines = numbers(dispatchQty);
    if (lines.length === 0) return addToast("Enter how many to dispatch on at least one line.", "warning");
    if (lines.some((l) => !Number.isFinite(l.qty) || l.qty <= 0)) return addToast("Dispatch quantities must be above zero.", "warning");
    try {
      setBusy("create");
      const created = await createDispatchApi({ sales_order_id: availability.sales_order_id, lines });
      addToast(`Dispatch ${created.do_number} created.`, "success");
      router.push(`/inventory/dispatch/${created.id}`);
    } catch (err: unknown) {
      addToast(errorText(err, "Could not create the dispatch order."), "error");
    } finally {
      setBusy(null);
    }
  };

  if (!canReserve && !canCreate) {
    return (
      <p className="rounded-xl bg-white p-8 text-center text-[13px] text-[#777777] dark:bg-[#071929]">
        You cannot reserve stock or create dispatch orders. Ask a super admin for them in Roles &amp; Access.
      </p>
    );
  }

  const reservedAny = availability?.lines.some((l) => l.qty_reserved > 0) ?? false;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">New Dispatch</h1>
        <Button variant="outline" size="sm" onClick={() => router.push("/inventory/stock-out?view=dispatch")}>
          Cancel
        </Button>
      </div>

      <section className={CARD}>
        <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-900 dark:text-white">
          <FiSearch /> Sales Order
        </h2>
        <form onSubmit={findOrders} className="flex flex-col gap-3 sm:flex-row">
          <input
            aria-label="Search sales orders"
            className={FIELD}
            placeholder="Sales order number or customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" size="sm" loading={searching}>
            Find
          </Button>
        </form>
        {found && (
          <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-[#17304a] dark:border-[#17304a]">
            {found.length === 0 && <li className="px-3 py-3 text-[13px] text-[#777777]">No sales orders match.</li>}
            {found.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOrderId(o.id);
                    setFound(null);
                  }}
                  className={`flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50 dark:hover:bg-[#0b2034] ${
                    o.id === orderId ? "bg-slate-50 dark:bg-[#0b2034]" : ""
                  }`}
                >
                  <span className="font-mono font-semibold">{o.order_number || o.id}</span>
                  <span className="flex-1 truncate">{o.customer_name}</span>
                  <span className="text-[11px] text-[#777777]">{String(o.status).replace(/_/g, " ")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <label className="mt-4 block max-w-md space-y-1">
          <span className="text-[12px] text-[#777777]">Ships From (warehouse) *</span>
          <select
            className={FIELD}
            value={warehouseId}
            disabled={!!availability?.fixed_warehouse_id}
            onChange={(e) => setWarehouseId(e.target.value)}
          >
            <option value="">Select warehouse</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.location_name} ({w.location_code}){w.company_name ? ` · ${w.company_name}` : ""}
              </option>
            ))}
          </select>
          {availability?.fixed_warehouse_id && (
            <span className="block text-[11px] text-[#777777]">Fixed by the stock already reserved for this order.</span>
          )}
        </label>
      </section>

      {loadError && (
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-[13px] text-rose-600">
          {loadError}
        </p>
      )}

      {orderId && warehouseId && !availability && !loadError && (
        <div className="flex justify-center py-10 text-slate-400">
          <CgSpinner className="animate-spin text-3xl" />
        </div>
      )}

      {availability && (
        <section className={CARD}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold text-slate-900 dark:text-white">
              <FiPackage /> {availability.order_number || availability.sales_order_id} · {availability.customer_name}
            </h2>
            <span className="text-[12px] text-[#777777]">
              {availability.warehouse_name} · order {String(availability.status).replace(/_/g, " ").toLowerCase()}
            </span>
          </div>
          {availability.lines.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-[#777777]">This order has no goods lines to dispatch.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-[#e2e2e2] text-[12px] text-[#777777] dark:border-[#17304a]">
                    <th className={TH}>Product</th>
                    <th className={`${TH} text-right`}>Ordered</th>
                    <th className={`${TH} text-right`}>Dispatched</th>
                    <th className={`${TH} text-right`}>Reserved</th>
                    <th className={`${TH} text-right`}>Available Here</th>
                    <th className={`${TH} text-right`}>Other Warehouses</th>
                    <th className={`${TH} text-right`}>On Order</th>
                    <th className={`${TH} text-right`}>Short</th>
                    {canReserve && <th className={TH}>Reserve</th>}
                    {canCreate && <th className={TH}>Dispatch Now</th>}
                  </tr>
                </thead>
                <tbody>
                  {availability.lines.map((line) => {
                    const free = line.qty_reserved - line.qty_on_dispatch;
                    return (
                      <tr key={line.so_line_id} className="align-top">
                        <td className="min-w-[220px] px-2 py-3">
                          <span className="block font-semibold">{line.product_name || line.sku}</span>
                          <span className="font-mono text-[11px] text-[#777777]">{line.sku}</span>
                        </td>
                        <td className="px-2 py-3 text-right">{qty(line.qty_ordered)}</td>
                        <td className="px-2 py-3 text-right">{qty(line.qty_dispatched)}</td>
                        <td className="px-2 py-3 text-right">
                          {qty(line.qty_reserved)}
                          {line.qty_on_dispatch > 0 && (
                            <span className="block text-[11px] text-[#777777]">{qty(line.qty_on_dispatch)} on dispatch</span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-right font-semibold text-emerald-600">{qty(line.available_here)}</td>
                        <td className="px-2 py-3 text-right text-[#777777]">{qty(line.available_other_warehouses)}</td>
                        <td className="px-2 py-3 text-right text-[#777777]">{qty(line.on_order)}</td>
                        <td className={`px-2 py-3 text-right font-semibold ${line.shortage > 0 ? "text-rose-600" : ""}`}>
                          {qty(line.shortage)}
                        </td>
                        {canReserve && (
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              aria-label={`Reserve ${line.sku}`}
                              placeholder={String(Math.max(0, line.qty_remaining - line.qty_reserved))}
                              className={`${FIELD} w-24`}
                              value={reserveQty[line.so_line_id] ?? ""}
                              onChange={(e) => setReserveQty({ ...reserveQty, [line.so_line_id]: e.target.value })}
                            />
                          </td>
                        )}
                        {canCreate && (
                          <td className="px-2 py-2">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              aria-label={`Dispatch ${line.sku}`}
                              placeholder={free > 0 ? String(free) : "0"}
                              disabled={free <= 0}
                              className={`${FIELD} w-24`}
                              value={dispatchQty[line.so_line_id] ?? ""}
                              onChange={(e) => setDispatchQty({ ...dispatchQty, [line.so_line_id]: e.target.value })}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[12px] text-[#777777]">
            Reserving holds available stock for this order without moving it. A dispatch can only take what is reserved and
            not already on another dispatch.
          </p>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {canReserve && reservedAny && (
              <Button variant="outline" size="sm" loading={busy === "release"} disabled={!!busy} onClick={release}>
                Release Reservation
              </Button>
            )}
            {canReserve && (
              <Button variant="outline" size="sm" loading={busy === "reserve"} disabled={!!busy} onClick={reserve}>
                Reserve Stock
              </Button>
            )}
            {canCreate && (
              <Button size="sm" icon={<FiTruck />} loading={busy === "create"} disabled={!!busy || !reservedAny} onClick={create}>
                Create Dispatch Order
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default function NewDispatchPage() {
  return (
    <ListPage>
      {/* useSearchParams needs a Suspense boundary in the App Router. */}
      <Suspense
        fallback={
          <div className="flex justify-center py-16 text-slate-400">
            <CgSpinner className="animate-spin text-3xl" />
          </div>
        }
      >
        <NewDispatch />
      </Suspense>
    </ListPage>
  );
}
