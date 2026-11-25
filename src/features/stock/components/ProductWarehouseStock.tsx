"use client";

/**
 * The Inventory product form's "Company Stock" section.
 *
 * Each company is one place with one store, so there is no warehouse or bin
 * to choose. Adding a product with an In-Stock quantity puts that quantity,
 * and its serials, straight into its company's store as it is saved. A
 * product shared by all companies is stocked by one of them: the person's
 * only company, or the one they pick here.
 *
 * On edit, the section shows what each company store holds of the product.
 * The form's own In-Stock figure is unchanged by this; stock already in a
 * store changes through the Stock page (adjustments, transfers, counts).
 */

import { useEffect, useMemo, useState } from "react";

import type { ScopeCompany } from "@/features/inventory/api/inventory.api";
import { hasPermission } from "@/features/auth/utils/permissions";
import { MyWarehouse, getMyWarehousesApi } from "@/features/locations/api/locations.api";
import { StockBalanceRow, getStockBalancesApi, putProductInStockApi } from "@/features/stock/api/stock.api";
import { errorText, qty } from "@/features/stock/components/stockUi";

const FIELD =
  "w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none transition-all focus:border-primary focus:bg-white dark:focus:bg-[#071929]";
const LABEL = "text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider";

/** Which company holds the stock of a new product, or "" when it is unclear. */
export function stockCompanyFor(productCompanyId: string, chosen: string, companies: ScopeCompany[]): string {
  if (productCompanyId) return productCompanyId;
  if (companies.length === 1) return companies[0].id;
  return chosen;
}

/**
 * After the product is saved: put its In-Stock into the company's store.
 * Returns a message to show, or null when there is nothing to put in. Never
 * throws: the product is already saved, so a failure is reported plainly.
 */
export async function sendProductStock(
  companyId: string,
  storeId: string,
  sku: string,
  quantity: number,
  serials: string[],
): Promise<{ ok: boolean; message: string } | null> {
  if (!(quantity > 0)) return null;
  if (!companyId) {
    return { ok: false, message: "The product is saved, but its stock was not put in a store: choose which company holds it." };
  }
  try {
    const done = await putProductInStockApi({
      company_id: companyId,
      warehouse_id: storeId || undefined,
      sku,
      quantity,
      serials: serials.length === quantity ? serials : [],
      request_id: crypto.randomUUID(),
    });
    return { ok: true, message: `${qty(done.quantity)} in stock at ${done.store} (${done.company_name}).` };
  } catch (err: unknown) {
    return {
      ok: false,
      message: `The product is saved, but its stock was not put in the store: ${errorText(err, "it could not be posted")}. Add it on Stock > Opening Stock.`,
    };
  }
}

export default function ProductWarehouseStock({
  mode,
  productCompanyId,
  companies,
  sku,
  chosenCompanyId,
  onChooseCompany,
  chosenStoreId,
  onChooseStore,
}: {
  mode: "create" | "edit";
  /** The product's company; empty for a product shared by all companies. */
  productCompanyId: string;
  companies: ScopeCompany[];
  sku: string;
  chosenCompanyId?: string;
  onChooseCompany?: (id: string) => void;
  /** When the holding company has several stores: the one chosen. */
  chosenStoreId?: string;
  onChooseStore?: (id: string) => void;
}) {
  const canView = hasPermission("stock.read");
  const [held, setHeld] = useState<StockBalanceRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stores, setStores] = useState<MyWarehouse[]>([]);

  /* On create: the stores this person may use, to ask which one when the
     company has several. */
  useEffect(() => {
    if (mode !== "create") return;
    getMyWarehousesApi()
      .then(setStores)
      .catch((err: unknown) => setLoadError(errorText(err, "Could not load your stores.")));
  }, [mode]);

  const holder = stockCompanyFor(productCompanyId, chosenCompanyId || "", companies);
  const holderStores = useMemo(() => stores.filter((w) => w.company_id === holder), [stores, holder]);
  const defaultStore = holderStores.find((w) => w.is_default) || holderStores[0];

  /* Several stores: start on the default one, and follow a change of company. */
  useEffect(() => {
    if (mode !== "create" || !onChooseStore) return;
    if (holderStores.length > 1 && !holderStores.some((w) => w.id === chosenStoreId)) onChooseStore(defaultStore?.id || "");
    if (holderStores.length <= 1 && chosenStoreId) onChooseStore("");
  }, [mode, holderStores, chosenStoreId, defaultStore, onChooseStore]);

  /* On edit: what each company store holds of this product. */
  const wanted = sku.trim().toUpperCase();
  useEffect(() => {
    if (mode !== "edit" || !canView || !wanted) return;
    getStockBalancesApi({ search: wanted, size: 100 })
      .then((page) => setHeld(page.data.filter((b) => b.sku === wanted)))
      .catch((err: unknown) => setLoadError(errorText(err, "Could not load this product's stock.")));
  }, [mode, canView, wanted]);

  if (mode === "edit" && !canView) return null;

  const productCompany = companies.find((c) => c.id === productCompanyId);
  const needsChoice = mode === "create" && !productCompanyId && companies.length > 1;

  /* Each company store's figures for the product, added up across statuses. */
  const byStore = new Map<string, { name: string; company: string; onHand: number; available: number; other: number }>();
  for (const b of held || []) {
    const row = byStore.get(b.warehouse_id) || {
      name: b.warehouse_name || "Store",
      company: b.company_name || "",
      onHand: 0,
      available: 0,
      other: 0,
    };
    if (b.stock_status === "UNRESTRICTED") {
      row.onHand += b.qty_on_hand;
      row.available += b.qty_available;
    } else {
      row.other += b.qty_on_hand;
    }
    byStore.set(b.warehouse_id, row);
  }

  return (
    <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-[#0d2336]">
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">Company Stock</h4>

      {loadError && (
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600">
          {loadError}
        </p>
      )}

      {mode === "create" && (
        <>
          <p className="text-[12px] text-slate-500">
            {productCompany
              ? `The In-Stock quantity and serials go into ${productCompany.company_name}'s store as soon as the product is saved.`
              : companies.length === 1
                ? `The In-Stock quantity and serials go into ${companies[0].company_name}'s store as soon as the product is saved.`
                : "A shared product's stock is held by one company. Choose which, and the In-Stock quantity and serials go into its store as soon as the product is saved."}
          </p>
          {holderStores.length > 1 && (
            <div className="space-y-1.5">
              <label htmlFor="stock-store" className={LABEL}>
                Store *
              </label>
              <select
                id="stock-store"
                className={FIELD}
                value={chosenStoreId || ""}
                onChange={(e) => onChooseStore?.(e.target.value)}
              >
                {holderStores.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.location_name}
                    {w.is_default ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          {needsChoice && (
            <div className="space-y-1.5">
              <label htmlFor="stock-company" className={LABEL}>
                Stock Held By *
              </label>
              <select
                id="stock-company"
                className={FIELD}
                value={chosenCompanyId || ""}
                onChange={(e) => onChooseCompany?.(e.target.value)}
              >
                <option value="">Select company...</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {mode === "edit" && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-[#0d2336]">
            <table className="w-full min-w-[380px] text-left text-[13px]">
              <thead>
                <tr className="text-[12px] text-slate-500">
                  <th className="px-3 py-2 font-normal">Store</th>
                  <th className="px-3 py-2 text-right font-normal">In Stock</th>
                  <th className="px-3 py-2 text-right font-normal">Free to Sell</th>
                  <th className="px-3 py-2 text-right font-normal">Held Back</th>
                </tr>
              </thead>
              <tbody>
                {held === null ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-slate-400">
                      Loading...
                    </td>
                  </tr>
                ) : byStore.size === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-slate-500">
                      Not in stock at any of your company stores.
                    </td>
                  </tr>
                ) : (
                  [...byStore.entries()].map(([id, s]) => (
                    <tr key={id} className="border-t border-slate-100 dark:border-[#0d2336]">
                      <td className="px-3 py-2">
                        {s.name}
                        <span className="block text-[11px] text-slate-500">{s.company}</span>
                      </td>
                      <td className="px-3 py-2 text-right">{qty(s.onHand)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{qty(s.available)}</td>
                      <td className="px-3 py-2 text-right text-slate-500">{s.other ? qty(s.other) : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-slate-500">
            Held back is stock in quality check, rejected or damaged. To change store stock, use the Stock page (adjustments, transfers, counts).
          </p>
        </>
      )}
    </div>
  );
}
