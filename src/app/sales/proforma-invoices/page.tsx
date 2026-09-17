"use client";

/**
 * Proforma Invoice list.
 *
 * KPIs, search, filters and the table read live invoices. "New Proforma
 * Invoice" opens a picker of confirmed sales orders; Continue carries the
 * chosen order to the Generate page, which is prefilled from it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LuArrowUpRight,
  LuBan,
  LuCalendar,
  LuChevronDown,
  LuDownload,
  LuEllipsisVertical,
  LuEye,
  LuMapPin,
  LuPencil,
  LuPlus,
  LuSend,
  LuTrash2,
  LuX,
} from "react-icons/lu";

import { useUIStore } from "@/lib/store/ui.store";
import StatCard from "@/components/crm/StatCard";
import Pagination from "@/components/crm/Pagination";
import { StatusPill } from "@/components/crm/Pill";
import {
  ListPageHeader,
  ListToolbar,
  PrimaryAction,
  StatGrid,
} from "@/components/crm/ListPageShell";
import {
  getSalesOrdersApi,
  type SalesOrderModel,
} from "@/features/salesOrders/api/salesOrders.api";
import {
  PROFORMA_INVOICE_STATUSES,
  PROFORMA_INVOICE_TRANSITIONS,
  deleteProformaInvoiceApi,
  getCompanyProfileApi,
  getProformaInvoicesApi,
  proformaInvoiceStatusLabel,
  updateProformaInvoiceStatusApi,
  type CompanyProfile,
  type ProformaInvoiceModel,
} from "@/features/proformaInvoices/api/proformaInvoices.api";
import {
  compactMoney,
  formatDate,
} from "@/features/proformaInvoices/components/ProformaParts";
import {
  PrintableProformaInvoice,
  usePrintProformaInvoice,
} from "@/features/proformaInvoices/components/ProformaInvoiceDocument";

const PAGE_SIZE = 10;

type SortKey =
  | "pi"
  | "customer"
  | "company"
  | "order"
  | "value"
  | "assigned"
  | "due"
  | "status";

interface Filters {
  dueFrom: string;
  dueTo: string;
  assignedTo: string;
  status: string;
  state: string;
}

const EMPTY_FILTERS: Filters = {
  dueFrom: "",
  dueTo: "",
  assignedTo: "",
  status: "",
  state: "",
};

const contactOf = (record: { customer_information?: Record<string, any> | null }) =>
  ((record.customer_information || {}).primary_contact || {}) as Record<string, string>;

const isOverdue = (invoice: ProformaInvoiceModel) =>
  invoice.status !== "CANCELLED" &&
  invoice.balance_due > 0 &&
  !!invoice.due_date &&
  new Date(invoice.due_date).getTime() < new Date().setHours(0, 0, 0, 0);

/** Month-over-month change of a figure, as "12.4%", or undefined when there
    is no previous month to compare against. */
function monthOverMonth(
  invoices: ProformaInvoiceModel[],
  measure: (items: ProformaInvoiceModel[]) => number,
) {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

  const created = (invoice: ProformaInvoiceModel) =>
    new Date(invoice.created_at || 0).getTime();

  const current = measure(invoices.filter((i) => created(i) >= thisMonth));
  const previous = measure(
    invoices.filter((i) => created(i) >= lastMonth && created(i) < thisMonth),
  );

  if (!previous) return undefined;

  const change = ((current - previous) / previous) * 100;

  return { text: `${Math.abs(change).toFixed(1)}%`, positive: change >= 0 };
}

export default function ProformaInvoiceListPage() {
  const router = useRouter();
  const { addToast } = useUIStore();
  const printInvoice = usePrintProformaInvoice();

  const [invoices, setInvoices] = useState<ProformaInvoiceModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null);
  const [page, setPage] = useState(1);

  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const [showCreate, setShowCreate] = useState(false);

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [printTarget, setPrintTarget] = useState<ProformaInvoiceModel | null>(null);

  const reportError = useCallback(
    (message: string) => addToast(message, "error"),
    [addToast],
  );

  const load = useCallback(
    async (refresh = false) => {
      try {
        if (refresh) setRefreshing(true);
        else setLoading(true);

        setInvoices(await getProformaInvoicesApi());
      } catch (error: any) {
        console.error(error);
        addToast(
          error?.response?.data?.detail || "Unable to load proforma invoices.",
          "error",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    load();
    getCompanyProfileApi()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [load]);

  /* Print once the portal copy of the chosen invoice has rendered. */
  useEffect(() => {
    if (!printTarget) return;

    printInvoice(printTarget.pi_number || `PI-${printTarget.id}`);
  }, [printTarget, printInvoice]);

  /* ---------------------------------------------------------------
     KPIs
  --------------------------------------------------------------- */

  const kpis = useMemo(() => {
    const live = invoices.filter((invoice) => invoice.status !== "CANCELLED");

    const value = (items: ProformaInvoiceModel[]) =>
      items
        .filter((invoice) => invoice.status !== "CANCELLED")
        .reduce((sum, invoice) => sum + invoice.grand_total, 0);

    return {
      total: invoices.length,
      totalChange: monthOverMonth(invoices, (items) => items.length),
      value: value(invoices),
      valueChange: monthOverMonth(invoices, value),
      pending: live.reduce((sum, invoice) => sum + invoice.balance_due, 0),
      overdue: live
        .filter(isOverdue)
        .reduce((sum, invoice) => sum + invoice.balance_due, 0),
    };
  }, [invoices]);

  /* ---------------------------------------------------------------
     FILTER + SORT
  --------------------------------------------------------------- */

  const assignees = useMemo(
    () => [...new Set(invoices.map((i) => i.assigned_to).filter(Boolean) as string[])],
    [invoices],
  );

  const states = useMemo(
    () => [...new Set(invoices.map((i) => i.state).filter(Boolean) as string[])],
    [invoices],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    const rows = invoices.filter((invoice) => {
      if (query) {
        const haystack = [
          invoice.pi_number,
          invoice.customer_name,
          invoice.company_name,
          invoice.sales_order?.order_number,
          invoice.assigned_to,
          contactOf(invoice).email,
          invoice.state,
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(query)) return false;
      }

      if (filters.status && invoice.status !== filters.status) return false;
      if (filters.assignedTo && invoice.assigned_to !== filters.assignedTo) return false;
      if (filters.state && invoice.state !== filters.state) return false;

      const due = invoice.due_date ? new Date(invoice.due_date).getTime() : null;

      if (filters.dueFrom && (!due || due < new Date(`${filters.dueFrom}T00:00:00`).getTime()))
        return false;
      if (filters.dueTo && (!due || due > new Date(`${filters.dueTo}T23:59:59`).getTime()))
        return false;

      return true;
    });

    if (!sort) return rows;

    const valueOf = (invoice: ProformaInvoiceModel): string | number => {
      switch (sort.key) {
        case "pi":
          return invoice.id;
        case "customer":
          return invoice.customer_name.toLowerCase();
        case "company":
          return (invoice.company_name || "").toLowerCase();
        case "order":
          return invoice.sales_order_id || 0;
        case "value":
          return invoice.grand_total;
        case "assigned":
          return (invoice.assigned_to || "").toLowerCase();
        case "due":
          return invoice.due_date ? new Date(invoice.due_date).getTime() : 0;
        case "status":
          return PROFORMA_INVOICE_STATUSES.indexOf(invoice.status);
      }
    };

    return [...rows].sort((a, b) => {
      const left = valueOf(a);
      const right = valueOf(b);

      return (left < right ? -1 : left > right ? 1 : 0) * sort.dir;
    });
  }, [invoices, search, filters, sort]);

  useEffect(() => setPage(1), [search, filters]);

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const toggleSort = (key: SortKey) =>
    setSort((current) =>
      current?.key === key
        ? current.dir === 1
          ? { key, dir: -1 }
          : null
        : { key, dir: 1 },
    );

  /* ---------------------------------------------------------------
     ROW ACTIONS
  --------------------------------------------------------------- */

  const cancelInvoice = async (invoice: ProformaInvoiceModel) => {
    setOpenMenu(null);

    try {
      const updated = await updateProformaInvoiceStatusApi(
        invoice.id,
        "CANCELLED",
        "Cancelled from the proforma invoice list.",
      );

      setInvoices((current) => current.map((i) => (i.id === updated.id ? updated : i)));
      addToast(`#${invoice.pi_number} cancelled.`, "success");
    } catch (error: any) {
      addToast(error?.response?.data?.detail || "Failed to cancel the invoice.", "error");
    }
  };

  const deleteInvoice = async (invoice: ProformaInvoiceModel) => {
    setOpenMenu(null);

    if (!window.confirm(`Delete draft #${invoice.pi_number}? This cannot be undone.`)) return;

    try {
      await deleteProformaInvoiceApi(invoice.id);
      setInvoices((current) => current.filter((i) => i.id !== invoice.id));
      addToast(`#${invoice.pi_number} deleted.`, "success");
    } catch (error: any) {
      addToast(error?.response?.data?.detail || "Failed to delete the invoice.", "error");
    }
  };

  /* ---------------------------------------------------------------
     EXPORT
  --------------------------------------------------------------- */

  const download = (content: string, type: string, filename: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportData = () => {
    setHeaderMenuOpen(false);

    if (!visible.length) {
      addToast("No proforma invoice data available to export.", "warning");
      return;
    }

    const headers = [
      "PI ID",
      "Customer Name",
      "Email",
      "Company",
      "Sales Order",
      "PI Value",
      "Amount Paid",
      "Balance Due",
      "Assigned To",
      "Issue Date",
      "Due Date",
      "Status",
    ];

    const rows = visible.map((invoice) => [
      invoice.pi_number,
      invoice.customer_name,
      contactOf(invoice).email || "",
      invoice.company_name || "",
      invoice.sales_order?.order_number || "",
      invoice.grand_total,
      invoice.amount_paid,
      invoice.balance_due,
      invoice.assigned_to || "",
      formatDate(invoice.issue_date),
      formatDate(invoice.due_date),
      proformaInvoiceStatusLabel(invoice.status),
    ]);

    download(
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\n"),
      "text/csv;charset=utf-8;",
      "proforma-invoices.csv",
    );

    addToast("Proforma invoice data exported.", "success");
  };

  const downloadChart = () => {
    setHeaderMenuOpen(false);

    const counts = PROFORMA_INVOICE_STATUSES.map(
      (status) => invoices.filter((invoice) => invoice.status === status).length,
    );
    const max = Math.max(...counts, 1);

    const bars = counts
      .map((count, index) => {
        const height = (count / max) * 280;
        const x = 120 + index * 190;
        const y = 360 - height;

        return `<rect x="${x}" y="${y}" width="110" height="${height}" rx="6" fill="#233353"/>
          <text x="${x + 55}" y="${y - 10}" text-anchor="middle" font-size="16" fill="#1e293b">${count}</text>
          <text x="${x + 55}" y="390" text-anchor="middle" font-size="12" fill="#64748b">${proformaInvoiceStatusLabel(
            PROFORMA_INVOICE_STATUSES[index],
          )}</text>`;
      })
      .join("");

    download(
      `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="460"><rect width="100%" height="100%" fill="white"/><text x="60" y="55" font-size="24" font-weight="700" fill="#0f172a">Proforma Invoice Status</text><line x1="90" y1="360" x2="860" y2="360" stroke="#cbd5e1"/>${bars}</svg>`,
      "image/svg+xml;charset=utf-8",
      "proforma-invoice-chart.svg",
    );

    addToast("Proforma invoice chart downloaded.", "success");
  };

  /* ---------------------------------------------------------------
     RENDER
  --------------------------------------------------------------- */

  return (
    <div className="min-h-full space-y-5 pb-8">
      <ListPageHeader
        title="Proforma Invoice"
        refreshing={refreshing}
        onRefresh={() => load(true)}
        actions={
          <div className="relative">
            <button
              type="button"
              aria-label="More options"
              onClick={() => setHeaderMenuOpen((value) => !value)}
              className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:bg-[#071929] dark:text-slate-200"
            >
              <LuEllipsisVertical size={16} />
            </button>

            {headerMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setHeaderMenuOpen(false)} />
                <div className="absolute right-0 top-10 z-50 w-36 overflow-hidden rounded-lg bg-white py-1 shadow-xl dark:bg-[#071929]">
                  <button
                    type="button"
                    onClick={exportData}
                    className="w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#0b2034]"
                  >
                    Export Data
                  </button>
                  <button
                    type="button"
                    onClick={downloadChart}
                    className="w-full px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#0b2034]"
                  >
                    Download Chart
                  </button>
                </div>
              </>
            )}
          </div>
        }
      />

      <StatGrid>
        <StatCard
          label="Total PIs"
          value={kpis.total}
          change={kpis.totalChange?.text}
          positive={kpis.totalChange?.positive}
          caption={kpis.totalChange ? "vs last month" : ""}
        />
        <StatCard
          label="Total PI Value"
          value={compactMoney(kpis.value)}
          change={kpis.valueChange?.text}
          positive={kpis.valueChange?.positive}
          caption={kpis.valueChange ? "vs last month" : ""}
        />
        <StatCard label="Pending Payment" value={compactMoney(kpis.pending)} caption="" />
        <StatCard label="Overdue Amount" value={compactMoney(kpis.overdue)} caption="" />
      </StatGrid>

      <div className="relative">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search Proforma Invoice"
          activeFilterCount={activeFilterCount}
          onToggleFilters={() => {
            setDraftFilters(filters);
            setShowFilters((value) => !value);
          }}
          trailing={
            <PrimaryAction onClick={() => setShowCreate(true)} icon={<LuPlus size={17} />}>
              New Proforma Invoice
            </PrimaryAction>
          }
        />

        {showFilters && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
            <div className="absolute right-0 top-[52px] z-50 w-full max-w-[500px] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] sm:right-[190px] dark:border-[#17304a] dark:bg-[#071929]">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-medium text-slate-500">Due Date Range</h3>
                <button
                  type="button"
                  onClick={() => setDraftFilters(EMPTY_FILTERS)}
                  className="text-[11px] font-medium text-rose-500"
                >
                  × Clear Filter
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(["dueFrom", "dueTo"] as const).map((key) => (
                  <div key={key} className="relative">
                    <LuCalendar
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="date"
                      aria-label={key === "dueFrom" ? "Due from" : "Due to"}
                      value={draftFilters[key]}
                      onChange={(event) =>
                        setDraftFilters((current) => ({ ...current, [key]: event.target.value }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-xs text-slate-700 outline-none dark:border-[#17304a] dark:bg-[#051422] dark:text-white"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <FilterSelect
                  label="Assigned To"
                  value={draftFilters.assignedTo}
                  onChange={(value) => setDraftFilters((c) => ({ ...c, assignedTo: value }))}
                  options={assignees.map((name) => ({ value: name, label: name }))}
                  allLabel="All Users"
                />
                <FilterSelect
                  label="Status"
                  value={draftFilters.status}
                  onChange={(value) => setDraftFilters((c) => ({ ...c, status: value }))}
                  options={PROFORMA_INVOICE_STATUSES.map((status) => ({
                    value: status,
                    label: proformaInvoiceStatusLabel(status),
                  }))}
                  allLabel="All Statuses"
                />
                <FilterSelect
                  label="State"
                  value={draftFilters.state}
                  onChange={(value) => setDraftFilters((c) => ({ ...c, state: value }))}
                  options={states.map((state) => ({ value: state, label: state }))}
                  allLabel="All States"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-4 border-t border-slate-100 pt-4 dark:border-[#17304a]">
                <button
                  type="button"
                  onClick={() => {
                    setDraftFilters(EMPTY_FILTERS);
                    setFilters(EMPTY_FILTERS);
                    setShowFilters(false);
                  }}
                  className="text-[11px] font-medium text-slate-500"
                >
                  Clear All Filter
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilters(draftFilters);
                    setShowFilters(false);
                  }}
                  className="h-9 rounded-lg bg-[#233353] px-4 text-[11px] font-semibold text-white"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-[#17304a] dark:bg-[#071929]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-[#17304a]">
                <th className="w-12 border-r border-slate-100 px-4 py-3 dark:border-[#17304a]">
                  <input type="checkbox" aria-label="Select all" className="rounded border-slate-300" />
                </th>
                <SortTh sort={sort} onSort={toggleSort} label="PI ID" sortKey="pi" />
                <SortTh sort={sort} onSort={toggleSort} label="Customer Name" sortKey="customer" className="min-w-[160px]" />
                <SortTh sort={sort} onSort={toggleSort} label="Company" sortKey="company" className="min-w-[150px]" />
                <SortTh sort={sort} onSort={toggleSort} label="Sales Order" sortKey="order" />
                <SortTh sort={sort} onSort={toggleSort} label="PI Value" sortKey="value" />
                <SortTh sort={sort} onSort={toggleSort} label="Assigned To" sortKey="assigned" />
                <SortTh sort={sort} onSort={toggleSort} label="Due Date" sortKey="due" />
                <SortTh sort={sort} onSort={toggleSort} label="Status" sortKey="status" />
                <th className="px-3 py-3 text-center text-[11px] font-normal text-slate-600 dark:text-slate-300">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-xs text-slate-400">
                    Fetching proforma invoices...
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-xs text-slate-400">
                    {invoices.length === 0
                      ? "No proforma invoices yet. Raise one from a confirmed sales order."
                      : "No proforma invoices match your search or filters."}
                  </td>
                </tr>
              ) : (
                pageRows.map((invoice) => {
                  const contact = contactOf(invoice);
                  const next = PROFORMA_INVOICE_TRANSITIONS[invoice.status] || [];

                  return (
                    <tr
                      key={invoice.id}
                      onClick={() => router.push(`/sales/proforma-invoices/${invoice.id}`)}
                      className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 dark:border-[#17304a]/70 dark:hover:bg-[#0b2034]"
                    >
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${invoice.pi_number}`}
                          className="rounded border-slate-300"
                        />
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-[11px] font-medium text-slate-800 dark:text-white">
                        #{invoice.pi_number}
                      </td>

                      <td className="px-3 py-3">
                        <p className="text-[12px] font-semibold text-slate-900 dark:text-white">
                          {invoice.customer_name}
                        </p>
                        {contact.email && (
                          <p className="text-[10px] text-slate-700 [overflow-wrap:anywhere] dark:text-slate-400">
                            {contact.email}
                          </p>
                        )}
                        {invoice.state && (
                          <p className="flex items-center gap-1 text-[9px] text-slate-600 dark:text-slate-400">
                            <LuMapPin size={9} />
                            {invoice.state}
                          </p>
                        )}
                      </td>

                      <td className="px-3 py-3 text-[12px] text-slate-700 dark:text-slate-300">
                        {invoice.company_name || "-"}
                      </td>

                      <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
                        {invoice.sales_order ? (
                          <button
                            type="button"
                            onClick={() => router.push(`/sales/orders/${invoice.sales_order!.id}`)}
                            className="flex items-center gap-1 whitespace-nowrap text-[11px] text-blue-600 hover:underline"
                          >
                            #{invoice.sales_order.order_number || invoice.sales_order.id}
                            <LuArrowUpRight size={11} />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">-</span>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-[10px] font-medium text-slate-800 dark:text-slate-200">
                        {compactMoney(invoice.grand_total)}
                      </td>

                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-700 dark:bg-[#0b2034] dark:text-slate-200">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-[8px] dark:bg-[#17304a]">
                            {(invoice.assigned_to || "U").charAt(0).toUpperCase()}
                          </span>
                          {invoice.assigned_to || "Unassigned"}
                        </span>
                      </td>

                      <td
                        className={`whitespace-nowrap px-3 py-3 text-[10px] ${
                          isOverdue(invoice) ? "font-semibold text-rose-500" : "text-slate-700 dark:text-slate-300"
                        }`}
                        title={isOverdue(invoice) ? "Overdue" : undefined}
                      >
                        {formatDate(invoice.due_date)}
                      </td>

                      <td className="px-3 py-3">
                        <StatusPill
                          status={invoice.status}
                          label={proformaInvoiceStatusLabel(invoice.status)}
                        />
                      </td>

                      <td className="relative px-3 py-3 text-center" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          aria-label={`Actions for ${invoice.pi_number}`}
                          onClick={() => setOpenMenu(openMenu === invoice.id ? null : invoice.id)}
                          className="rounded p-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#0b2034]"
                        >
                          <LuEllipsisVertical size={15} />
                        </button>

                        {openMenu === invoice.id && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setOpenMenu(null)} />
                            <div className="absolute right-6 top-9 z-30 w-44 rounded-lg border border-slate-200 bg-white py-1 text-left shadow-xl dark:border-[#17304a] dark:bg-[#071929]">
                              <MenuItem
                                icon={<LuEye size={13} />}
                                label="View"
                                onClick={() => router.push(`/sales/proforma-invoices/${invoice.id}`)}
                              />
                              {invoice.status === "DRAFT" && (
                                <MenuItem
                                  icon={<LuPencil size={13} />}
                                  label="Edit PI"
                                  onClick={() =>
                                    router.push(`/sales/proforma-invoices/new?edit=${invoice.id}`)
                                  }
                                />
                              )}
                              <MenuItem
                                icon={<LuDownload size={13} />}
                                label="Download PDF"
                                onClick={() => {
                                  setOpenMenu(null);
                                  setPrintTarget({ ...invoice });
                                }}
                              />
                              {(invoice.status === "GENERATED" || invoice.status === "SENT") && (
                                <MenuItem
                                  icon={<LuSend size={13} />}
                                  label="Send PI To Customer"
                                  onClick={() =>
                                    router.push(`/sales/proforma-invoices/${invoice.id}?send=1`)
                                  }
                                />
                              )}
                              {next.includes("CANCELLED") && (
                                <MenuItem
                                  icon={<LuBan size={13} />}
                                  label="Cancel PI"
                                  tone="rose"
                                  onClick={() => cancelInvoice(invoice)}
                                />
                              )}
                              {invoice.status === "DRAFT" && (
                                <MenuItem
                                  icon={<LuTrash2 size={13} />}
                                  label="Delete Draft"
                                  tone="rose"
                                  onClick={() => deleteInvoice(invoice)}
                                />
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={visible.length}
          totalPages={totalPages}
          onPageChange={setPage}
          noun="invoices"
        />
      </div>

      {showCreate && (
        <CreateProformaInvoiceModal
          onClose={() => setShowCreate(false)}
          onContinue={(order) =>
            router.push(`/sales/proforma-invoices/new?order=${order.id}`)
          }
          onError={reportError}
        />
      )}

      <PrintableProformaInvoice invoice={printTarget} profile={profile} />
    </div>
  );
}

/* =========================================================
   CREATE PROFORMA INVOICE
========================================================= */

function CreateProformaInvoiceModal({
  onClose,
  onContinue,
  onError,
}: {
  onClose: () => void;
  onContinue: (order: SalesOrderModel) => void;
  onError: (message: string) => void;
}) {
  const [orders, setOrders] = useState<SalesOrderModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SalesOrderModel | null>(null);

  const boxRef = useRef<HTMLDivElement | null>(null);

  /* onError must be stable (the list passes a memoised callback), or every
     parent render would refetch the orders. */
  useEffect(() => {
    getSalesOrdersApi()
      .then((list) => setOrders(list.filter((order) => order.status === "CONFIRMED")))
      .catch((error) => {
        console.error(error);
        onError("Unable to load confirmed sales orders.");
      })
      .finally(() => setLoading(false));
  }, [onError]);

  useEffect(() => {
    if (!open) return;

    const outside = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", outside);

    return () => document.removeEventListener("mousedown", outside);
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const matches = orders.filter((order) =>
    [order.order_number, order.customer_name, order.company_name]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 p-5 pt-[16vh] backdrop-blur-[2px]">
      <div className="w-full max-w-[910px] rounded-2xl bg-white shadow-2xl dark:bg-[#051422]">
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-5 dark:border-[#17304a]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Create Proforma Invoice
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <LuX size={16} />
          </button>
        </div>

        <div className="px-8 py-8">
          <label className="mb-1.5 block text-[11px] text-slate-600 dark:text-slate-300">
            Select Sales Order<span className="text-rose-500">*</span>
          </label>

          <div ref={boxRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="flex h-10 w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 text-left dark:border-[#17304a] dark:bg-[#071929]"
            >
              {selected ? (
                <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-[#0b2034] dark:text-slate-200">
                  #{selected.order_number || selected.id}
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">Select from the list</span>
              )}
              <LuChevronDown size={14} className="text-slate-700 dark:text-slate-300" />
            </button>

            {open && (
              <div className="absolute left-0 right-0 top-11 z-10 overflow-hidden rounded-xl bg-white shadow-[0_12px_40px_rgba(15,23,42,0.18)] dark:bg-[#071929]">
                {orders.length > 6 && (
                  <div className="border-b border-slate-100 p-2 dark:border-[#17304a]">
                    <input
                      autoFocus
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search by order, customer or company"
                      className="h-9 w-full rounded-md border border-slate-200 px-3 text-[11px] outline-none dark:border-[#17304a] dark:bg-[#051422] dark:text-white"
                    />
                  </div>
                )}

                <div className="max-h-[380px] overflow-y-auto">
                  {loading ? (
                    <p className="px-4 py-6 text-center text-[11px] text-slate-400">
                      Loading confirmed sales orders...
                    </p>
                  ) : matches.length === 0 ? (
                    <p className="px-4 py-6 text-center text-[11px] text-slate-400">
                      {orders.length === 0
                        ? "No confirmed sales orders. An order must be confirmed before it can be invoiced."
                        : "No confirmed orders match your search."}
                    </p>
                  ) : (
                    matches.map((order) => {
                      const contact = contactOf(order);

                      return (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => {
                            setSelected(order);
                            setOpen(false);
                          }}
                          className={`grid w-full grid-cols-[80px_minmax(0,1.6fr)_minmax(0,1.2fr)_70px_90px_80px] items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-100 dark:hover:bg-[#0b2034] ${
                            selected?.id === order.id ? "bg-slate-100 dark:bg-[#0b2034]" : ""
                          }`}
                        >
                          <span className="text-[10px] text-slate-800 dark:text-slate-200">
                            #{order.order_number || order.id}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[11px] font-semibold text-slate-900 dark:text-white">
                              {order.customer_name}
                            </span>
                            {contact.email && (
                              <span className="block truncate text-[10px] text-slate-600 dark:text-slate-400">
                                {contact.email}
                              </span>
                            )}
                            {order.state && (
                              <span className="flex items-center gap-1 text-[9px] text-slate-500">
                                <LuMapPin size={8} />
                                {order.state}
                              </span>
                            )}
                          </span>
                          <span className="truncate text-[11px] text-slate-700 dark:text-slate-300">
                            {order.company_name || "-"}
                          </span>
                          <span className="text-[10px] text-slate-800 dark:text-slate-200">
                            {compactMoney(order.grand_total)}
                          </span>
                          <span className="inline-flex w-fit items-center gap-1 truncate rounded bg-slate-100 px-1.5 py-1 text-[9px] text-slate-700 dark:bg-[#0b2034] dark:text-slate-300">
                            {order.assigned_to || "Unassigned"}
                          </span>
                          <span className="w-fit rounded bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-500">
                            Confirmed
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-slate-100 px-5 py-5 dark:border-[#17304a] dark:bg-[#071929]">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-md border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onContinue(selected)}
            className="h-9 rounded-md bg-[#233353] px-4 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SMALL PIECES
========================================================= */

function SortTh({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: 1 | -1 } | null;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;

  return (
    <th
      aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : undefined}
      className={`border-r border-slate-100 px-3 py-3 text-left dark:border-[#17304a] ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex w-full items-center justify-between gap-2 text-[11px] font-normal text-slate-600 dark:text-slate-300"
      >
        <span className="text-left leading-4">{label}</span>
        <span className="flex flex-col text-[7px] leading-[7px] text-slate-400">
          <span className={active && sort!.dir === 1 ? "text-slate-800 dark:text-white" : ""}>▲</span>
          <span className={active && sort!.dir === -1 ? "text-slate-800 dark:text-white" : ""}>▼</span>
        </span>
      </button>
    </th>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "rose";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-slate-50 dark:hover:bg-[#0b2034] ${
        tone === "rose" ? "text-rose-500" : "text-slate-700 dark:text-slate-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-medium text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-600 outline-none dark:border-[#17304a] dark:bg-[#051422] dark:text-slate-200"
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
