"use client";

/**
 * Warehouse, under SCM.
 *
 * What each warehouse holds, read from the stock ledger: on hand, reserved
 * and available, and stock held back in quarantine or as rejected. The
 * Ledger tab is every movement behind those figures; Opening Stock is how
 * a warehouse's starting quantities come in - prepared by one person,
 * approved and posted by another.
 *
 * Everything is limited, on the server, to the warehouses the signed-in
 * person works in (Users > Warehouse Access); a super admin sees all.
 * Products themselves stay in the Inventory catalogue.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiChevronDown, FiPlus } from "react-icons/fi";

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
import {
  LedgerRow,
  OpeningDocument,
  StockBalanceRow,
  StockSummary,
  DOC_PERMISSIONS,
  StockDocKind,
  getStockDocumentApi,
  getStockDocumentsApi,
  getStockBalancesApi,
  getStockLedgerApi,
  getStockSummaryApi,
} from "@/features/stock/api/stock.api";
import OpeningStockForm from "@/features/stock/components/OpeningStockForm";
import VendorReturnForm from "@/features/stock/components/VendorReturnForm";
import OpeningStockView from "@/features/stock/components/OpeningStockView";
import {
  MOVEMENT_LABEL,
  OpeningStatusPill,
  SELECT,
  STOCK_STATUS_OPTIONS,
  StockStatusPill,
  TH,
  errorText,
  money,
  qty,
} from "@/features/stock/components/stockUi";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

type Tab = "stock" | "ledger" | StockDocKind;

const DOC_TABS: StockDocKind[] = ["opening", "adjustments", "vendor-returns"];
const isDocTab = (tab: Tab): tab is StockDocKind => (DOC_TABS as string[]).includes(tab);

/** Documents with their own page, by the ledger's source type. */
const DOC_PAGE: Record<string, string> = {
  GRN: "/inventory/stock-in",
  GRN_QC: "/inventory/stock-in",
  DISPATCH: "/inventory/dispatch",
  STOCK_TRANSFER: "/inventory/transfers",
  STOCK_TRANSFER_IN: "/inventory/transfers",
  STOCK_COUNT: "/inventory/counts",
};

/** Which document a ledger movement came from, to open it from the ledger. */
const KIND_OF_MOVEMENT: Record<string, StockDocKind> = {
  OPENING_BALANCE: "opening",
  STOCK_ADJUSTMENT_IN: "adjustments",
  STOCK_ADJUSTMENT_OUT: "adjustments",
  VENDOR_RETURN: "vendor-returns",
};

const ROW = "align-top text-[13px] text-[#141414] transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#0b2034]";

export default function WarehouseStockPage() {
  const { addToast } = useUIStore();
  const canView = hasPermission("stock.read");
  const canDraft = (kind: StockDocKind) => hasPermission(DOC_PERMISSIONS[kind].create);

  const [tab, setTab] = useState<Tab>("stock");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [status, setStatus] = useState("");
  const [movementType, setMovementType] = useState("");
  const [page, setPage] = useState(1);

  const [warehouses, setWarehouses] = useState<MyWarehouse[]>([]);
  const [summary, setSummary] = useState<StockSummary | null>(null);
  const [balances, setBalances] = useState<StockBalanceRow[]>([]);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [docs, setDocs] = useState<Record<StockDocKind, OpeningDocument[]>>({ opening: [], adjustments: [], "vendor-returns": [] });
  const [totals, setTotals] = useState<Record<Tab, number>>({ stock: 0, ledger: 0, opening: 0, adjustments: 0, "vendor-returns": 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewing, setViewing] = useState<OpeningDocument | null>(null);
  const [editing, setEditing] = useState<OpeningDocument | null>(null);
  const [creating, setCreating] = useState<StockDocKind | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const latest = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  /* The warehouses this person works in feed both filters and the form. */
  useEffect(() => {
    if (!canView) return;
    getMyWarehousesApi()
      .then(setWarehouses)
      .catch((err: unknown) => addToast(errorText(err, "Could not load your warehouses."), "error"));
  }, [canView, addToast]);

  const companies = useMemo(() => {
    const seen = new Map<string, string>();
    warehouses.forEach((w) => seen.set(w.company_id, w.company_name || "Company"));
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [warehouses]);

  const warehouseOptions = warehouses.filter((w) => !companyId || w.company_id === companyId);

  const load = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    setError(null);

    const scope = {
      company_id: companyId || undefined,
      warehouse_id: warehouseId || undefined,
      search: query || undefined,
    };

    try {
      /* The open tab in full; the others only for the counts on their tabs. */
      const docPage = (kind: StockDocKind) =>
        getStockDocumentsApi(kind, { ...scope, page: tab === kind ? page : 1, size: tab === kind ? PAGE_SIZE : 1 });
      const [summaryData, stock, moves, opening, adjustments, returns] = await Promise.all([
        getStockSummaryApi({ company_id: scope.company_id, warehouse_id: scope.warehouse_id }),
        getStockBalancesApi({ ...scope, status: status || undefined, page: tab === "stock" ? page : 1, size: tab === "stock" ? PAGE_SIZE : 1 }),
        getStockLedgerApi({ ...scope, movement_type: movementType || undefined, page: tab === "ledger" ? page : 1, size: tab === "ledger" ? PAGE_SIZE : 1 }),
        docPage("opening"),
        docPage("adjustments"),
        docPage("vendor-returns"),
      ]);
      if (request !== latest.current) return;
      setSummary(summaryData);
      setBalances(stock.data);
      setLedger(moves.data);
      setDocs({ opening: opening.data, adjustments: adjustments.data, "vendor-returns": returns.data });
      setTotals({
        stock: stock.total,
        ledger: moves.total,
        opening: opening.total,
        adjustments: adjustments.total,
        "vendor-returns": returns.total,
      });
    } catch (err: unknown) {
      if (request === latest.current) setError(errorText(err, "Could not load warehouse stock."));
      throw err;
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [companyId, warehouseId, query, status, movementType, tab, page]);

  useEffect(() => {
    if (!canView) return;
    load().catch(() => {
      /* Shown on the page by load itself. */
    });
  }, [canView, load]);

  const openDocument = async (kind: StockDocKind, id: number) => {
    try {
      setViewing(await getStockDocumentApi(kind, id));
    } catch (err: unknown) {
      addToast(errorText(err, "Could not open that document."), "error");
    }
  };

  if (!canView) {
    return (
      <ListPage>
        <ListPageHeader title="Warehouse" />
        <p className="rounded-xl bg-white p-8 text-center text-[13px] text-[#777777] dark:bg-[#071929] dark:text-slate-400">
          You do not have access to warehouse stock. Ask a super admin for the stock permission in Roles &amp; Access.
        </p>
      </ListPage>
    );
  }

  const rowsOnTab = tab === "stock" ? balances.length : tab === "ledger" ? ledger.length : docs[tab].length;
  /* The kinds this user may draft, the open tab's kind first. */
  const draftable = DOC_TABS.filter(canDraft).sort((a, b) => Number(b === tab) - Number(a === tab));
  const NEW_LABEL: Record<StockDocKind, string> = {
    opening: "New Opening Stock",
    adjustments: "New Adjustment",
    "vendor-returns": "New Vendor Return",
  };
  const filtered = !!(query || companyId || warehouseId || status || movementType);

  return (
    <ListPage>
      <ListPageHeader title="Warehouse" refreshing={loading} onRefresh={load} />

      <p className="-mt-3 text-[13px] text-[#777777] dark:text-slate-400">
        Stock held in each warehouse, from the stock ledger. Only available stock can be promised to an order.
      </p>

      <StatGrid cols={6}>
        <StatCard label="Products" value={summary ? qty(summary.skus) : "—"} caption="with stock on hand" />
        <StatCard label="On Hand" value={summary ? qty(summary.on_hand) : "—"} caption="units ready to use" />
        <StatCard label="Reserved" value={summary ? qty(summary.reserved) : "—"} caption="held for orders" />
        <StatCard label="Available" value={summary ? qty(summary.available) : "—"} caption="on hand less reserved" />
        <StatCard
          label="Quarantine"
          value={summary ? qty(summary.quarantine) : "—"}
          caption={summary ? `${qty(summary.rejected + summary.blocked)} rejected or blocked` : "awaiting inspection"}
        />
        <StatCard label="In Transit" value={summary ? qty(summary.in_transit) : "—"} caption="between warehouses" />
      </StatGrid>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        placeholder={isDocTab(tab) ? "Search by document number" : "Search by product, SKU or serial"}
        trailing={
          /* Every kind the user may draft is offered here: an empty tab is
             disabled (QueueTabs), so it cannot be the way in. The open tab's
             kind is the main button. */
          draftable.length === 1 ? (
            <PrimaryAction onClick={() => setCreating(draftable[0])} icon={<FiPlus size={14} />}>
              {NEW_LABEL[draftable[0]]}
            </PrimaryAction>
          ) : draftable.length > 1 ? (
            <div
              className="relative"
              onKeyDown={(e) => {
                if (e.key === "Escape") setMenuOpen(false);
              }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMenuOpen(false);
              }}
            >
              <PrimaryAction onClick={() => setMenuOpen((open) => !open)} icon={<FiPlus size={14} />}>
                New
                <FiChevronDown size={14} />
              </PrimaryAction>
              {menuOpen && (
                <div
                  role="menu"
                  /* Safari does not focus a clicked button, so without this the
                     blur above would close the menu before the click lands. */
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute left-0 z-20 mt-1 w-52 sm:left-auto sm:right-0 overflow-hidden rounded-lg border border-[#E2E8F0] bg-white py-1 shadow-lg dark:border-[#0d2336] dark:bg-[#071929]"
                >
                  {draftable.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        setCreating(kind);
                      }}
                      className="block w-full px-4 py-2 text-left text-[13px] text-[#233353] hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:text-slate-200 dark:hover:bg-[#0d2336]"
                    >
                      {NEW_LABEL[kind]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : undefined
        }
      >
        {companies.length > 1 && (
          <select
            aria-label="Filter by company"
            className={SELECT}
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setWarehouseId("");
              setPage(1);
            }}
          >
            <option value="">All Companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
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
          {warehouseOptions.map((w) => (
            <option key={w.id} value={w.id}>
              {w.location_name} ({w.location_code})
            </option>
          ))}
        </select>
        {tab === "stock" && (
          <select
            aria-label="Filter by stock status"
            className={SELECT}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            {STOCK_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {tab === "ledger" && (
          <select
            aria-label="Filter by movement type"
            className={SELECT}
            value={movementType}
            onChange={(e) => {
              setMovementType(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Movements</option>
            {Object.entries(MOVEMENT_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </ListToolbar>

      <TableCard>
        <QueueTabs
          tabs={[
            { value: "stock", label: "Stock", count: totals.stock },
            { value: "ledger", label: "Ledger", count: totals.ledger },
            { value: "opening", label: "Opening Stock", count: totals.opening },
            { value: "adjustments", label: "Adjustments", count: totals.adjustments },
            { value: "vendor-returns", label: "Vendor Returns", count: totals["vendor-returns"] },
          ]}
          active={tab}
          onChange={(value) => {
            setTab((value as Tab) || "stock");
            setPage(1);
          }}
        />

        {loading && rowsOnTab === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
            <CgSpinner className="animate-spin text-3xl text-primary" />
            <span className="text-xs">Loading warehouse stock...</span>
          </div>
        ) : error ? (
          <p role="alert" className="px-5 py-12 text-center text-[13px] text-rose-600 dark:text-rose-400">
            {error}
          </p>
        ) : rowsOnTab === 0 ? (
          <p className="px-5 py-12 text-center text-[13px] text-[#777777] dark:text-slate-400">
            {filtered
              ? "Nothing matches these filters."
              : warehouses.length === 0
                ? "You have no warehouses yet. Ask a super admin to give you warehouse access in Users."
                : isDocTab(tab)
                  ? `Nothing here yet. Start with ${NEW_LABEL[tab]}.`
                  : "No stock recorded yet. It arrives through opening stock and goods receipts."}
          </p>
        ) : (
          <div className="max-h-[calc(100vh-380px)] min-h-[260px] overflow-auto">
            {tab === "stock" && (
              <table className={`w-full min-w-[1100px] text-left ${LIST_TABLE}`}>
                <thead className="sticky top-0 z-20">
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:bg-white dark:[&>th]:bg-[#071929]">
                    <th className={TH}>Product</th>
                    <th className={TH}>Company</th>
                    <th className={TH}>Warehouse</th>
                    <th className={TH}>Bin</th>
                    <th className={TH}>Status</th>
                    <th className={`${TH} text-right`}>On Hand</th>
                    <th className={`${TH} text-right`}>Reserved</th>
                    <th className={`${TH} text-right`}>Available</th>
                    <th className={`${TH} text-right`}>Avg Cost</th>
                    <th className={TH}>Last Moved</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((row) => (
                    <tr key={row.id} className={ROW}>
                      <td className="min-w-[220px] px-5 py-4">
                        <span className="block font-semibold">{row.product_name || "—"}</span>
                        <span className="font-mono text-[11px] text-[#777777] dark:text-slate-400">{row.sku}</span>
                      </td>
                      <td className="px-5 py-4 text-[12px]">{row.company_name || "—"}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-[12px]">
                        {row.warehouse_name || "—"}
                        <span className="block font-mono text-[11px] text-[#777777]">{row.warehouse_code}</span>
                      </td>
                      <td className="px-5 py-4 font-mono text-[12px]">{row.bin_code || "—"}</td>
                      <td className="px-5 py-4">
                        <StockStatusPill status={row.stock_status} />
                      </td>
                      <td className="px-5 py-4 text-right font-semibold">{qty(row.qty_on_hand)}</td>
                      <td className="px-5 py-4 text-right">{qty(row.qty_reserved)}</td>
                      <td className="px-5 py-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {qty(row.qty_available)}
                      </td>
                      <td className="px-5 py-4 text-right text-[12px]">{money(row.avg_cost)}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-[12px]">{formatDateTime(row.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "ledger" && (
              <table className={`w-full min-w-[1300px] text-left ${LIST_TABLE}`}>
                <thead className="sticky top-0 z-20">
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:bg-white dark:[&>th]:bg-[#071929]">
                    <th className={TH}>Date</th>
                    <th className={TH}>Movement</th>
                    <th className={TH}>Document</th>
                    <th className={TH}>Product</th>
                    <th className={TH}>Serial</th>
                    <th className={TH}>Warehouse / Bin</th>
                    <th className={TH}>Status</th>
                    <th className={`${TH} text-right`}>Qty</th>
                    <th className={TH}>Prepared By</th>
                    <th className={TH}>Approved By</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((row) => (
                    <tr key={row.id} className={ROW}>
                      <td className="whitespace-nowrap px-5 py-4 text-[12px]">
                        {formatDate(row.movement_date)}
                        <span className="block text-[11px] text-[#777777]">posted {formatDateTime(row.posted_at)}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-[12px] font-semibold">
                        {MOVEMENT_LABEL[row.movement_type] || row.movement_type}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-[12px]">
                        {row.source_doc_type === "STOCK_DOCUMENT" && KIND_OF_MOVEMENT[row.movement_type] ? (
                          <button
                            type="button"
                            onClick={() => openDocument(KIND_OF_MOVEMENT[row.movement_type], Number(row.source_doc_id))}
                            className="font-semibold text-[#233353] hover:underline dark:text-sky-300"
                          >
                            {row.source_doc_number || row.source_doc_id}
                          </button>
                        ) : DOC_PAGE[row.source_doc_type] ? (
                          <Link
                            href={`${DOC_PAGE[row.source_doc_type]}/${row.source_doc_id}`}
                            className="font-semibold text-[#233353] hover:underline dark:text-sky-300"
                          >
                            {row.source_doc_number || row.source_doc_id}
                          </Link>
                        ) : (
                          row.source_doc_number || row.source_doc_id
                        )}
                      </td>
                      <td className="min-w-[200px] px-5 py-4">
                        <span className="block font-semibold">{row.product_name || "—"}</span>
                        <span className="font-mono text-[11px] text-[#777777]">{row.sku}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 font-mono text-[12px]">{row.serial_no || "—"}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-[12px]">
                        {row.warehouse_name || "—"}
                        <span className="block font-mono text-[11px] text-[#777777]">{row.bin_code}</span>
                      </td>
                      <td className="px-5 py-4">
                        <StockStatusPill status={row.stock_status} />
                      </td>
                      <td
                        className={`px-5 py-4 text-right font-semibold ${
                          row.quantity > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {row.quantity > 0 ? "+" : ""}
                        {qty(row.quantity)}
                      </td>
                      <td className="px-5 py-4 text-[12px]">{row.created_by_name || "—"}</td>
                      <td className="px-5 py-4 text-[12px]">{row.approved_by_name || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {isDocTab(tab) && (
              <table className={`w-full min-w-[1000px] text-left ${LIST_TABLE}`}>
                <thead className="sticky top-0 z-20">
                  <tr className="[&>th]:sticky [&>th]:top-0 [&>th]:bg-white dark:[&>th]:bg-[#071929]">
                    <th className={TH}>Document</th>
                    <th className={TH}>Warehouse</th>
                    <th className={TH}>Date</th>
                    <th className={TH}>Type / Reason</th>
                    <th className={`${TH} text-right`}>Products</th>
                    <th className={`${TH} text-right`}>Units</th>
                    <th className={`${TH} text-right`}>Value</th>
                    <th className={TH}>Prepared By</th>
                    <th className={TH}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {docs[tab].map((doc) => (
                    <tr key={doc.id} className={`${ROW} cursor-pointer`} onClick={() => openDocument(tab, doc.id)}>
                      <td className="whitespace-nowrap px-5 py-4">
                        <button
                          type="button"
                          className="font-mono text-[12px] font-semibold text-[#233353] hover:underline dark:text-sky-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDocument(tab, doc.id);
                          }}
                        >
                          {doc.doc_number}
                        </button>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-[12px]">
                        {doc.warehouse_name || "—"}
                        <span className="block text-[11px] text-[#777777]">{doc.company_name}</span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-[12px]">{formatDate(doc.movement_date)}</td>
                      <td className="px-5 py-4 text-[12px]">
                        {doc.doc_type === "ADJUSTMENT_IN" ? "In" : doc.doc_type === "ADJUSTMENT_OUT" ? "Out" : DOC_PERMISSIONS[tab].noun}
                        <span className="block text-[11px] text-[#777777]">{doc.reason_code || doc.reason || ""}</span>
                      </td>
                      <td className="px-5 py-4 text-right">{doc.lines.length}</td>
                      <td className="px-5 py-4 text-right font-semibold">{qty(doc.total_quantity)}</td>
                      <td className="px-5 py-4 text-right text-[12px]">{money(doc.total_value)}</td>
                      <td className="px-5 py-4 text-[12px]">{doc.created_by_name || "—"}</td>
                      <td className="px-5 py-4">
                        <OpeningStatusPill status={doc.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        <div className="border-t border-slate-100 px-5 py-2 dark:border-[#17304a]">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={totals[tab]}
            totalPages={Math.max(1, Math.ceil(totals[tab] / PAGE_SIZE))}
            onPageChange={setPage}
            noun={isDocTab(tab) ? "documents" : tab === "ledger" ? "movements" : "rows"}
          />
        </div>
      </TableCard>

      {creating === "vendor-returns" && (
        <VendorReturnForm
          warehouses={warehouses}
          onClose={() => setCreating(null)}
          onSaved={(doc) => {
            setCreating(null);
            setViewing(doc);
            setTab("vendor-returns");
            load().catch(() => undefined);
          }}
        />
      )}

      {((creating && creating !== "vendor-returns") || editing) && (
        <OpeningStockForm
          kind={editing ? (editing.doc_type === "OPENING" ? "opening" : "adjustments") : creating === "adjustments" ? "adjustments" : "opening"}
          warehouses={warehouses}
          editing={editing}
          onClose={() => {
            setCreating(null);
            setEditing(null);
          }}
          onSaved={(doc) => {
            const kind: StockDocKind = doc.doc_type === "OPENING" ? "opening" : "adjustments";
            setCreating(null);
            setEditing(null);
            setViewing(doc);
            setTab(kind);
            load().catch(() => undefined);
          }}
        />
      )}

      {viewing && !editing && (
        <OpeningStockView
          doc={viewing}
          onClose={() => setViewing(null)}
          onEdit={(doc) => {
            setViewing(null);
            setEditing(doc);
          }}
          onChanged={(doc) => {
            setViewing(doc);
            load().catch(() => undefined);
          }}
        />
      )}
    </ListPage>
  );
}
