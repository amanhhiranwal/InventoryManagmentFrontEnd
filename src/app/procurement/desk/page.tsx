"use client";

/**
 * Procurement Desk: every approved requisition, with the KPI cards and
 * filters the procurement team works from. Needs procurement.read; the
 * server refuses the list to anyone without it.
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";
import { FiPlus } from "react-icons/fi";

import {
  ListPage,
  ListPageHeader,
  ListToolbar,
  PrimaryAction,
  TableCard,
} from "@/components/crm/ListPageShell";
import Pagination from "@/components/crm/Pagination";
import QueueTabs from "@/components/crm/QueueTabs";
import { useCloseOnOutsideClick } from "@/components/crm/useCloseOnOutsideClick";
import DataList, { type Column } from "@/features/procurement/components/DataList";
import ProcurementKpis from "@/features/procurement/components/ProcurementKpis";
import {
  errorDetail,
  getDepartmentsApi,
  getDeskApi,
  getExecutivesApi,
  getProcurementMetaApi,
  type Department,
  type DeskKpis,
  type ProcurementMeta,
  type Requisition,
} from "@/features/procurement/api/procurement.api";
import {
  Empty,
  ErrorState,
  INPUT,
  LABEL,
  Loading,
  ProcStatus,
  day,
  humanize,
} from "@/features/procurement/components/shared";

const PAGE_SIZE = 20;

const KPI_TABS: { value: string | null; label: string; key: keyof DeskKpis }[] = [
  { value: null, label: "All", key: "total" },
  { value: "new", label: "New", key: "new" },
  { value: "under_procurement", label: "Assigned", key: "under_procurement" },
  { value: "collecting", label: "Quoting", key: "collecting" },
  { value: "awaiting_comparison", label: "Comparing", key: "awaiting_comparison" },
  { value: "po_approval", label: "PO Approval", key: "po_approval" },
  { value: "po_generated", label: "PO Raised", key: "po_generated" },
  { value: "OVERDUE", label: "Overdue", key: "overdue" },
];

const SUB = "mt-0.5 block text-[11px] text-[#777777] dark:text-slate-400";

/** Seven columns that fit a laptop; related fields share a cell. */
const COLUMNS: Column<Requisition>[] = [
  {
    header: "Requisition",
    primary: true,
    width: "w-[19%]",
    cell: (row) => (
      <>
        <Link href={`/procurement/desk/${row.id}`} className="font-semibold text-[#233353] hover:underline dark:text-sky-300">
          {row.pr_number}
        </Link>
        <span className={SUB}>{row.purchase_type_label}, {row.item_count} item{row.item_count === 1 ? "" : "s"}</span>
      </>
    ),
  },
  {
    header: "Requester",
    cell: (row) => (
      <>
        {row.requester_name}
        <span className={SUB}>{row.department_name || "No department"}</span>
      </>
    ),
  },
  {
    header: "Sales Order",
    cell: (row) =>
      row.sales_order_number ? (
        <>
          {row.sales_order_number}
          {row.customer_name && <span className={SUB}>{row.customer_name}</span>}
        </>
      ) : (
        <span className="text-[#999999]">None</span>
      ),
  },
  {
    header: "Required By",
    nowrap: true,
    cell: (row) => (
      <>
        {day(row.required_by)}
        <span className={row.overdue ? "mt-0.5 block text-[11px] font-semibold text-rose-600" : SUB}>
          {row.overdue ? "Overdue" : `${humanize(row.priority)} priority`}
        </span>
      </>
    ),
  },
  {
    header: "Status",
    primary: true,
    cell: (row) => (
      <>
        <ProcStatus status={row.procurement_status} />
        <span className={SUB}>{row.assigned_name || "Unassigned"}</span>
      </>
    ),
  },
  { header: "Waiting", nowrap: true, cell: (row) => `${row.pending_since_days ?? 0} d` },
];

type Filters = {
  department_id: string;
  purchase_type: string;
  priority: string;
  assigned_to: string;
  sales_order_number: string;
  required_from: string;
  required_to: string;
};

const NO_FILTERS: Filters = {
  department_id: "",
  purchase_type: "",
  priority: "",
  assigned_to: "",
  sales_order_number: "",
  required_from: "",
  required_to: "",
};

export default function ProcurementDeskPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Requisition[]>([]);
  const [total, setTotal] = useState(0);
  const [kpis, setKpis] = useState<DeskKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ProcurementMeta | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [executives, setExecutives] = useState<{ id: string; name: string }[]>([]);
  const latest = useRef(0);
  /* Bumped by the header's refresh so the KPIs reload with the list. */
  const [refreshes, setRefreshes] = useState(0);

  useEffect(() => {
    getProcurementMetaApi().then(setMeta).catch(() => {});
    getDepartmentsApi().then(setDepartments).catch(() => {});
    getExecutivesApi().then(setExecutives).catch(() => {});
  }, []);

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
      const params: Record<string, unknown> = { page, size: PAGE_SIZE, search: query || undefined };
      if (tab) params.procurement_status = tab;
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params[key] = value;
      });
      const answer = await getDeskApi(params);
      if (request !== latest.current) return;
      setRows(answer.data);
      setTotal(answer.total);
      setKpis(answer.kpis);
    } catch (failure) {
      if (request === latest.current) setError(errorDetail(failure, "Could not load the procurement desk."));
      throw failure;
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [page, query, tab, filters]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  /* The popover edits a draft; the list only changes on Apply, as on the
     other lists. Opening it starts the draft from what is applied. */
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const filterRef = useCloseOnOutsideClick(showFilters, () => setShowFilters(false));

  const toggleFilters = () => {
    if (!showFilters) setDraft(filters);
    setShowFilters((open) => !open);
  };
  const setDraftValue = (key: keyof Filters, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const applyFilters = () => {
    setFilters(draft);
    setPage(1);
    setShowFilters(false);
  };
  const clearFilters = () => {
    setDraft(NO_FILTERS);
    setFilters(NO_FILTERS);
    setPage(1);
    setShowFilters(false);
  };

  const activeFilters = Object.values(filters).filter(Boolean).length;

  return (
    <ListPage>
      <ListPageHeader
        title="Procurement Desk"
        refreshing={loading}
        onRefresh={async () => {
          setRefreshes((n) => n + 1);
          await load();
        }}
      />

      <ProcurementKpis refreshKey={refreshes} />

      {/* Toolbar and popover share one wrapper, so the filter button does
          not count as an outside click (same pattern as Sales Orders). */}
      <div className="relative" ref={filterRef}>
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search by PR, requester, sales order or customer"
          activeFilterCount={activeFilters}
          onToggleFilters={toggleFilters}
          trailing={
            meta?.permissions?.["procurement.manage"] ? (
              <PrimaryAction icon={<FiPlus size={14} />} onClick={() => router.push("/procurement/desk/new")}>
                New Procurement
              </PrimaryAction>
            ) : undefined
          }
        />

        {showFilters && (
          <div
            role="dialog"
            aria-label="Filter requisitions"
            className="absolute right-0 top-[48px] z-50 w-[520px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] dark:border-[#17304a] dark:bg-[#071929]"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="f-dept">Department</label>
                <select id="f-dept" className={INPUT} value={draft.department_id} onChange={(e) => setDraftValue("department_id", e.target.value)}>
                  <option value="">All</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="f-type">Purchase Type</label>
                <select id="f-type" className={INPUT} value={draft.purchase_type} onChange={(e) => setDraftValue("purchase_type", e.target.value)}>
                  <option value="">All</option>
                  {(meta?.purchase_types || []).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="f-priority">Priority</label>
                <select id="f-priority" className={INPUT} value={draft.priority} onChange={(e) => setDraftValue("priority", e.target.value)}>
                  <option value="">All</option>
                  {(meta?.priorities || []).map((p) => <option key={p} value={p}>{humanize(p)}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="f-assigned">Assigned To</label>
                <select id="f-assigned" className={INPUT} value={draft.assigned_to} onChange={(e) => setDraftValue("assigned_to", e.target.value)}>
                  <option value="">Anyone</option>
                  <option value="unassigned">Unassigned</option>
                  {executives.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL} htmlFor="f-so">Sales Order</label>
                <input id="f-so" className={INPUT} placeholder="Order number" value={draft.sales_order_number} onChange={(e) => setDraftValue("sales_order_number", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="f-from">Required From</label>
                <input id="f-from" type="date" className={INPUT} max={draft.required_to || undefined} value={draft.required_from} onChange={(e) => setDraftValue("required_from", e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="f-to">Required To</label>
                <input id="f-to" type="date" className={INPUT} min={draft.required_from || undefined} value={draft.required_to} onChange={(e) => setDraftValue("required_to", e.target.value)} />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-4 border-t border-slate-100 pt-4 dark:border-[#17304a]">
              <button type="button" onClick={clearFilters} className="text-[11px] font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400">
                Clear All Filter
              </button>
              <button type="button" onClick={applyFilters} className="h-9 rounded-lg bg-[#24395f] px-4 text-[11px] font-semibold text-white">
                Apply Filter
              </button>
            </div>
          </div>
        )}
      </div>

      <TableCard>
        <QueueTabs
          tabs={KPI_TABS.map((t) => ({ value: t.value, label: t.label, count: kpis?.[t.key] ?? 0 }))}
          active={tab}
          onChange={(value) => { setTab(value); setPage(1); }}
          fit
        />

        {loading && !rows.length && !error ? (
          <Loading text="Loading the procurement desk..." />
        ) : error ? (
          <ErrorState text={error} onRetry={() => load().catch(() => {})} />
        ) : rows.length === 0 ? (
          <Empty text={query || tab || activeFilters ? "No requisitions match." : "No approved requisitions are with procurement yet."} />
        ) : (
          <DataList rows={rows} columns={COLUMNS} rowKey={(row) => row.id} rowHref={(row) => `/procurement/desk/${row.id}`} />
        )}

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={total}
          totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          onPageChange={setPage}
          noun="requisitions"
        />
      </TableCard>
    </ListPage>
  );
}
