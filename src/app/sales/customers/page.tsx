"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";

import Modal from "@/components/ui/Modal";
import CustomerContactDrawer from "@/components/ui/CustomerContactDrawer";
import Pagination from "@/components/crm/Pagination";
import {
  LIST_TABLE,
  ListPage,
  ListPageHeader,
  ListToolbar,
  PrimaryAction,
  TableCard,
} from "@/components/crm/ListPageShell";
import { useUIStore } from "@/lib/store/ui.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { hasPermission } from "@/features/auth/utils/permissions";
import CustomerImportModal from "@/features/customers/components/CustomerImportModal";
import {
  CUSTOMER_BULK_UPLOAD_PERMISSION,
  CUSTOMER_STAGES,
  CustomerActivity,
  CustomerActivityType,
  CustomerModel,
  CustomerStage,
  convertCustomerToLeadApi,
  getCustomerActivitiesApi,
  getCustomerApi,
  getCustomersApi,
  logCustomerActivityApi,
  updateCustomerStageApi,
  updateCustomerStatusApi,
} from "@/features/customers/api/customers.api";
import { getUsersApi, User } from "@/features/users/api/users.api";
import { getStatesApi } from "@/features/locations/api/locations.api";

import {
  FiActivity,
  FiCalendar,
  FiChevronDown,
  FiDownload,
  FiEdit2,
  FiFile,
  FiLink,
  FiMapPin,
  FiMoreVertical,
  FiPhone,
  FiPlus,
  FiRotateCcw,
  FiSlash,
  FiUserPlus,
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

/** A row of the list: the stored customer plus the fields the table,
    filters and export read. */
interface Customer {
  id: string;
  code: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  gst?: string;
  pan?: string;
  category: string;
  status: "Active" | "Inactive";
  stage: CustomerStage;
  customerType?: string;
  assignedTo?: string;
  state?: string;
  lastActivity?: string;
  convertedLeadId?: number | null;
  raw: CustomerModel;
}

const CUSTOMER_TYPES = [
  "Distributor",
  "OEM",
  "End Customer",
  "Institution",
  "Corporate",
  "Other",
];

const STATUS_OPTIONS = ["All", "Active", "Inactive"];

function toRow(raw: CustomerModel): Customer {
  return {
    id: raw.id,
    code: raw.customer_code ? `#${raw.customer_code}` : "—",
    name: raw.name || "Unnamed Customer",
    contactName: raw.contact_name || raw.name || "",
    email: raw.email || "",
    phone: raw.phone || "",
    address: raw.address || "",
    gst: raw.gst || "",
    pan: raw.pan || "",
    category: raw.category || "General",
    status: raw.status === "Inactive" ? "Inactive" : "Active",
    stage: (raw.stage || "NEW") as CustomerStage,
    customerType: raw.customer_type || "",
    /* A customer with no assignee is followed up by whoever added it. */
    assignedTo: raw.assigned_to_name || raw.creator_name || "",
    state: raw.state || "",
    lastActivity: raw.last_activity_at || raw.updated_at || raw.created_at || "",
    convertedLeadId: raw.converted_lead_id ?? null,
    raw,
  };
}

function parseDate(value?: string) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    const parts = value.split("/");

    if (parts.length === 3) {
      const [day, month, year] = parts.map(Number);
      return new Date(year, month - 1, day);
    }

    return null;
  }

  return date;
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = parseDate(value);

  if (!date) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function errorText(error: unknown, fallback: string) {
  const data = (error as AxiosError<{ detail?: string; message?: string }>)
    .response?.data;
  return (typeof data?.detail === "string" && data.detail) || data?.message || fallback;
}

export default function CustomersPage() {
  const router = useRouter();
  const { addToast } = useUIStore();
  const superAdmin = useAuthStore((state) => state.user?.is_super_admin === true);

  /* Add From Excel needs its own tick in Roles & Access. */
  const canBulkUpload =
    superAdmin || hasPermission(CUSTOMER_BULK_UPLOAD_PERMISSION);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [status, setStatus] = useState("All");
  const [stateFilter, setStateFilter] = useState("");

  const [newCustomerMenuOpen, setNewCustomerMenuOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  /* Contact Details */
  const [drawerCustomer, setDrawerCustomer] = useState<CustomerModel | null>(null);
  const [activities, setActivities] = useState<CustomerActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [drawerBusy, setDrawerBusy] = useState(false);

  /* Convert To Lead */
  const [convertTarget, setConvertTarget] = useState<CustomerModel | null>(null);
  const [convertTitle, setConvertTitle] = useState("");
  const [convertRemarks, setConvertRemarks] = useState("");
  const [convertAssignee, setConvertAssignee] = useState("");
  const [converting, setConverting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [masterStates, setMasterStates] = useState<string[]>([]);

  // --------------------------------------------------
  // Loading
  // --------------------------------------------------

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const list = await getCustomersApi();
      setCustomers(list.map(toRow));
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      setCustomers([]);
      addToast(errorText(error, "Failed to load customers."), "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const handleRefreshCustomers = async () => {
    await fetchCustomers();
  };

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  /* The State filter lists every state in the States master, not only the
     ones customers already have - otherwise it is empty until one is set. */
  useEffect(() => {
    getStatesApi()
      .then((list) => setMasterStates(list.map((state) => state.name).filter(Boolean)))
      .catch(() => setMasterStates([]));
  }, []);

  /* Replace one customer in the list after an action, without a reload. */
  const applyCustomer = (updated: CustomerModel) => {
    setCustomers((current) =>
      current.map((row) => (row.id === updated.id ? toRow(updated) : row)),
    );
    setDrawerCustomer((open) => (open?.id === updated.id ? updated : open));
  };

  const loadActivities = useCallback(async (id: string) => {
    try {
      setActivitiesLoading(true);
      setActivities(await getCustomerActivitiesApi(id));
    } catch (error) {
      console.error(error);
      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  // --------------------------------------------------
  // Filters
  // --------------------------------------------------

  const assignedOptions = useMemo(
    () =>
      Array.from(
        new Set(
          customers
            .map((customer) => customer.assignedTo)
            .filter((value): value is string => Boolean(value)),
        ),
      ),
    [customers],
  );

  const stateOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...masterStates,
          ...customers
            .map((customer) => customer.state)
            .filter((value): value is string => Boolean(value)),
        ]),
      ).sort((a, b) => a.localeCompare(b)),
    [customers, masterStates],
  );

  const filteredCustomers = useMemo(() => {
    const searchValue = search.trim().toLowerCase();
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return customers.filter((customer) => {
      const searchableText = [
        customer.code,
        customer.name,
        customer.contactName,
        customer.email,
        customer.phone,
        customer.category,
        customer.customerType,
        customer.assignedTo,
        customer.state,
        customer.gst,
        customer.pan,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !searchValue || searchableText.includes(searchValue);
      const matchesCustomerType = !customerType || customer.customerType === customerType;
      const matchesAssigned = !assignedTo || customer.assignedTo === assignedTo;
      const matchesStatus = !status || status === "All" || customer.status === status;
      const matchesState = !stateFilter || customer.state === stateFilter;

      let matchesDate = true;

      if (fromDate || toDate) {
        const activityDate = parseDate(customer.lastActivity);

        if (!activityDate) {
          matchesDate = false;
        } else {
          if (fromDate && activityDate < fromDate) matchesDate = false;
          if (toDate && activityDate > toDate) matchesDate = false;
        }
      }

      return (
        matchesSearch &&
        matchesCustomerType &&
        matchesAssigned &&
        matchesStatus &&
        matchesState &&
        matchesDate
      );
    });
  }, [customers, search, dateFrom, dateTo, customerType, assignedTo, status, stateFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, dateFrom, dateTo, customerType, assignedTo, status, stateFilter]);

  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setCustomerType("");
    setAssignedTo("");
    setStatus("All");
    setStateFilter("");
    setCurrentPage(1);
  };

  const activeFilterCount =
    (dateFrom || dateTo ? 1 : 0) +
    (customerType ? 1 : 0) +
    (assignedTo ? 1 : 0) +
    (status && status !== "All" ? 1 : 0) +
    (stateFilter ? 1 : 0);

  // --------------------------------------------------
  // Export
  // --------------------------------------------------

  const handleExportData = () => {
    if (!filteredCustomers.length) {
      addToast("No customer data available to export.", "warning");
      return;
    }

    const headers = [
      "Customer ID",
      "Company",
      "Contact Name",
      "Email",
      "Phone",
      "Customer Type",
      "Assigned To",
      "Stage",
      "Status",
      "State",
      "Last Activity",
      "Category",
      "GST",
      "PAN",
    ];

    const stageLabel = (stage: CustomerStage) =>
      CUSTOMER_STAGES.find((item) => item.value === stage)?.label || stage;

    const rows = filteredCustomers.map((customer) => [
      customer.code.replace("#", ""),
      customer.name,
      customer.contactName,
      customer.email,
      customer.phone,
      customer.customerType || "",
      customer.assignedTo || "",
      stageLabel(customer.stage),
      customer.status,
      customer.state || "",
      formatDate(customer.lastActivity),
      customer.category,
      customer.gst || "",
      customer.pan || "",
    ]);

    const escapeCsvValue = (value: unknown) => {
      const stringValue = String(value ?? "");
      return /[",\n]/.test(stringValue)
        ? `"${stringValue.replace(/"/g, '""')}"`
        : stringValue;
    };

    const csvContent = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    const url = URL.createObjectURL(
      new Blob([csvContent], { type: "text/csv;charset=utf-8;" }),
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportMenuOpen(false);

    addToast(`${filteredCustomers.length} customer records exported successfully.`, "success");
  };

  const handleDownloadChart = () => {
    const activeCustomers = filteredCustomers.filter(
      (customer) => customer.status === "Active",
    ).length;

    const inactiveCustomers = filteredCustomers.filter(
      (customer) => customer.status === "Inactive",
    ).length;

    const totalCustomers = activeCustomers + inactiveCustomers;

    if (!totalCustomers) {
      addToast("No customer data available for the chart.", "warning");

      return;
    }

    const canvas = document.createElement("canvas");

    canvas.width = 1200;
    canvas.height = 700;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      addToast("Unable to generate customer chart.", "error");

      return;
    }

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = "#233353";
    ctx.font = "700 32px Arial";
    ctx.fillText("Customer Status Overview", 70, 75);

    ctx.fillStyle = "#64748b";
    ctx.font = "16px Arial";
    ctx.fillText(`Total Customers: ${totalCustomers}`, 70, 110);

    const chartX = 170;
    const chartY = 170;
    const chartWidth = 850;
    const chartHeight = 350;

    const maxValue = Math.max(activeCustomers, inactiveCustomers, 1);

    // Grid lines
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 5; i++) {
      const y = chartY + chartHeight - (i / 5) * chartHeight;

      ctx.beginPath();
      ctx.moveTo(chartX, y);
      ctx.lineTo(chartX + chartWidth, y);
      ctx.stroke();

      ctx.fillStyle = "#94a3b8";
      ctx.font = "13px Arial";

      const value = Math.round((i / 5) * maxValue);

      ctx.fillText(String(value), chartX - 40, y + 5);
    }

    const barWidth = 180;

    const drawBar = (
      x: number,
      value: number,
      label: string,
      barColor: string,
    ) => {
      const height = (value / maxValue) * chartHeight;

      const y = chartY + chartHeight - height;

      ctx.fillStyle = barColor;

      ctx.fillRect(x, y, barWidth, height);

      ctx.fillStyle = "#233353";
      ctx.font = "700 18px Arial";

      ctx.textAlign = "center";

      ctx.fillText(String(value), x + barWidth / 2, y - 12);

      ctx.fillStyle = "#475569";
      ctx.font = "600 16px Arial";

      ctx.fillText(label, x + barWidth / 2, chartY + chartHeight + 40);

      ctx.textAlign = "left";
    };

    drawBar(chartX + 170, activeCustomers, "Active", "#22c55e");

    drawBar(chartX + 520, inactiveCustomers, "Inactive", "#ef4444");

    // Footer
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px Arial";

    ctx.fillText(
      `Generated on ${new Date().toLocaleDateString("en-IN")}`,
      70,
      650,
    );

    canvas.toBlob((blob) => {
      if (!blob) {
        addToast("Failed to download chart.", "error");

        return;
      }

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;
      link.download = `customer-status-chart-${new Date()
        .toISOString()
        .slice(0, 10)}.png`;

      document.body.appendChild(link);

      link.click();

      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      setExportMenuOpen(false);

      addToast("Customer chart downloaded successfully.", "success");
    }, "image/png");
  };
  // --------------------------------------------------
  // New Customer menu
  // --------------------------------------------------

  const handleAddSingleLead = () => {
    setNewCustomerMenuOpen(false);
    router.push("/sales/customers/create");
  };

  const handleAddFromExcel = () => {
    setNewCustomerMenuOpen(false);

    if (!canBulkUpload) {
      addToast("Your role has not been given Bulk Upload for customers.", "warning");
      return;
    }

    setShowImportModal(true);
  };

  const openIntegrationContact = () => {
    setNewCustomerMenuOpen(false);
    addToast("No integration is connected yet.", "info");
  };

  // --------------------------------------------------
  // Contact Details
  // --------------------------------------------------

  const openContactDetails = (customer: Customer) => {
    setOpenRowMenu(null);
    setNewCustomerMenuOpen(false);
    setDrawerCustomer(customer.raw);
    loadActivities(customer.id);

    /* Pick up anything changed since the list loaded. */
    getCustomerApi(customer.id)
      .then(applyCustomer)
      .catch(() => undefined);
  };

  const editCustomer = (customer: CustomerModel) => {
    router.push(`/sales/customers/create?edit=${customer.id}`);
  };

  /** Runs a drawer action, refreshing the customer and its timeline. */
  const runDrawerAction = async (
    customer: CustomerModel,
    action: () => Promise<CustomerModel | void>,
    success: string,
    failure: string,
  ) => {
    try {
      setDrawerBusy(true);
      const updated = await action();
      if (updated) applyCustomer(updated);
      await loadActivities(customer.id);
      addToast(success, "success");
      return true;
    } catch (error) {
      console.error(error);
      addToast(errorText(error, failure), "error");
      return false;
    } finally {
      setDrawerBusy(false);
    }
  };

  const changeStage = (customer: CustomerModel, stage: CustomerStage) => {
    const label = CUSTOMER_STAGES.find((item) => item.value === stage)?.label;

    runDrawerAction(
      customer,
      () => updateCustomerStageApi(customer.id, stage),
      `Moved to ${label}.`,
      "Could not change the stage.",
    );
  };

  const logActivity = (
    customer: CustomerModel,
    type: CustomerActivityType,
    description: string,
  ) =>
    runDrawerAction(
      customer,
      async () => {
        await logCustomerActivityApi(customer.id, type, description);
        return getCustomerApi(customer.id);
      },
      "Activity logged.",
      "Could not log the activity.",
    );

  const markDead = (customer: CustomerModel, reason: string) =>
    runDrawerAction(
      customer,
      () => updateCustomerStatusApi(customer.id, "Inactive", reason),
      `${customer.name} marked as dead.`,
      "Could not mark the customer as dead.",
    );

  const reactivate = (customer: CustomerModel) =>
    runDrawerAction(
      customer,
      () => updateCustomerStatusApi(customer.id, "Active"),
      `${customer.name} is active again.`,
      "Could not reactivate the customer.",
    );

  // --------------------------------------------------
  // Convert To Lead
  // --------------------------------------------------

  const openConvertLead = (customer: CustomerModel) => {
    setConvertTarget(customer);
    setConvertTitle(customer.name);
    setConvertRemarks("");
    setConvertAssignee(customer.assigned_to_id || "");

    if (!users.length) {
      getUsersApi(1, 500, { skipErrorToast: true })
        .then((response) => setUsers(response.data))
        .catch(() => setUsers([]));
    }
  };

  const confirmConvertLead = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!convertTarget) return;

    try {
      setConverting(true);

      const result = await convertCustomerToLeadApi(convertTarget.id, {
        title: convertTitle.trim() || undefined,
        remarks: convertRemarks.trim() || undefined,
        assigned_to_id: convertAssignee || undefined,
      });

      applyCustomer(result.customer);
      if (drawerCustomer?.id === convertTarget.id) loadActivities(convertTarget.id);

      addToast(`Lead #${result.lead_id} created from ${convertTarget.name}.`, "success");
      setConvertTarget(null);
    } catch (error) {
      console.error(error);
      addToast(errorText(error, "Could not convert this customer to a lead."), "error");
    } finally {
      setConverting(false);
    }
  };

  return (
    <ListPage>
      <div
        className="space-y-5"
        onClick={() => {
          setOpenRowMenu(null);
          setNewCustomerMenuOpen(false);
          setExportMenuOpen(false);
        }}
      >
        {/* ============================================================
            PAGE HEADER
        ============================================================ */}

        <ListPageHeader
          title="Customers"
          refreshing={loading}
          onRefresh={handleRefreshCustomers}
          actions={
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((prev) => !prev)}
                title="More Actions"
                aria-label="More Actions"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-md bg-white text-[#131313] transition hover:bg-slate-50 dark:border dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-300 dark:hover:bg-[#0b2034]"
              >
                <FiMoreVertical size={15} />
              </button>

              {exportMenuOpen && (
                <div className="absolute right-0 top-9 z-50 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-[#17304a] dark:bg-[#071929]">
                  <MenuItem icon={<FiDownload />} onClick={handleExportData}>
                    Export Data
                  </MenuItem>

                  <MenuItem icon={<FiDownload />} onClick={handleDownloadChart}>
                    Download Chart
                  </MenuItem>
                </div>
              )}
            </div>
          }
        />

        {/* ============================================================
            SEARCH + FILTER + NEW CUSTOMER
        ============================================================ */}

        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <ListToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Search Customers"
            activeFilterCount={activeFilterCount}
            onToggleFilters={() => {
              setFilterOpen((prev) => !prev);
              setNewCustomerMenuOpen(false);
            }}
            trailing={
              <PrimaryAction
                onClick={() => {
                  setNewCustomerMenuOpen((prev) => !prev);
                  setFilterOpen(false);
                }}
                icon={<FiPlus size={15} />}
              >
                New Customer
              </PrimaryAction>
            }
          />

          {/* New Customer menu */}
          {newCustomerMenuOpen && (
            <div className="absolute right-0 top-[48px] z-50 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-[#17304a] dark:bg-[#071929]">
              <MenuItem icon={<FiUserPlus />} onClick={handleAddSingleLead}>
                Add Single Customer
              </MenuItem>

              {/* Only for roles given Bulk Upload in Roles & Access. */}
              {canBulkUpload && (
                <MenuItem icon={<FiFile />} onClick={handleAddFromExcel}>
                  Add From Excel
                </MenuItem>
              )}

              <MenuItem icon={<FiLink />} onClick={openIntegrationContact}>
                Add From Integration
              </MenuItem>
            </div>
          )}

          {/* Filter popover */}
          {filterOpen && (
            <div className="absolute right-0 top-[48px] z-50 w-full max-w-[520px] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.12)] sm:right-[150px] dark:border-[#17304a] dark:bg-[#071929]">
              <div className="mb-4 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500">
                  Date Range
                </label>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-[11px] font-medium text-rose-500 hover:text-rose-600"
                >
                  × Clear Filter
                </button>
              </div>

              <div className="mb-5 flex items-center gap-2">
                <div className="relative flex-1">
                  <FiCalendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-[39px] w-full rounded-lg border border-[#d1d1d1] bg-white pl-10 pr-3 text-[13px] text-slate-700 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#051422] dark:text-white"
                  />
                </div>

                <span className="text-slate-400">-</span>

                <div className="relative flex-1">
                  <FiCalendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

                  <input
                    type="date"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-[39px] w-full rounded-lg border border-[#d1d1d1] bg-white pl-10 pr-3 text-[13px] text-slate-700 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#051422] dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FilterSelect
                  label="Customer Type"
                  value={customerType}
                  placeholder="Select the customer type"
                  options={CUSTOMER_TYPES}
                  onChange={setCustomerType}
                />

                <FilterSelect
                  label="Assigned to"
                  value={assignedTo}
                  placeholder="Select"
                  options={assignedOptions}
                  onChange={setAssignedTo}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <FilterSelect
                  label="Status"
                  value={status}
                  placeholder="Select Status"
                  options={STATUS_OPTIONS}
                  onChange={setStatus}
                />

                <FilterSelect
                  label="State"
                  value={stateFilter}
                  placeholder="Select State"
                  options={stateOptions}
                  onChange={setStateFilter}
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-5">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-slate-600 hover:text-[#233353] dark:text-slate-300"
                >
                  Clear All Filter
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFilterOpen(false);
                    setCurrentPage(1);
                  }}
                  className="h-[39px] rounded-lg bg-[#273756] px-5 text-[13px] font-medium text-white transition hover:bg-[#18243a]"
                >
                  Apply Filter
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================
            CUSTOMER TABLE
        ============================================================ */}

        <TableCard>
          {loading ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-slate-400">
              <CgSpinner className="animate-spin text-3xl text-[#233353]" />
              <span className="text-xs font-semibold">Loading customers...</span>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-center">
              <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                No Customers Found
              </p>
              <p className="text-[12px] text-[#777777] dark:text-slate-400">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table
                  className={`w-full min-w-[900px] border-collapse text-left ${LIST_TABLE}`}
                >
                  <thead>
                    <tr>
                      <th className="w-12 px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label="Select all customers"
                          className="h-4 w-4 rounded border-slate-300"
                        />
                      </th>
                      <th className="px-4 py-3">
                        <SortLabel label="Cust. ID" />
                      </th>
                      <th className="px-4 py-3">
                        <SortLabel label="Customer Name" />
                      </th>
                      <th className="px-4 py-3">
                        <SortLabel label="Company" />
                      </th>
                      <th className="px-4 py-3">
                        <SortLabel label="Assigned To" />
                      </th>
                      <th className="px-4 py-3">
                        <SortLabel label="Status" />
                      </th>
                      <th className="px-4 py-3">
                        <SortLabel label="Last Activity" />
                      </th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedCustomers.map((customer) => (
                      <tr
                        key={customer.id}
                        onClick={() => openContactDetails(customer)}
                        className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-[#0b2034]/50"
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${customer.name}`}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <span className="whitespace-nowrap text-[11px] font-medium text-slate-800 dark:text-slate-300">
                            {customer.code}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <p className="text-[12px] font-semibold text-slate-900 dark:text-white">
                            {customer.contactName || customer.name}
                          </p>

                          <p className="text-[10px] text-slate-700 [overflow-wrap:anywhere] dark:text-slate-400">
                            {customer.email || "No email"}
                          </p>

                          <p className="flex items-center gap-1 text-[9px] text-slate-600 dark:text-slate-400">
                            <FiMapPin size={9} />
                            {customer.state || customer.address || "India"}
                          </p>

                          {customer.raw.is_draft && (
                            <span className="mr-1 mt-1 inline-flex rounded bg-[#dae8f4] px-1.5 py-0.5 text-[9px] font-semibold text-[#038aff] dark:bg-blue-950/30 dark:text-blue-400">
                              Draft
                            </span>
                          )}

                          {customer.convertedLeadId && (
                            <span className="mt-1 inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                              Lead #{customer.convertedLeadId}
                            </span>
                          )}
                        </td>

                        <td className="max-w-[180px] px-4 py-3">
                          <p className="text-[12px] text-slate-700 dark:text-slate-300">
                            {customer.name}
                          </p>
                        </td>

                        <td className="px-4 py-3">
                          {customer.assignedTo ? (
                            <div className="inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-slate-100 px-2 py-1 dark:bg-[#0b2034]">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-[8px] text-slate-700 dark:bg-[#17304a] dark:text-slate-200">
                                {customer.assignedTo.charAt(0).toUpperCase()}
                              </span>

                              <span className="max-w-[130px] truncate text-[10px] text-slate-700 dark:text-slate-200">
                                {customer.assignedTo}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Unassigned</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <CustomerStatus status={customer.status} />
                        </td>

                        <td className="px-4 py-3">
                          <span className="whitespace-nowrap text-[10px] text-slate-700 dark:text-slate-300">
                            {formatDate(customer.lastActivity)}
                          </span>
                        </td>

                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <a
                              href={customer.phone ? `tel:${customer.phone}` : undefined}
                              onClick={(event) => {
                                if (!customer.phone) {
                                  event.preventDefault();
                                  openContactDetails(customer);
                                }
                              }}
                              title={customer.phone ? `Call ${customer.phone}` : "Contact Details"}
                              aria-label="Call"
                              className="rounded-lg p-2 text-[#131313] transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#0b2034]"
                            >
                              <FiPhone size={13} />
                            </a>

                            <div className="relative">
                              <button
                                type="button"
                                title="More Actions"
                                aria-label="More Actions"
                                onClick={() =>
                                  setOpenRowMenu(openRowMenu === customer.id ? null : customer.id)
                                }
                                className="rounded-lg p-2 text-[#131313] transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#0b2034]"
                              >
                                <FiMoreVertical size={14} />
                              </button>

                              {openRowMenu === customer.id && (
                                <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-[#17304a] dark:bg-[#071929]">
                                  <MenuItem
                                    icon={<FiEdit2 />}
                                    onClick={() => editCustomer(customer.raw)}
                                  >
                                    Edit
                                  </MenuItem>

                                  <MenuItem
                                    icon={<FiActivity />}
                                    onClick={() => openContactDetails(customer)}
                                  >
                                    View Activities
                                  </MenuItem>

                                  {customer.status === "Inactive" ? (
                                    <MenuItem
                                      icon={<FiRotateCcw />}
                                      onClick={() => {
                                        setOpenRowMenu(null);
                                        reactivate(customer.raw);
                                      }}
                                    >
                                      Reactivate
                                    </MenuItem>
                                  ) : (
                                    <MenuItem
                                      icon={<FiSlash />}
                                      onClick={() => openContactDetails(customer)}
                                    >
                                      Mark as Dead
                                    </MenuItem>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={currentPage}
                pageSize={PAGE_SIZE}
                totalItems={filteredCustomers.length}
                totalPages={Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE))}
                onPageChange={setCurrentPage}
                noun="customers"
              />
            </>
          )}
        </TableCard>
      </div>

      {showImportModal && (
        <CustomerImportModal
          onClose={() => setShowImportModal(false)}
          onImported={(result) => {
            addToast(
              `${result.created} customer${result.created === 1 ? "" : "s"} imported.`,
              "success",
            );
            fetchCustomers();
          }}
        />
      )}

      <CustomerContactDrawer
        customer={drawerCustomer}
        activities={activities}
        loading={activitiesLoading}
        busy={drawerBusy}
        onClose={() => setDrawerCustomer(null)}
        onEdit={editCustomer}
        onStageChange={changeStage}
        onLogActivity={logActivity}
        onMarkDead={markDead}
        onReactivate={reactivate}
        onConvertToLead={openConvertLead}
      />

      {convertTarget && (
        <Modal
          isOpen
          onClose={() => setConvertTarget(null)}
          title="Convert To Lead"
        >
          <form onSubmit={confirmConvertLead} className="space-y-4">
            <p className="text-[12px] text-[#777777] dark:text-slate-400">
              A new lead is opened for{" "}
              <span className="font-medium text-[#141414] dark:text-white">
                {convertTarget.name}
              </span>{" "}
              with its contact, address and registration details.
            </p>

            <div>
              <label className="mb-1.5 block text-[12px] text-[#777777] dark:text-slate-400">
                Lead Title
              </label>
              <input
                value={convertTitle}
                onChange={(e) => setConvertTitle(e.target.value)}
                className="h-[39px] w-full rounded-lg border border-[#d1d1d1] bg-white px-3 text-[13px] text-[#141414] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] text-[#777777] dark:text-slate-400">
                Assign To
              </label>
              <div className="relative">
                <select
                  value={convertAssignee}
                  onChange={(e) => setConvertAssignee(e.target.value)}
                  className="h-[39px] w-full appearance-none rounded-lg border border-[#d1d1d1] bg-white px-3 pr-9 text-[13px] text-[#141414] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
                >
                  <option value="">Same as the customer</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {`${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-[12px] text-[#777777] dark:text-slate-400">
                Requirements / Remarks
              </label>
              <textarea
                rows={4}
                value={convertRemarks}
                onChange={(e) => setConvertRemarks(e.target.value)}
                placeholder="What is the customer looking for?"
                className="w-full resize-none rounded-lg border border-[#d1d1d1] bg-[#f3f3f3] p-3 text-[13px] text-[#141414] outline-none placeholder:text-[#a9a9a9] focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-[#17304a]">
              <button
                type="button"
                onClick={() => setConvertTarget(null)}
                className="h-[39px] rounded-lg border border-[#d1d1d1] bg-white px-4 text-[13px] text-slate-700 hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={converting}
                className="inline-flex h-[39px] items-center gap-2 rounded-lg bg-[#273756] px-4 text-[13px] font-medium text-white hover:bg-[#18243a] disabled:opacity-50"
              >
                {converting && <CgSpinner className="animate-spin" />}
                Create Lead
              </button>
            </div>
          </form>
        </Modal>
      )}
    </ListPage>
  );
}

/* ================================================================
   FILTER SELECT
================================================================ */

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-500">
        {label}
      </label>

      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-[39px] w-full cursor-pointer appearance-none rounded-lg border border-[#d1d1d1] bg-white px-3.5 pr-9 text-[13px] text-slate-700 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#051422] dark:text-white"
        >
          <option value="">{placeholder}</option>

          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
      </div>
    </div>
  );
}

/* ================================================================
   SMALL PIECES
================================================================ */

/** Column label with the design's sort chevrons. */
function SortLabel({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      {label}

      <span className="flex flex-col leading-[6px] text-slate-300">
        <span>⌃</span>
        <span>⌄</span>
      </span>
    </span>
  );
}

/** Outlined pill with a leading dot, as in the design. */
function CustomerStatus({ status }: { status: Customer["status"] }) {
  const active = status === "Active";

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${
        active
          ? "border-emerald-400 bg-emerald-50 text-emerald-600 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          : "border-rose-400 bg-rose-50 text-rose-500 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-400"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500" : "bg-rose-500"
        }`}
      />
      {status}
    </span>
  );
}

function MenuItem({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#0b2034]"
    >
      <span className="text-slate-500">{icon}</span>
      {children}
    </button>
  );
}
