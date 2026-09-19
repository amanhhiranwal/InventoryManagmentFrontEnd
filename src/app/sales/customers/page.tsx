"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import CustomerContactDrawer, {
  ContactDrawerCustomer,
} from "@/components/ui/CustomerContactDrawer";

import { useUIStore } from "@/lib/store/ui.store";
import CustomerImportModal from "@/features/customers/components/CustomerImportModal";
import Pagination from "@/components/crm/Pagination";
import {
  LIST_TABLE,
  ListPage,
  ListPageHeader,
  ListToolbar,
  PrimaryAction,
  TableCard,
} from "@/components/crm/ListPageShell";
import { createLeadApi } from "@/features/workflows/api/workflows.api";
import { getRolesApi, Role } from "@/features/rbac/api/rbac.api";

import {
  FiPlus,
  FiCalendar,
  FiMapPin,
  FiChevronDown,
  FiUserPlus,
  FiFile,
  FiLink,
  FiPhone,
  FiMoreVertical,
  FiEdit2,
  FiActivity,
  FiSlash,
  FiX,
  FiDownload,
} from "react-icons/fi";

import { CgSpinner } from "react-icons/cg";

interface Customer {
  id: string;
  name: string;
  isRegistered: boolean;
  email: string;
  phone: string;
  address: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  gst?: string;
  pan?: string;
  category: string;
  kycDocs: string[];
  status: "Active" | "Inactive";

  // New UI fields
  customerType?: string;
  assignedTo?: string;
  assignedToId?: string;
  state?: string;
  lastActivity?: string;
  image?: string;
}

interface InvoiceItem {
  description: string;
  qty: number;
  price: number;
  gstRate: number;
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

function normalizeCustomer(raw: any, index: number): Customer {
  return {
    id: String(raw.id ?? raw._id ?? `customer-${index}`),

    name:
      raw.name ??
      raw.company ??
      raw.company_name ??
      raw.firm_name ??
      "Unnamed Customer",

    email: raw.email ?? raw.contact_email ?? "",

    phone: raw.phone ?? raw.mobile ?? raw.mobile_no ?? raw.contact_phone ?? "",

    address: raw.address ?? "",

    contactName:
      raw.contactName ??
      raw.contact_name ??
      raw.contact_person ??
      raw.name ??
      "",

    contactEmail: raw.contactEmail ?? raw.contact_email ?? raw.email ?? "",

    contactPhone: raw.contactPhone ?? raw.contact_phone ?? raw.phone ?? "",

    gst: raw.gst ?? raw.gstin ?? "",
    pan: raw.pan ?? "",

    category: raw.category ?? raw.customer_category ?? "General",

    kycDocs: Array.isArray(raw.kycDocs)
      ? raw.kycDocs
      : Array.isArray(raw.kyc_docs)
        ? raw.kyc_docs
        : [],

    status:
      raw.status === "Inactive" || raw.status === "inactive"
        ? "Inactive"
        : "Active",

    customerType:
      raw.customerType ?? raw.customer_type ?? raw.type ?? "Distributor",

    /* Customers carry no assignee yet; the person who added the account
       owns it, as on the Leads list. */
    assignedTo:
      raw.assignedTo ??
      raw.assigned_to_name ??
      raw.assigned_to ??
      raw.creator_name ??
      "",

    assignedToId: raw.assignedToId ?? raw.assigned_to_id ?? "",

    state: raw.state ?? raw.region ?? "",

    lastActivity:
      raw.lastActivity ??
      raw.last_activity ??
      raw.updated_at ??
      raw.created_at ??
      "",

    image: raw.image ?? raw.profile_image ?? raw.user_image ?? "",

    isRegistered: Boolean(raw.isRegistered ?? raw.is_registered ?? raw.gst),
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

export default function CustomersPage() {
  const router = useRouter();
  const { addToast } = useUIStore();

  // --------------------------------------------------
  // Customers
  // --------------------------------------------------

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // --------------------------------------------------
  // Search
  // --------------------------------------------------

  const [search, setSearch] = useState("");

  // --------------------------------------------------
  // Filter
  // --------------------------------------------------

  const [filterOpen, setFilterOpen] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [customerType, setCustomerType] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [status, setStatus] = useState("All");
  const [stateFilter, setStateFilter] = useState("");

  // --------------------------------------------------
  // New Customer menu
  // --------------------------------------------------

  const [newCustomerMenuOpen, setNewCustomerMenuOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // --------------------------------------------------
  // Export menu
  // --------------------------------------------------

  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // --------------------------------------------------
  // Row menu
  // --------------------------------------------------

  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null);

  // --------------------------------------------------
  // Contact drawer
  // --------------------------------------------------

  const [drawerOpen, setDrawerOpen] = useState(false);

  const [drawerCustomer, setDrawerCustomer] =
    useState<ContactDrawerCustomer | null>(null);

  // --------------------------------------------------
  // Pagination
  // --------------------------------------------------

  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 10;

  // --------------------------------------------------
  // Convert lead
  // --------------------------------------------------

  const [showConvertModal, setShowConvertModal] = useState(false);

  const [selectedConvertCustomer, setSelectedConvertCustomer] =
    useState<Customer | null>(null);

  const [convertTitle, setConvertTitle] = useState("");
  const [convertDesc, setConvertDesc] = useState("");

  const [dbRoles, setDbRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");

  const [convertingLead, setConvertingLead] = useState(false);

  const [convertedCustomerIds, setConvertedCustomerIds] = useState<string[]>(
    [],
  );

  // --------------------------------------------------
  // Invoice
  // --------------------------------------------------

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceCustomer] = useState<Customer | null>(null);

  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    {
      description: "Product / Service Supply",
      qty: 1,
      price: 50000,
      gstRate: 18,
    },
  ]);

  const [invoiceNumber] = useState("");

  const [showPrintModal, setShowPrintModal] = useState(false);

  const [printedInvoice, setPrintedInvoice] = useState<{
    customer: Customer;
    items: InvoiceItem[];
    invoiceNo: string;
    subTotal: number;
    gstTotal: number;
    grandTotal: number;
    date: string;
  } | null>(null);

  // --------------------------------------------------
  // Fetch customers
  // --------------------------------------------------

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);

      const res = await api.get("/api/v1/customers/");

      const list = Array.isArray(res.data?.data)
        ? res.data.data
        : Array.isArray(res.data)
          ? res.data
          : [];

      setCustomers(
        list.map((item: any, index: number) => normalizeCustomer(item, index)),
      );
    } catch (error) {
      console.error("Failed to fetch customers:", error);
      setCustomers([]);
      addToast("Failed to load customers.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // --------------------------------------------------
  // Page refresh
  // --------------------------------------------------

  const handleRefreshCustomers = async () => {
    await fetchCustomers();
  };

  // --------------------------------------------------
  // Initial load
  // --------------------------------------------------

  useEffect(() => {
    fetchCustomers();

    const loadRoles = async () => {
      try {
        const roles = await getRolesApi();

        setDbRoles(roles || []);

        if (roles?.length) {
          setSelectedRoleId(roles[0].id);
        }
      } catch (error) {
        console.error("Failed to load roles:", error);
      }
    };

    loadRoles();
  }, [fetchCustomers]);

  // --------------------------------------------------
  // Filter options
  // --------------------------------------------------

  const assignedOptions = useMemo(() => {
    return Array.from(
      new Set(
        customers
          .map((customer) => customer.assignedTo)
          .filter((value): value is string => Boolean(value)),
      ),
    );
  }, [customers]);

  const stateOptions = useMemo(() => {
    return Array.from(
      new Set(
        customers
          .map((customer) => customer.state)
          .filter((value): value is string => Boolean(value)),
      ),
    );
  }, [customers]);

  // --------------------------------------------------
  // Filtering
  // --------------------------------------------------

  const filteredCustomers = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;

    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return customers.filter((customer) => {
      const searchableText = [
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

      const matchesSearch =
        !searchValue || searchableText.includes(searchValue);

      const matchesCustomerType =
        !customerType || customer.customerType === customerType;

      const matchesAssigned = !assignedTo || customer.assignedTo === assignedTo;

      const matchesStatus =
        !status || status === "All" || customer.status === status;

      const matchesState = !stateFilter || customer.state === stateFilter;

      let matchesDate = true;

      if (fromDate || toDate) {
        const activityDate = parseDate(customer.lastActivity);

        if (!activityDate) {
          matchesDate = false;
        } else {
          if (fromDate && activityDate < fromDate) {
            matchesDate = false;
          }

          if (toDate && activityDate > toDate) {
            matchesDate = false;
          }
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
  }, [
    customers,
    search,
    dateFrom,
    dateTo,
    customerType,
    assignedTo,
    status,
    stateFilter,
  ]);

  // --------------------------------------------------
  // Pagination
  // --------------------------------------------------

  useEffect(() => {
    setCurrentPage(1);
  }, [search, dateFrom, dateTo, customerType, assignedTo, status, stateFilter]);

  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // --------------------------------------------------
  // Clear filters
  // --------------------------------------------------

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setCustomerType("");
    setAssignedTo("");
    setStatus("All");
    setStateFilter("");
    setCurrentPage(1);
  };

  // --------------------------------------------------
  // Export Data
  // --------------------------------------------------

  const handleExportData = () => {
    if (!filteredCustomers.length) {
      addToast("No customer data available to export.", "warning");
      return;
    }

    const headers = [
      "Customer ID",
      "Customer Name",
      "Contact Name",
      "Email",
      "Phone",
      "Company",
      "Customer Type",
      "Assigned To",
      "Status",
      "State",
      "Last Activity",
      "Category",
      "GST",
      "PAN",
    ];

    const rows = filteredCustomers.map((customer, index) => {
      const customerId = `CUS-${1042 + index}`;

      return [
        customerId,
        customer.name,
        customer.contactName,
        customer.email,
        customer.phone,
        customer.name,
        customer.customerType || "",
        customer.assignedTo || "",
        customer.status,
        customer.state || "",
        formatDate(customer.lastActivity),
        customer.category,
        customer.gst || "",
        customer.pan || "",
      ];
    });

    const escapeCsvValue = (value: unknown) => {
      const stringValue = String(value ?? "");

      if (
        stringValue.includes(",") ||
        stringValue.includes('"') ||
        stringValue.includes("\n")
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    };

    const csvContent = [
      headers.map(escapeCsvValue).join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    setExportMenuOpen(false);

    addToast(
      `${filteredCustomers.length} customer records exported successfully.`,
      "success",
    );
  };

  // --------------------------------------------------
  // Download Customer Chart
  // --------------------------------------------------

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
  // Contact drawer
  // --------------------------------------------------

  const openContactDetails = (customer: Customer | ContactDrawerCustomer) => {
    setOpenRowMenu(null);
    setNewCustomerMenuOpen(false);

    const normalized: ContactDrawerCustomer = {
      id: customer.id,
      name: customer.name,
      contactName: customer.contactName || customer.name,
      email: customer.email,
      phone: customer.phone,
      company: "company" in customer ? customer.company : customer.name,
      designation:
        "designation" in customer ? customer.designation : "Contact Person",
      location:
        "location" in customer
          ? customer.location
          : customer.address || "India",
      status: customer.status,
      customerType:
        "customerType" in customer
          ? customer.customerType || "Distributor"
          : "Distributor",
      image: "image" in customer ? customer.image : undefined,
    };

    setDrawerCustomer(normalized);
    setDrawerOpen(true);
  };

  // --------------------------------------------------
  // Integration contact
  // --------------------------------------------------

  const openIntegrationContact = () => {
    setNewCustomerMenuOpen(false);

    openContactDetails({
      id: "integration-rakesh-suri",
      name: "Rakesh Suri",
      contactName: "Rakesh Suri",
      email: "rakesh@techvision.com",
      phone: "9876543210",
      company: "TechVision Corp",
      designation: "IT Director",
      location: "Karnataka",
      status: "Active",
      customerType: "Corporate",
    });
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
    setShowImportModal(true);
  };

  // --------------------------------------------------
  // Drawer actions
  // --------------------------------------------------

  const handleDrawerEdit = (customer: ContactDrawerCustomer) => {
    addToast(`Edit customer: ${customer.name}`, "info");
  };

  const handleDrawerMarkDead = (customer: ContactDrawerCustomer) => {
    addToast(`${customer.name} marked as dead.`, "warning");
  };

  // --------------------------------------------------
  // Convert to Lead
  // --------------------------------------------------

  const openConvertLead = (customer: Customer) => {
    setSelectedConvertCustomer(customer);

    setConvertTitle(`Lead: ${customer.name}`);

    setConvertDesc(
      `Client: ${customer.name}
Contact: ${customer.contactName || customer.name} (${customer.phone})
Email: ${customer.email}
Address: ${customer.address}
Customer Type: ${customer.customerType || "Distributor"}
Dealing Category: ${customer.category}
Tax Registration: ${
        customer.isRegistered
          ? `GST Registered (${customer.gst || "N/A"})`
          : `Unregistered (PAN: ${customer.pan || "N/A"})`
      }`,
    );

    setShowConvertModal(true);
  };

  const handleConvertLeadConfirm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedConvertCustomer) return;

    if (!convertTitle.trim()) {
      addToast("Lead Title is required.", "warning");
      return;
    }

    try {
      setConvertingLead(true);

      const selectedRole = dbRoles.find((role) => role.id === selectedRoleId);

      const roleName = selectedRole?.name || "Workflow Role";

      await createLeadApi({
        title: convertTitle.trim(),
        description: `Target Role: ${roleName}

${convertDesc.trim()}`,
        status: "new",
      });

      setConvertedCustomerIds((prev) => [...prev, selectedConvertCustomer.id]);

      addToast("Customer converted to Sales Lead successfully!", "success");

      setShowConvertModal(false);
      setSelectedConvertCustomer(null);
    } catch (error) {
      console.error(error);

      addToast("Failed to create Lead in workflow pipeline.", "error");
    } finally {
      setConvertingLead(false);
    }
  };

  // --------------------------------------------------
  // Invoice
  // --------------------------------------------------

  const addInvoiceRow = () => {
    setInvoiceItems((prev) => [
      ...prev,
      {
        description: "",
        qty: 1,
        price: 0,
        gstRate: invoiceCustomer?.isRegistered ? 18 : 0,
      },
    ]);
  };

  const removeInvoiceRow = (index: number) => {
    setInvoiceItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateInvoiceItem = (index: number, fields: Partial<InvoiceItem>) => {
    setInvoiceItems((prev) => {
      const next = [...prev];

      next[index] = {
        ...next[index],
        ...fields,
      };

      return next;
    });
  };

  const generateInvoiceBill = () => {
    if (!invoiceCustomer) return;

    if (
      invoiceItems.some(
        (item) => !item.description.trim() || item.price <= 0 || item.qty <= 0,
      )
    ) {
      addToast(
        "Please provide valid item description, price, and quantity for all rows.",
        "warning",
      );
      return;
    }

    let subTotal = 0;
    let gstTotal = 0;

    invoiceItems.forEach((item) => {
      const lineTotal = item.qty * item.price;

      subTotal += lineTotal;

      if (invoiceCustomer.isRegistered) {
        gstTotal += (lineTotal * item.gstRate) / 100;
      }
    });

    const grandTotal = subTotal + gstTotal;

    setPrintedInvoice({
      customer: invoiceCustomer,
      items: invoiceItems,
      invoiceNo: invoiceNumber,
      subTotal,
      gstTotal,
      grandTotal,
      date: new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    });

    setShowInvoiceModal(false);
    setShowPrintModal(true);
  };

  // --------------------------------------------------
  // KPI
  // --------------------------------------------------

  const activeFilterCount =
    (dateFrom || dateTo ? 1 : 0) +
    (customerType ? 1 : 0) +
    (assignedTo ? 1 : 0) +
    (status && status !== "All" ? 1 : 0) +
    (stateFilter ? 1 : 0);

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
                Add Single Lead
              </MenuItem>

              <MenuItem icon={<FiFile />} onClick={handleAddFromExcel}>
                Add From Excel
              </MenuItem>

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
                    {paginatedCustomers.map((customer, index) => {
                      const isConverted = convertedCustomerIds.includes(
                        customer.id,
                      );

                      const globalIndex = (currentPage - 1) * PAGE_SIZE + index;

                      const customerId = `#CUS-${1042 + globalIndex}`;

                      return (
                        <tr
                          key={customer.id}
                          onClick={() => openContactDetails(customer)}
                          className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-[#0b2034]/50"
                        >
                          <td
                            className="px-4 py-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Select ${customer.name}`}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                          </td>

                          <td className="px-4 py-3">
                            <span className="whitespace-nowrap text-[11px] font-medium text-slate-800 dark:text-slate-300">
                              {customerId}
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

                            {isConverted && (
                              <span className="mt-1 inline-flex rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                                In Lead Pipeline
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
                              <span className="text-[11px] text-slate-400">
                                Unassigned
                              </span>
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

                          <td
                            className="px-4 py-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                title="Contact Details"
                                aria-label="Contact Details"
                                onClick={() => openContactDetails(customer)}
                                className="rounded-lg p-2 text-[#131313] transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#0b2034]"
                              >
                                <FiPhone size={13} />
                              </button>

                              <div className="relative">
                                <button
                                  type="button"
                                  title="More Actions"
                                  aria-label="More Actions"
                                  onClick={() =>
                                    setOpenRowMenu(
                                      openRowMenu === customer.id
                                        ? null
                                        : customer.id,
                                    )
                                  }
                                  className="rounded-lg p-2 text-[#131313] transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#0b2034]"
                                >
                                  <FiMoreVertical size={14} />
                                </button>

                                {openRowMenu === customer.id && (
                                  <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-[#17304a] dark:bg-[#071929]">
                                    <MenuItem
                                      icon={<FiEdit2 />}
                                      onClick={() => openContactDetails(customer)}
                                    >
                                      Edit
                                    </MenuItem>

                                    <MenuItem
                                      icon={<FiActivity />}
                                      onClick={() => openContactDetails(customer)}
                                    >
                                      View Activities
                                    </MenuItem>

                                    <MenuItem
                                      icon={<FiSlash />}
                                      onClick={() => openContactDetails(customer)}
                                    >
                                      Deactivate
                                    </MenuItem>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={currentPage}
                pageSize={PAGE_SIZE}
                totalItems={filteredCustomers.length}
                totalPages={Math.max(
                  1,
                  Math.ceil(filteredCustomers.length / PAGE_SIZE),
                )}
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

      {/* ============================================================
          CONTACT DETAILS DRAWER
      ============================================================ */}

      <CustomerContactDrawer
        isOpen={drawerOpen}
        customer={drawerCustomer}
        onClose={() => setDrawerOpen(false)}
        onEdit={handleDrawerEdit}
        onMarkDead={handleDrawerMarkDead}
        onConvertToLead={(customer) => {
          const original = customers.find((item) => item.id === customer.id);

          if (original) {
            setDrawerOpen(false);
            openConvertLead(original);
          }
        }}
      />

      {/* ============================================================
          CONVERT LEAD MODAL
      ============================================================ */}

      {showConvertModal && selectedConvertCustomer && (
        <Modal
          isOpen={showConvertModal}
          onClose={() => setShowConvertModal(false)}
          title="Convert Customer Account to Lead"
        >
          <form onSubmit={handleConvertLeadConfirm} className="space-y-4">
            <Input
              label="Lead Title *"
              required
              value={convertTitle}
              onChange={(e) => setConvertTitle(e.target.value)}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Workflow Role Destination
              </label>

              <select
                className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
              >
                {dbRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Customer Context & Requirements
              </label>

              <textarea
                rows={7}
                value={convertDesc}
                onChange={(e) => setConvertDesc(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] p-3 text-xs text-slate-800 dark:text-white outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowConvertModal(false)}
              >
                Cancel
              </Button>

              <Button type="submit" loading={convertingLead}>
                Confirm Conversion
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================
          INVOICE BUILDER
      ============================================================ */}

      {showInvoiceModal && invoiceCustomer && (
        <Modal
          isOpen={showInvoiceModal}
          onClose={() => setShowInvoiceModal(false)}
          title={`Generate Bill: ${invoiceCustomer.name}`}
          size="lg"
        >
          <div className="space-y-5">
            <div className="flex justify-between items-center bg-slate-50 dark:bg-[#071929] p-3 rounded-xl">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Invoice Number:
              </span>

              <span className="text-xs font-mono font-bold text-[#233353] dark:text-sky-400">
                {invoiceNumber}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Bill Line Items
                </label>

                <button
                  type="button"
                  onClick={addInvoiceRow}
                  className="text-xs font-bold text-[#233353] dark:text-sky-400 hover:underline"
                >
                  + Add Line Item
                </button>
              </div>

              {invoiceItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Item description..."
                    value={item.description}
                    onChange={(e) =>
                      updateInvoiceItem(index, {
                        description: e.target.value,
                      })
                    }
                    className="flex-1 rounded-lg border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-3 py-2 text-xs outline-none"
                  />

                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.qty}
                    onChange={(e) =>
                      updateInvoiceItem(index, {
                        qty: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-20 rounded-lg border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-3 py-2 text-xs outline-none"
                  />

                  <input
                    type="number"
                    placeholder="Price"
                    value={item.price}
                    onChange={(e) =>
                      updateInvoiceItem(index, {
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-28 rounded-lg border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-3 py-2 text-xs outline-none"
                  />

                  {invoiceItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeInvoiceRow(index)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <FiX />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                type="button"
                onClick={() => setShowInvoiceModal(false)}
              >
                Cancel
              </Button>

              <Button type="button" onClick={generateInvoiceBill}>
                Generate Invoice
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ============================================================
          PRINTED INVOICE
      ============================================================ */}

      {showPrintModal && printedInvoice && (
        <Modal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          title="Invoice Document"
          size="lg"
        >
          <div className="space-y-6 p-5 bg-white dark:bg-[#051422]">
            <div className="flex justify-between border-b pb-4">
              <div>
                <h3 className="text-xl font-black text-[#233353] dark:text-white">
                  ENTERPRISE SAAS
                </h3>

                <p className="text-xs text-slate-400">
                  Synergy Platform Billing System
                </p>
              </div>

              <div className="text-right text-xs">
                <p className="font-mono font-bold">
                  INV: {printedInvoice.invoiceNo}
                </p>

                <p className="text-slate-400">{printedInvoice.date}</p>
              </div>
            </div>

            <div className="text-xs">
              <p className="font-bold text-slate-500 uppercase">Billed To:</p>

              <p className="font-bold text-sm mt-1">
                {printedInvoice.customer.name}
              </p>

              <p className="text-slate-500">
                {printedInvoice.customer.email} •{" "}
                {printedInvoice.customer.phone}
              </p>

              <p className="text-slate-500">
                {printedInvoice.customer.address}
              </p>
            </div>

            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-slate-500 uppercase">
                  <th className="text-left pb-2">Description</th>

                  <th className="text-center pb-2">Qty</th>

                  <th className="text-right pb-2">Price</th>

                  <th className="text-right pb-2">Total</th>
                </tr>
              </thead>

              <tbody>
                {printedInvoice.items.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="py-2">{item.description}</td>

                    <td className="py-2 text-center">{item.qty}</td>

                    <td className="py-2 text-right">
                      ₹{item.price.toLocaleString("en-IN")}
                    </td>

                    <td className="py-2 text-right font-bold">
                      ₹{(item.qty * item.price).toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-60 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal:</span>

                  <span>
                    ₹{printedInvoice.subTotal.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>GST:</span>

                  <span>
                    ₹{printedInvoice.gstTotal.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="flex justify-between font-black text-sm border-t pt-2">
                  <span>Grand Total:</span>

                  <span>
                    ₹{printedInvoice.grandTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t pt-4">
              <Button type="button" onClick={() => window.print()}>
                Print Invoice
              </Button>
            </div>
          </div>
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
