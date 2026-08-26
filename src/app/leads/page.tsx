"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import * as XLSX from "xlsx";

import { useUIStore } from "@/lib/store/ui.store";

import {
  createLeadApi,
  getLeadsApi,
  progressLeadApi,
  updateLeadApi,
  Lead,
} from "@/features/workflows/api/workflows.api";

import { getUsersApi, User } from "@/features/users/api/users.api";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

import {
  FiPlus,
  FiRefreshCw,
  FiMoreVertical,
  FiSearch,
  FiSliders,
  FiDownload,
  FiGrid,
  FiPhone,
  FiUserPlus,
  FiFileText,
  FiLink,
  FiCalendar,
  FiMapPin,
  FiMail,
  FiMessageSquare,
  FiEdit3,
  FiCheckCircle,
  FiXCircle,
  FiChevronLeft,
  FiChevronRight,
  FiUploadCloud,
  FiPaperclip,
  FiUser,
  FiBriefcase,
  FiShield,
  FiInfo,
  FiActivity,
  FiArrowUpRight,
  FiTrendingUp,
  FiTrendingDown,
  FiX,
  FiChevronDown,
  FiDatabase,
} from "react-icons/fi";

import { CgSpinner } from "react-icons/cg";

/* ============================================================================
   TYPES
============================================================================ */

interface LeadDetails {
  customerType: string;
  contactName: string;
  organizationName: string;
  website: string;

  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;

  gstNumber: string;
  panNumber: string;
  coiNumber: string;

  designation: string;
  mobileNumber: string;
  email: string;

  leadSource: string;
  remarks: string;
  attachments: string[];
}

interface LeadFormState extends LeadDetails {
  assignedToId: string;
}

interface LeadFilters {
  dateFrom: string;
  dateTo: string;
  customerType: string;
  assignedTo: string;
  status: string;
  state: string;
}

interface IntegrationLeadState {
  source: string;
  contactName: string;
  organizationName: string;
  email: string;
  mobileNumber: string;
  website: string;
  remarks: string;
  assignedToId: string;
}

/* ============================================================================
   CONSTANTS
============================================================================ */

const PAGE_SIZE = 10;

const EMPTY_FORM: LeadFormState = {
  customerType: "",
  contactName: "",
  organizationName: "",
  website: "",

  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "India",

  gstNumber: "",
  panNumber: "",
  coiNumber: "",

  designation: "",
  mobileNumber: "",
  email: "",

  leadSource: "",
  remarks: "",
  attachments: [],

  assignedToId: "",
};

const EMPTY_FILTERS: LeadFilters = {
  dateFrom: "",
  dateTo: "",
  customerType: "",
  assignedTo: "",
  status: "all",
  state: "",
};

const CUSTOMER_TYPES = [
  "Distributor",
  "OEM",
  "End Customer",
  "Institution",
  "Corporate",
];

const STATES = [
  "Andhra Pradesh",
  "Delhi",
  "Gujarat",
  "Haryana",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "West Bengal",
];

const LEAD_SOURCES = ["Marketing", "Cold Calling", "In-bound"];

const COUNTRIES = ["India", "United States", "China", "Malaysia", "Indonesia"];

/* ============================================================================
   HELPERS
============================================================================ */

function parseLeadDescription(description?: string): LeadDetails {
  const result: LeadDetails = {
    customerType: "",
    contactName: "",
    organizationName: "",
    website: "",

    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "India",

    gstNumber: "",
    panNumber: "",
    coiNumber: "",

    designation: "",
    mobileNumber: "",
    email: "",

    leadSource: "",
    remarks: "",
    attachments: [],
  };

  if (!description) {
    return result;
  }

  if (description.startsWith("CRM_META:")) {
    try {
      const parsed = JSON.parse(
        description.replace(/^CRM_META:/, ""),
      ) as Partial<LeadDetails>;

      return {
        ...result,
        ...parsed,
        attachments: Array.isArray(parsed.attachments)
          ? parsed.attachments
          : [],
      };
    } catch {
      // Continue to legacy parser.
    }
  }

  description.split("|").forEach((part) => {
    const value = part.trim();

    if (value.startsWith("Contact Name:")) {
      result.contactName = value.replace("Contact Name:", "").trim();
    }

    if (value.startsWith("Email:")) {
      result.email = value.replace("Email:", "").trim();
    }

    if (value.startsWith("Organization:")) {
      result.organizationName = value.replace("Organization:", "").trim();
    }

    if (value.startsWith("Type:")) {
      result.customerType = value.replace("Type:", "").trim();
    }

    if (value.startsWith("Address:")) {
      const address = value.replace("Address:", "").trim();
      const pieces = address.split(",").map((item) => item.trim());

      result.address = pieces[0] || "";
      result.city = pieces[1] || "";
      result.state = pieces[2] || "";

      const last = pieces.slice(3).join(" ");
      const pinMatch = last.match(/\b\d{5,6}\b/);

      if (pinMatch) {
        result.zipCode = pinMatch[0];
      }
    }

    if (value.startsWith("GST:")) {
      result.gstNumber = value.replace("GST:", "").trim();
    }

    if (value.startsWith("PAN:")) {
      result.panNumber = value.replace("PAN:", "").trim();
    }

    if (value.startsWith("COI:")) {
      result.coiNumber = value.replace("COI:", "").trim();
    }

    if (value.startsWith("Lead Source:")) {
      result.leadSource = value.replace("Lead Source:", "").trim();
    }
  });

  return result;
}

function serializeLeadDetails(details: LeadDetails) {
  return `CRM_META:${JSON.stringify(details)}`;
}

function getLeadDisplayName(lead: Lead) {
  const details = parseLeadDescription(lead.description);

  return (
    details.contactName ||
    lead.title?.split("(")[0]?.trim() ||
    lead.title ||
    "Unnamed Lead"
  );
}

function getLeadCompany(lead: Lead) {
  const details = parseLeadDescription(lead.description);

  return details.organizationName || lead.title?.match(/\((.*?)\)/)?.[1] || "—";
}

function getLeadState(lead: Lead) {
  return parseLeadDescription(lead.description).state || "—";
}

function getLeadCustomerType(lead: Lead) {
  return parseLeadDescription(lead.description).customerType || "—";
}

function formatDate(value?: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatLeadId(id: string) {
  return `#LD-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function getUserName(user: User) {
  return `${user.first_name || ""} ${user.last_name || ""}`.trim();
}

function getInitials(value?: string) {
  if (!value) return "U";

  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function isLeadDead(lead: Lead) {
  return lead.status === "dead" || lead.stage === "dead";
}

function isLeadQualified(lead: Lead) {
  return (
    lead.status === "qualified" ||
    lead.stage === "opportunity" ||
    lead.stage === "quotation"
  );
}

function isLeadNew(lead: Lead) {
  return lead.status === "new" || lead.stage === "lead";
}

function formatDateInput(value: string) {
  if (!value) return "";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-IN");
}

/* ============================================================================
   MAIN PAGE
============================================================================ */

export default function LeadsPage() {
  const { addToast } = useUIStore();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const [showTopMenu, setShowTopMenu] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  const [showFilter, setShowFilter] = useState(false);

  /*
   * Active filters are only changed after Apply Filter.
   */
  const [filters, setFilters] = useState<LeadFilters>(EMPTY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<LeadFilters>(EMPTY_FILTERS);

  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsLead, setDetailsLead] = useState<Lead | null>(null);

  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  /*
   * Create/Edit page mode.
   */
  const [pageMode, setPageMode] = useState<"list" | "create" | "edit">("list");

  const [form, setForm] = useState<LeadFormState>(EMPTY_FORM);

  const [rowMenuLeadId, setRowMenuLeadId] = useState<string | null>(null);

  /*
   * Pagination.
   */
  const [currentPage, setCurrentPage] = useState(1);

  /*
   * CSV / Excel import.
   */
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);
  const topMenuRef = useRef<HTMLDivElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);

  /*
   * Integration.
   */
  const [selectedIntegration, setSelectedIntegration] = useState<string>("");

  const [integrationLead, setIntegrationLead] = useState<IntegrationLeadState>({
    source: "",
    contactName: "",
    organizationName: "",
    email: "",
    mobileNumber: "",
    website: "",
    remarks: "",
    assignedToId: "",
  });

  /* --------------------------------------------------------------------------
     FETCH
  -------------------------------------------------------------------------- */

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);

      const data = await getLeadsApi();

      setLeads(data || []);
    } catch (error) {
      console.error(error);
      addToast("Failed to load leads.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await getUsersApi(1, 100);

      setUsers(response.data || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchUsers();
  }, [fetchLeads, fetchUsers]);

  /* --------------------------------------------------------------------------
     CLOSE MENUS WHEN CLICKING OUTSIDE
  -------------------------------------------------------------------------- */

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Node;

      if (filterRef.current && !filterRef.current.contains(target)) {
        setShowFilter(false);
      }

      if (topMenuRef.current && !topMenuRef.current.contains(target)) {
        setShowTopMenu(false);
      }

      if (addMenuRef.current && !addMenuRef.current.contains(target)) {
        setShowAddMenu(false);
      }

      setRowMenuLeadId(null);
    }

    document.addEventListener("mousedown", handleDocumentClick);

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, []);

  /* --------------------------------------------------------------------------
     KPI
  -------------------------------------------------------------------------- */

  const totalLeads = leads.length;

  const newLeads = leads.filter(isLeadNew).length;

  const qualifiedLeads = leads.filter(isLeadQualified).length;

  const deadLeads = leads.filter(isLeadDead).length;

  /* --------------------------------------------------------------------------
     FILTERING
  -------------------------------------------------------------------------- */

  const filteredLeads = useMemo(() => {
    const query = search.toLowerCase().trim();

    return leads.filter((lead) => {
      const details = parseLeadDescription(lead.description);

      const searchableText = [
        lead.title,
        getLeadDisplayName(lead),
        details.organizationName,
        details.email,
        details.mobileNumber,
        details.website,
        details.address,
        details.city,
        details.state,
        details.customerType,
        details.leadSource,
        lead.assigned_to_name,
        lead.creator_name,
        lead.status,
        lead.stage,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      const matchesCustomerType =
        !filters.customerType || details.customerType === filters.customerType;

      const matchesAssigned =
        !filters.assignedTo || lead.assigned_to_id === filters.assignedTo;

      const matchesState = !filters.state || details.state === filters.state;

      const matchesStatus =
        filters.status === "all" ||
        (filters.status === "active" && !isLeadDead(lead)) ||
        (filters.status === "inactive" && isLeadDead(lead));

      const created = new Date(lead.created_at);

      const matchesDateFrom =
        !filters.dateFrom ||
        created >= new Date(`${filters.dateFrom}T00:00:00`);

      const matchesDateTo =
        !filters.dateTo || created <= new Date(`${filters.dateTo}T23:59:59`);

      return (
        matchesSearch &&
        matchesCustomerType &&
        matchesAssigned &&
        matchesState &&
        matchesStatus &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [leads, search, filters]);

  /*
   * Always go back to page 1 when search/filter changes.
   */
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filters]);

  /* --------------------------------------------------------------------------
     PAGINATION
  -------------------------------------------------------------------------- */

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedLeads = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;

    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, safeCurrentPage]);

  const paginationPages = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages: number[] = [];

    if (safeCurrentPage <= 3) {
      pages.push(1, 2, 3, 4, 5);
    } else if (safeCurrentPage >= totalPages - 2) {
      pages.push(
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      );
    } else {
      pages.push(
        safeCurrentPage - 2,
        safeCurrentPage - 1,
        safeCurrentPage,
        safeCurrentPage + 1,
        safeCurrentPage + 2,
      );
    }

    return pages;
  }, [safeCurrentPage, totalPages]);

  /* --------------------------------------------------------------------------
     FORM
  -------------------------------------------------------------------------- */

  const updateForm = <K extends keyof LeadFormState>(
    field: K,
    value: LeadFormState[K],
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setForm({
      ...EMPTY_FORM,
      assignedToId: users[0]?.id || "",
    });
  };

  const openCreatePage = () => {
    resetForm();

    setPageMode("create");

    setShowAddMenu(false);
    setShowTopMenu(false);
  };

  const openEditPage = (lead: Lead) => {
    const details = parseLeadDescription(lead.description);

    setEditingLead(lead);

    setForm({
      ...details,
      assignedToId: lead.assigned_to_id || "",
    });

    setPageMode("edit");

    setShowDetailsModal(false);
    setRowMenuLeadId(null);
  };

  const closeLeadForm = () => {
    setPageMode("list");
    setEditingLead(null);
    resetForm();
  };

  /* --------------------------------------------------------------------------
     FORM VALIDATION
  -------------------------------------------------------------------------- */

  const validateLeadForm = () => {
    const requiredFields: Array<[keyof LeadFormState, string]> = [
      ["customerType", "Customer Type"],
      ["organizationName", "Organization Name"],
      ["website", "Organization Website"],
      ["address", "Address"],
      ["city", "City"],
      ["state", "State / Province"],
      ["zipCode", "PIN / ZIP Code"],
      ["country", "Country"],
      ["contactName", "Full Name"],
      ["designation", "Designation"],
      ["mobileNumber", "Mobile Number"],
      ["email", "Email Address"],
      ["leadSource", "Lead Source"],
      ["assignedToId", "Assigned To"],
    ];

    for (const [field, label] of requiredFields) {
      if (!String(form[field] || "").trim()) {
        addToast(`${label} is required.`, "warning");
        return false;
      }
    }

    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      addToast("Enter a valid email address.", "warning");
      return false;
    }

    const phone = form.mobileNumber.replace(/\D/g, "");

    if (phone.length < 10) {
      addToast("Enter a valid mobile number.", "warning");

      return false;
    }

    return true;
  };

  /* --------------------------------------------------------------------------
     CREATE
  -------------------------------------------------------------------------- */

  const handleCreateLead = async (event: FormEvent) => {
    event.preventDefault();

    if (!validateLeadForm()) return;

    try {
      setSaving(true);

      const details: LeadDetails = {
        customerType: form.customerType,
        contactName: form.contactName.trim(),
        organizationName: form.organizationName.trim(),
        website: form.website.trim(),

        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zipCode: form.zipCode.trim(),
        country: form.country,

        gstNumber: form.gstNumber.trim(),
        panNumber: form.panNumber.trim(),
        coiNumber: form.coiNumber.trim(),

        designation: form.designation.trim(),
        mobileNumber: form.mobileNumber.trim(),
        email: form.email.trim(),

        leadSource: form.leadSource,
        remarks: form.remarks.trim(),
        attachments: form.attachments,
      };

      await createLeadApi({
        title: `${details.contactName} (${details.organizationName})`,
        description: serializeLeadDetails(details),
        status: "new",
        assigned_to_id: form.assignedToId || undefined,
      });

      addToast("New lead created successfully.", "success");

      closeLeadForm();

      await fetchLeads();
    } catch (error) {
      console.error(error);

      addToast("Failed to create lead.", "error");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------------------------------
     UPDATE
  -------------------------------------------------------------------------- */

  const handleUpdateLead = async (event: FormEvent) => {
    event.preventDefault();

    if (!editingLead) return;

    if (!validateLeadForm()) return;

    try {
      setSaving(true);

      const details: LeadDetails = {
        customerType: form.customerType,
        contactName: form.contactName.trim(),
        organizationName: form.organizationName.trim(),
        website: form.website.trim(),

        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zipCode: form.zipCode.trim(),
        country: form.country,

        gstNumber: form.gstNumber.trim(),
        panNumber: form.panNumber.trim(),
        coiNumber: form.coiNumber.trim(),

        designation: form.designation.trim(),
        mobileNumber: form.mobileNumber.trim(),
        email: form.email.trim(),

        leadSource: form.leadSource,
        remarks: form.remarks.trim(),
        attachments: form.attachments,
      };

      const updated = await updateLeadApi(editingLead.id, {
        title: `${details.contactName} (${details.organizationName})`,
        description: serializeLeadDetails(details),
        assigned_to_id: form.assignedToId || undefined,
      });

      const refreshedLead = {
        ...editingLead,
        ...updated,
      };

      setLeads((previous) =>
        previous.map((lead) =>
          lead.id === editingLead.id ? refreshedLead : lead,
        ),
      );

      addToast("Lead updated successfully.", "success");

      closeLeadForm();

      setDetailsLead(refreshedLead);
      setShowDetailsModal(true);
    } catch (error) {
      console.error(error);

      addToast("Failed to update lead.", "error");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------------------------------
     LEAD ACTIONS
  -------------------------------------------------------------------------- */

  const markLeadDead = async (lead: Lead) => {
    try {
      await progressLeadApi(lead.id, {
        stage: "dead",
        status: "dead",
      });

      addToast("Lead marked as dead.", "success");

      setRowMenuLeadId(null);
      setShowDetailsModal(false);

      await fetchLeads();
    } catch (error) {
      console.error(error);

      addToast("Failed to mark lead as dead.", "error");
    }
  };

  const convertToOpportunity = async (lead: Lead) => {
    try {
      await progressLeadApi(lead.id, {
        stage: "opportunity",
        status: "qualified",
      });

      addToast("Lead converted to opportunity.", "success");

      setRowMenuLeadId(null);
      setShowDetailsModal(false);

      await fetchLeads();
    } catch (error) {
      console.error(error);

      addToast("Failed to convert lead.", "error");
    }
  };

  const openLeadDetails = (lead: Lead) => {
    setDetailsLead(lead);
    setShowDetailsModal(true);
    setRowMenuLeadId(null);
  };

  /* --------------------------------------------------------------------------
     FILTERS
  -------------------------------------------------------------------------- */

  const openFilters = () => {
    setDraftFilters(filters);
    setShowFilter(true);
  };

  const applyFilters = () => {
    let next = {
      ...draftFilters,
    };

    if (next.dateFrom && next.dateTo && next.dateFrom > next.dateTo) {
      const from = next.dateFrom;

      next.dateFrom = next.dateTo;
      next.dateTo = from;
    }

    setFilters(next);
    setCurrentPage(1);
    setShowFilter(false);
  };

  const clearFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setCurrentPage(1);
    setShowFilter(false);
  };

  const hasActiveFilters =
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    Boolean(filters.customerType) ||
    Boolean(filters.assignedTo) ||
    filters.status !== "all" ||
    Boolean(filters.state);

  const availableStates = Array.from(
    new Set([
      ...STATES,
      ...leads
        .map((lead) => parseLeadDescription(lead.description).state)
        .filter(Boolean),
    ]),
  );

  /* --------------------------------------------------------------------------
     EXPORT
  -------------------------------------------------------------------------- */

  const exportCSV = () => {
    if (!filteredLeads.length) {
      addToast("No leads available for export.", "warning");

      return;
    }

    const header = [
      "Lead ID",
      "Customer Name",
      "Organization",
      "Customer Type",
      "Website",
      "Email",
      "Mobile",
      "Address",
      "City",
      "State",
      "PIN / ZIP",
      "Country",
      "GST",
      "PAN",
      "COI",
      "Designation",
      "Lead Source",
      "Assigned To",
      "Status",
      "Stage",
      "Created At",
    ];

    const rows = filteredLeads.map((lead) => {
      const details = parseLeadDescription(lead.description);

      return [
        formatLeadId(lead.id),
        details.contactName,
        details.organizationName,
        details.customerType,
        details.website,
        details.email,
        details.mobileNumber,
        details.address,
        details.city,
        details.state,
        details.zipCode,
        details.country,
        details.gstNumber,
        details.panNumber,
        details.coiNumber,
        details.designation,
        details.leadSource,
        lead.assigned_to_name || "",
        lead.status,
        lead.stage,
        formatDate(lead.created_at),
      ];
    });

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setShowTopMenu(false);

    addToast("Leads exported successfully.", "success");
  };

  /* --------------------------------------------------------------------------
     KPI CHART
  -------------------------------------------------------------------------- */

  const downloadChart = () => {
    const canvas = document.createElement("canvas");

    canvas.width = 1200;
    canvas.height = 600;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 32px Arial";

    ctx.fillText("Leads Pipeline", 60, 70);

    const values = [
      {
        label: "Total Leads",
        value: totalLeads,
      },
      {
        label: "New",
        value: newLeads,
      },
      {
        label: "Qualified",
        value: qualifiedLeads,
      },
      {
        label: "Dead",
        value: deadLeads,
      },
    ];

    const max = Math.max(...values.map((item) => item.value), 1);

    const chartBottom = 500;
    const chartTop = 130;
    const barWidth = 150;
    const gap = 100;

    values.forEach((item, index) => {
      const x = 100 + index * (barWidth + gap);

      const height = (item.value / max) * (chartBottom - chartTop);

      ctx.fillStyle = "#1d2b45";

      ctx.fillRect(x, chartBottom - height, barWidth, height);

      ctx.fillStyle = "#0f172a";

      ctx.font = "bold 20px Arial";

      ctx.fillText(
        item.value.toLocaleString("en-IN"),
        x + 35,
        chartBottom - height - 15,
      );

      ctx.font = "16px Arial";

      ctx.fillText(item.label, x + 20, chartBottom + 35);
    });

    const link = document.createElement("a");

    link.download = "leads-pipeline-chart.png";

    link.href = canvas.toDataURL("image/png");

    link.click();

    setShowTopMenu(false);

    addToast("Chart downloaded.", "success");
  };

  /* --------------------------------------------------------------------------
     FILE IMPORT
  -------------------------------------------------------------------------- */

  const acceptImportFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    const allowed = ["csv", "xlsx", "xls"];

    if (!extension || !allowed.includes(extension)) {
      addToast("Please upload a CSV, XLSX or XLS file.", "warning");

      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      addToast("Maximum file size is 10MB.", "warning");

      return;
    }

    setExcelFile(file);
  };

  const handleExcelFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    acceptImportFile(file);
  };

  const handleFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    setIsDraggingFile(false);

    const file = event.dataTransfer.files?.[0];

    if (file) {
      acceptImportFile(file);
    }
  };

  const downloadSampleCSV = () => {
    const sample = [
      [
        "Full Name",
        "Designation",
        "Email",
        "Mobile",
        "Organization Name",
        "Organization Website",
        "Customer Type",
        "Address",
        "City",
        "State",
        "PIN / ZIP Code",
        "Country",
        "GST Number",
        "PAN Number",
        "COI",
        "Lead Source",
        "Assigned To",
        "Remarks",
      ],
      [
        "Rahul Sharma",
        "Procurement Manager",
        "rahul@example.com",
        "9876543210",
        "Example Technologies",
        "www.example.com",
        "Corporate",
        "MG Road",
        "Bengaluru",
        "Karnataka",
        "560001",
        "India",
        "29ABCDE1234F1Z5",
        "ABCDE1234F",
        "COI-001",
        "Website",
        "",
        "Sample imported lead",
      ],
    ];

    const csv = sample
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "sample-leads-import.csv";

    link.click();

    URL.revokeObjectURL(url);
  };

  const importExcel = async () => {
    if (!excelFile) {
      addToast("Select a file first.", "warning");

      return;
    }

    try {
      setSaving(true);

      const buffer = await excelFile.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
      });

      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new Error("Workbook contains no sheets.");
      }

      const sheet = workbook.Sheets[sheetName];

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      });

      if (!rows.length) {
        throw new Error("File contains no records.");
      }

      let imported = 0;

      for (const rawRow of rows) {
        const row: Record<string, string> = {};

        Object.entries(rawRow).forEach(([key, value]) => {
          row[key.toLowerCase().trim()] = String(value ?? "").trim();
        });

        const get = (...keys: string[]) => {
          for (const key of keys) {
            if (row[key]) {
              return row[key];
            }
          }

          return "";
        };

        const contactName = get(
          "full name",
          "customer name",
          "name",
          "contact name",
        );

        const organizationName = get(
          "organization name",
          "company",
          "organization",
        );

        if (!contactName) {
          continue;
        }

        const importedDetails: LeadDetails = {
          customerType: get("customer type"),

          contactName,

          organizationName,

          website: get("website", "organization website"),

          address: get("address"),

          city: get("city"),

          state: get("state"),

          zipCode: get("pin / zip code", "pin", "zip", "zip code"),

          country: get("country") || "India",

          gstNumber: get("gst number", "gst"),

          panNumber: get("pan number", "pan"),

          coiNumber: get("coi", "coi number"),

          designation: get("designation"),

          mobileNumber: get("mobile", "mobile number", "phone", "phone number"),

          email: get("email"),

          leadSource: get("lead source"),

          remarks: get("remarks"),

          attachments: [],
        };

        const assignedName = get("assigned to");

        const matchingUser = users.find(
          (user) =>
            getUserName(user).toLowerCase().trim() ===
            assignedName.toLowerCase().trim(),
        );

        await createLeadApi({
          title: `${contactName}${
            organizationName ? ` (${organizationName})` : ""
          }`,

          description: serializeLeadDetails(importedDetails),

          status: "new",

          assigned_to_id: matchingUser?.id || undefined,
        });

        imported++;
      }

      addToast(`${imported} lead(s) imported successfully.`, "success");

      setExcelFile(null);
      setShowExcelModal(false);

      if (excelInputRef.current) {
        excelInputRef.current.value = "";
      }

      await fetchLeads();
    } catch (error) {
      console.error(error);

      addToast("Failed to import the file.", "error");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------------------------------
     ATTACHMENTS
  -------------------------------------------------------------------------- */

  const addAttachment = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    const validFiles = files.filter((file) => file.size <= 10 * 1024 * 1024);

    if (validFiles.length !== files.length) {
      addToast("Files above 10MB were ignored.", "warning");
    }

    setForm((previous) => ({
      ...previous,

      attachments: [
        ...previous.attachments,
        ...validFiles.map((file) => file.name),
      ],
    }));

    event.target.value = "";
  };

  /* --------------------------------------------------------------------------
     INTEGRATION
  -------------------------------------------------------------------------- */

  const openIntegration = (source: string) => {
    setSelectedIntegration(source);

    setIntegrationLead({
      source,
      contactName: "",
      organizationName: "",
      email: "",
      mobileNumber: "",
      website: "",
      remarks: "",
      assignedToId: users[0]?.id || "",
    });
  };

  const updateIntegrationLead = <K extends keyof IntegrationLeadState>(
    field: K,
    value: IntegrationLeadState[K],
  ) => {
    setIntegrationLead((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const importIntegrationLead = async () => {
    if (!integrationLead.contactName.trim()) {
      addToast("Full Name is required.", "warning");

      return;
    }

    if (!integrationLead.organizationName.trim()) {
      addToast("Organization Name is required.", "warning");

      return;
    }

    try {
      setSaving(true);

      const details: LeadDetails = {
        ...EMPTY_FORM,

        customerType: "End Customer",

        contactName: integrationLead.contactName.trim(),

        organizationName: integrationLead.organizationName.trim(),

        website: integrationLead.website.trim(),

        email: integrationLead.email.trim(),

        mobileNumber: integrationLead.mobileNumber.trim(),

        leadSource: integrationLead.source,

        remarks: integrationLead.remarks.trim(),

        attachments: [],
      };

      await createLeadApi({
        title: `${details.contactName} (${details.organizationName})`,
        description: serializeLeadDetails(details),
        status: "new",
        assigned_to_id: integrationLead.assignedToId || undefined,
      });

      addToast("Integration lead added successfully.", "success");

      setShowIntegrationModal(false);
      setSelectedIntegration("");

      await fetchLeads();
    } catch (error) {
      console.error(error);

      addToast("Failed to add integration lead.", "error");
    } finally {
      setSaving(false);
    }
  };

  /* ==========================================================================
     CREATE / EDIT PAGE
  ========================================================================== */

  if (pageMode === "create" || pageMode === "edit") {
    return (
      <LeadFormPage
        title={pageMode === "create" ? "New Lead" : "Edit Lead"}
        form={form}
        users={users}
        saving={saving}
        onChange={updateForm}
        onSubmit={pageMode === "create" ? handleCreateLead : handleUpdateLead}
        onAttachment={addAttachment}
        onClose={closeLeadForm}
      />
    );
  }

  /* ==========================================================================
     LIST PAGE
  ========================================================================== */

  return (
    <div
      className="
        min-h-full
        space-y-5
        pb-8
        select-none
      "
    >
      {/* HEADER */}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1
            className="
              text-2xl
              font-extrabold
              tracking-tight
              text-slate-900
              dark:text-white
            "
          >
            Leads
          </h1>

          <button
            type="button"
            title="Refresh Leads"
            onClick={fetchLeads}
            className="
              rounded-xl
              border
              border-slate-200
              bg-slate-100/70
              p-2
              text-slate-500
              transition
              hover:bg-slate-200
              dark:border-[#0d2336]
              dark:bg-[#071929]
              dark:text-slate-300
            "
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div ref={topMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setShowTopMenu((previous) => !previous)}
            className="
              rounded-xl
              border
              border-slate-200
              bg-white
              p-2
              text-slate-600
              shadow-sm
              hover:bg-slate-50
              dark:border-[#0d2336]
              dark:bg-[#051422]
              dark:text-slate-300
            "
          >
            <FiMoreVertical />
          </button>

          {showTopMenu && (
            <DropdownMenu>
              <DropdownButton icon={<FiDownload />} onClick={exportCSV}>
                Export Data
              </DropdownButton>

              <DropdownButton icon={<FiGrid />} onClick={downloadChart}>
                Download Chart
              </DropdownButton>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* KPI */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Leads"
          value={totalLeads}
          percentage="+12%"
          positive
          icon={<FiTrendingUp />}
        />

        <KpiCard
          label="New"
          value={newLeads}
          percentage="+8"
          positive
          icon={<FiTrendingUp />}
        />

        <KpiCard
          label="Qualified"
          value={qualifiedLeads}
          percentage="-5%"
          positive={false}
          icon={<FiTrendingDown />}
        />

        <KpiCard
          label="Dead"
          value={deadLeads}
          percentage="-5%"
          positive={false}
          icon={<FiTrendingDown />}
        />
      </div>

      {/* SEARCH + FILTER + ADD */}

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <FiSearch
            className="
              absolute
              left-4
              top-1/2
              -translate-y-1/2
              text-slate-400
            "
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Field Text"
            className="
              h-12
              w-full
              rounded-xl
              border
              border-slate-200
              bg-white
              pl-11
              pr-4
              text-sm
              text-slate-800
              outline-none
              transition
              focus:border-primary
              focus:ring-2
              focus:ring-primary/10
              dark:border-[#0d2336]
              dark:bg-[#051422]
              dark:text-white
            "
          />
        </div>

        {/* FILTER POPOVER */}

        <div
          ref={filterRef}
          className="relative"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={openFilters}
            className="
              flex
              h-12
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-slate-200
              bg-white
              px-4
              text-xs
              font-bold
              text-slate-700
              shadow-sm
              hover:bg-slate-50
              dark:border-[#0d2336]
              dark:bg-[#051422]
              dark:text-slate-200
            "
          >
            <FiSliders />
            Filter
            {hasActiveFilters && (
              <span
                className="
                  flex
                  h-5
                  min-w-5
                  items-center
                  justify-center
                  rounded-full
                  bg-[#1d2b45]
                  px-1.5
                  text-[9px]
                  text-white
                "
              >
                {
                  [
                    filters.dateFrom || filters.dateTo,
                    filters.customerType,
                    filters.assignedTo,
                    filters.status !== "all" ? filters.status : "",
                    filters.state,
                  ].filter(Boolean).length
                }
              </span>
            )}
          </button>

          {showFilter && (
            <FilterPopover
              filters={draftFilters}
              users={users}
              states={availableStates}
              onChange={(field, value) =>
                setDraftFilters((previous) => ({
                  ...previous,
                  [field]: value,
                }))
              }
              onApply={applyFilters}
              onClear={clearFilters}
            />
          )}
        </div>

        {/* ADD */}

        <div
          ref={addMenuRef}
          className="relative"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setShowAddMenu((previous) => !previous)}
            className="
              flex
              h-12
              w-full
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-[#1d2b45]
              px-5
              text-xs
              font-bold
              text-white
              shadow-sm
              hover:bg-[#162238]
              lg:w-auto
            "
          >
            <FiPlus />
            Add New Lead
          </button>

          {showAddMenu && (
            <DropdownMenu className="w-64">
              <DropdownButton
                icon={<FiUserPlus className="text-primary" />}
                onClick={openCreatePage}
              >
                Add Single Lead
              </DropdownButton>

              <DropdownButton
                icon={<FiFileText className="text-emerald-500" />}
                onClick={() => {
                  setShowAddMenu(false);
                  setShowExcelModal(true);
                }}
              >
                Add From Excel
              </DropdownButton>

              <DropdownButton
                icon={<FiLink className="text-indigo-500" />}
                onClick={() => {
                  setShowAddMenu(false);
                  setSelectedIntegration("");
                  setShowIntegrationModal(true);
                }}
              >
                Add From Integration
              </DropdownButton>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ACTIVE FILTER SUMMARY */}

      {hasActiveFilters && (
        <div
          className="
            flex
            flex-wrap
            items-center
            gap-2
            rounded-xl
            border
            border-slate-200
            bg-white
            px-4
            py-3
            dark:border-[#0d2336]
            dark:bg-[#051422]
          "
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Active Filters
          </span>

          {filters.dateFrom || filters.dateTo ? (
            <FilterChip
              label={`Date: ${formatDateInput(filters.dateFrom) || "Any"} - ${
                formatDateInput(filters.dateTo) || "Any"
              }`}
            />
          ) : null}

          {filters.customerType && <FilterChip label={filters.customerType} />}

          {filters.assignedTo && (
            <FilterChip
              label={
                users.find((user) => user.id === filters.assignedTo)
                  ? getUserName(
                      users.find((user) => user.id === filters.assignedTo)!,
                    )
                  : "Assigned"
              }
            />
          )}

          {filters.status !== "all" && (
            <FilterChip
              label={filters.status === "inactive" ? "Inactive" : "Active"}
            />
          )}

          {filters.state && <FilterChip label={filters.state} />}

          <button
            type="button"
            onClick={clearFilters}
            className="
              ml-auto
              flex
              items-center
              gap-1
              text-[10px]
              font-bold
              text-rose-500
            "
          >
            <FiX />
            Clear
          </button>
        </div>
      )}

      {/* TABLE */}

      <div
        className="
          overflow-hidden
          rounded-2xl
          border
          border-slate-200/80
          bg-white
          shadow-sm
          dark:border-[#0d2336]
          dark:bg-[#051422]
        "
      >
        {loading ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-slate-400">
            <CgSpinner className="animate-spin text-4xl text-primary" />

            <span className="text-xs font-semibold">Loading leads...</span>
          </div>
        ) : filteredLeads.length === 0 ? (
          <EmptyLeads />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px] border-collapse text-left">
                <thead>
                  <tr
                    className="
                      border-b
                      border-slate-200
                      bg-slate-50/70
                      text-[10px]
                      font-bold
                      uppercase
                      tracking-wider
                      text-slate-400
                      dark:border-[#0d2336]
                      dark:bg-[#071929]/60
                    "
                  >
                    <th className="w-12 px-4 py-4">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </th>

                    <th className="px-4 py-4">
                      <TableHeader label="Lead ID" />
                    </th>

                    <th className="px-4 py-4">
                      <TableHeader label="Customer Name" />
                    </th>

                    <th className="px-4 py-4">
                      <TableHeader label="Company" />
                    </th>

                    <th className="px-4 py-4">
                      <TableHeader label="Assigned To" />
                    </th>

                    <th className="px-4 py-4">
                      <TableHeader label="Status" />
                    </th>

                    <th className="px-4 py-4">
                      <TableHeader label="Created" />
                    </th>

                    <th className="px-4 py-4 text-center">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-[#0d2336]/70">
                  {paginatedLeads.map((lead) => {
                    const details = parseLeadDescription(lead.description);

                    return (
                      <tr
                        key={lead.id}
                        className="
                            transition
                            hover:bg-slate-50
                            dark:hover:bg-[#071929]/50
                          "
                      >
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </td>

                        <td className="px-4 py-4">
                          <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            {formatLeadId(lead.id)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => openLeadDetails(lead)}
                            className="text-left"
                          >
                            <p className="text-xs font-bold text-slate-900 hover:text-primary dark:text-white">
                              {getLeadDisplayName(lead)}
                            </p>

                            <p className="mt-1 text-[10px] text-slate-400">
                              {details.email || "No email"}
                            </p>

                            {details.state && (
                              <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                                <FiMapPin />
                                {details.state}
                              </p>
                            )}
                          </button>
                        </td>

                        <td className="px-4 py-4">
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {getLeadCompany(lead)}
                          </p>

                          <p className="mt-1 text-[10px] text-slate-400">
                            {getLeadCustomerType(lead)}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 dark:border-[#0d2336] dark:bg-[#071929]">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#233353] text-[9px] font-bold text-white">
                              {getInitials(
                                lead.assigned_to_name || lead.creator_name,
                              )}
                            </span>

                            <span className="max-w-[130px] truncate text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                              {lead.assigned_to_name ||
                                lead.creator_name ||
                                "Unassigned"}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <StatusBadge
                            status={lead.status}
                            stage={lead.stage}
                          />
                        </td>

                        <td className="px-4 py-4">
                          <span className="text-[10px] font-medium text-slate-400">
                            {formatDate(lead.created_at)}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <div
                            className="flex items-center justify-center gap-1"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              title="Lead Details"
                              onClick={() => openLeadDetails(lead)}
                              className="
                                  rounded-lg
                                  p-2
                                  text-slate-400
                                  hover:bg-slate-100
                                  hover:text-slate-700
                                  dark:hover:bg-[#071929]
                                  dark:hover:text-white
                                "
                            >
                              <FiPhone />
                            </button>

                            <div className="relative">
                              <button
                                type="button"
                                title="More Actions"
                                onClick={() =>
                                  setRowMenuLeadId((previous) =>
                                    previous === lead.id ? null : lead.id,
                                  )
                                }
                                className="
                                    rounded-lg
                                    p-2
                                    text-slate-400
                                    hover:bg-slate-100
                                    hover:text-slate-700
                                    dark:hover:bg-[#071929]
                                    dark:hover:text-white
                                  "
                              >
                                <FiMoreVertical />
                              </button>

                              {rowMenuLeadId === lead.id && (
                                <div
                                  className="
                                      absolute
                                      right-0
                                      top-full
                                      z-40
                                      mt-1
                                      w-52
                                      rounded-xl
                                      border
                                      border-slate-200
                                      bg-white
                                      p-1
                                      shadow-xl
                                      dark:border-[#0d2336]
                                      dark:bg-[#051422]
                                    "
                                >
                                  <RowAction
                                    icon={<FiEdit3 />}
                                    onClick={() => openEditPage(lead)}
                                  >
                                    Edit
                                  </RowAction>

                                  <RowAction
                                    icon={<FiXCircle />}
                                    danger
                                    onClick={() => markLeadDead(lead)}
                                  >
                                    Mark as Dead
                                  </RowAction>

                                  <RowAction
                                    icon={<FiArrowUpRight />}
                                    success
                                    onClick={() => convertToOpportunity(lead)}
                                  >
                                    Convert to Opportunity
                                  </RowAction>
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

            {/* PAGINATION */}

            <div
              className="
                flex
                flex-col
                gap-4
                border-t
                border-slate-200
                bg-slate-50/40
                px-5
                py-4
                sm:flex-row
                sm:items-center
                sm:justify-between
                dark:border-[#0d2336]
                dark:bg-[#051422]
              "
            >
              <p className="text-xs text-slate-500">
                Showing{" "}
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {filteredLeads.length === 0
                    ? 0
                    : (safeCurrentPage - 1) * PAGE_SIZE + 1}
                </span>
                -
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {Math.min(safeCurrentPage * PAGE_SIZE, filteredLeads.length)}
                </span>{" "}
                of{" "}
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {filteredLeads.length}
                </span>{" "}
                leads
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safeCurrentPage === 1}
                  onClick={() =>
                    setCurrentPage((page) => Math.max(1, page - 1))
                  }
                  className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-lg
                    text-slate-500
                    transition
                    hover:bg-white
                    disabled:cursor-not-allowed
                    disabled:opacity-30
                    dark:hover:bg-[#071929]
                  "
                >
                  <FiChevronLeft />
                </button>

                {paginationPages.map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`
                        flex
                        h-8
                        min-w-8
                        items-center
                        justify-center
                        rounded-lg
                        px-2
                        text-xs
                        font-bold
                        transition
                        ${
                          safeCurrentPage === page
                            ? "bg-[#1d2b45] text-white"
                            : "text-slate-500 hover:bg-white dark:hover:bg-[#071929]"
                        }
                      `}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={safeCurrentPage === totalPages}
                  onClick={() =>
                    setCurrentPage((page) => Math.min(totalPages, page + 1))
                  }
                  className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-lg
                    text-slate-500
                    transition
                    hover:bg-white
                    disabled:cursor-not-allowed
                    disabled:opacity-30
                    dark:hover:bg-[#071929]
                  "
                >
                  <FiChevronRight />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ======================================================================
          EXCEL IMPORT
      ====================================================================== */}

      {showExcelModal && (
        <ExcelImportModal
          file={excelFile}
          saving={saving}
          dragging={isDraggingFile}
          inputRef={excelInputRef}
          onClose={() => {
            if (!saving) {
              setShowExcelModal(false);
              setExcelFile(null);
            }
          }}
          onFile={handleExcelFile}
          onDrop={handleFileDrop}
          onDragEnter={() => setIsDraggingFile(true)}
          onDragLeave={() => setIsDraggingFile(false)}
          onDownloadSample={downloadSampleCSV}
          onImport={importExcel}
        />
      )}

      {/* ======================================================================
          INTEGRATION
      ====================================================================== */}

      {showIntegrationModal && (
        <IntegrationModal
          selectedSource={selectedIntegration}
          integrationLead={integrationLead}
          users={users}
          saving={saving}
          onClose={() => {
            if (!saving) {
              setShowIntegrationModal(false);

              setSelectedIntegration("");
            }
          }}
          onSelectSource={openIntegration}
          onChange={updateIntegrationLead}
          onSubmit={importIntegrationLead}
        />
      )}

      {/* ======================================================================
          DETAILS
      ====================================================================== */}

      {detailsLead && (
        <LeadDetailsModal
          lead={detailsLead}
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          onEdit={() => openEditPage(detailsLead)}
          onMarkDead={() => markLeadDead(detailsLead)}
          onConvert={() => convertToOpportunity(detailsLead)}
        />
      )}
    </div>
  );
}

/* ============================================================================
   FILTER POPOVER
============================================================================ */

function FilterPopover({
  filters,
  users,
  states,
  onChange,
  onApply,
  onClear,
}: {
  filters: LeadFilters;
  users: User[];
  states: string[];
  onChange: <K extends keyof LeadFilters>(
    field: K,
    value: LeadFilters[K],
  ) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className="
        absolute
        right-0
        top-full
        z-50
        mt-3
        w-[520px]
        max-w-[calc(100vw-32px)]
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-5
        shadow-2xl
        dark:border-[#0d2336]
        dark:bg-[#051422]
      "
      onClick={(event) => event.stopPropagation()}
    >
      {/* DATE RANGE */}

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-500">
            Date Range
          </label>

          <button
            type="button"
            onClick={() => {
              onChange("dateFrom", "");

              onChange("dateTo", "");
            }}
            className="
              flex
              items-center
              gap-1
              text-[10px]
              font-bold
              text-rose-400
              hover:text-rose-500
            "
          >
            <FiX />
            Clear Filter
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <DateFilterInput
            value={filters.dateFrom}
            onChange={(value) => onChange("dateFrom", value)}
          />

          <DateFilterInput
            value={filters.dateTo}
            onChange={(value) => onChange("dateTo", value)}
          />
        </div>
      </div>

      {/* FILTER GRID */}

      <div className="grid grid-cols-2 gap-4">
        <FilterField label="Customer Type">
          <SelectInput
            value={filters.customerType}
            onChange={(value) => onChange("customerType", value)}
            placeholder="All Customer Types"
            options={CUSTOMER_TYPES}
          />
        </FilterField>

        <FilterField label="Assigned To">
          <SelectInput
            value={filters.assignedTo}
            onChange={(value) => onChange("assignedTo", value)}
            placeholder="All Users"
            options={users.map((user) => ({
              value: user.id,
              label: getUserName(user),
            }))}
          />
        </FilterField>

        <FilterField label="Status">
          <SelectInput
            value={filters.status}
            onChange={(value) => onChange("status", value)}
            placeholder="All"
            options={[
              {
                value: "all",
                label: "All",
              },
              {
                value: "active",
                label: "Active",
              },
              {
                value: "inactive",
                label: "Inactive",
              },
            ]}
          />
        </FilterField>

        <FilterField label="State">
          <SelectInput
            value={filters.state}
            onChange={(value) => onChange("state", value)}
            placeholder="All"
            options={states}
          />
        </FilterField>
      </div>

      {/* ACTIONS */}

      <div className="mt-5 flex items-center justify-end gap-4 border-t border-slate-100 pt-4 dark:border-[#0d2336]">
        <button
          type="button"
          onClick={onClear}
          className="
            text-xs
            font-bold
            text-slate-500
            hover:text-slate-900
            dark:hover:text-white
          "
        >
          Clear All Filter
        </button>

        <Button onClick={onApply}>Apply Filter</Button>
      </div>
    </div>
  );
}

/* ============================================================================
   NEW LEAD PAGE
============================================================================ */

function LeadFormPage({
  title,
  form,
  users,
  saving,
  onChange,
  onSubmit,
  onAttachment,
  onClose,
}: {
  title: string;
  form: LeadFormState;
  users: User[];
  saving: boolean;
  onChange: <K extends keyof LeadFormState>(
    field: K,
    value: LeadFormState[K],
  ) => void;
  onSubmit: (event: FormEvent) => void;
  onAttachment: (event: ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
}) {
  return (
    <div className="min-h-full pb-8">
      {/* PAGE HEADER */}

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>

          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
            <button
              type="button"
              onClick={onClose}
              className="hover:text-primary"
            >
              Leads
            </button>

            <span>›</span>

            <span>{title === "Edit Lead" ? "Edit" : "New"}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="
            rounded-xl
            border
            border-slate-200
            bg-white
            p-2
            text-slate-500
            hover:bg-slate-50
            dark:border-[#0d2336]
            dark:bg-[#051422]
            dark:text-slate-300
          "
        >
          <FiX />
        </button>
      </div>

      <form
        onSubmit={onSubmit}
        className="
    grid
    grid-cols-1
    gap-4
    xl:grid-cols-[minmax(0,1fr)_360px]
  "
      >
        {/* LEFT */}

        <div className="space-y-4">
          <FormSection icon={<FiInfo />} title="Customer Information">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <FormSelect
                  label="Customer Type"
                  required
                  value={form.customerType}
                  onChange={(value) => onChange("customerType", value)}
                  options={CUSTOMER_TYPES}
                />
              </div>

              <FormInput
                label="Organization Name"
                required
                value={form.organizationName}
                onChange={(value) => onChange("organizationName", value)}
              />

              <FormInput
                label="Organization Website"
                required
                value={form.website}
                placeholder="www.company.com"
                onChange={(value) => onChange("website", value)}
              />
            </div>
          </FormSection>
          
          <FormSection icon={<FiMapPin />} title="Organization Details">
            <div className="space-y-4">
              {/* First row: Address + City */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormInput
                  label="Address"
                  required
                  value={form.address}
                  placeholder="Street Address, Building, Suite"
                  onChange={(value) => onChange("address", value)}
                />

                <FormInput
                  label="City"
                  required
                  value={form.city}
                  placeholder="Enter city"
                  onChange={(value) => onChange("city", value)}
                />
              </div>

              {/* Second row: State + PIN + Country */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FormSelect
                  label="State / Province"
                  required
                  value={form.state}
                  onChange={(value) => onChange("state", value)}
                  options={STATES}
                  allowCustom
                />

                <FormInput
                  label="PIN / ZIP Code"
                  required
                  value={form.zipCode}
                  placeholder="Enter PIN / ZIP code"
                  onChange={(value) => onChange("zipCode", value)}
                />

                <FormSelect
                  label="Country"
                  required
                  value={form.country}
                  onChange={(value) => onChange("country", value)}
                  options={COUNTRIES}
                />
              </div>
            </div>
          </FormSection>

          <FormSection icon={<FiShield />} title="Registration & Compliance">
            <div className="space-y-4">
              <DocumentField
                label="GST Number"
                value={form.gstNumber}
                onChange={(value) => onChange("gstNumber", value)}
                onFile={onAttachment}
              />

              <DocumentField
                label="PAN Number"
                value={form.panNumber}
                onChange={(value) => onChange("panNumber", value)}
                onFile={onAttachment}
              />

              <DocumentField
                label="COI (Certificate of Incorporation)"
                value={form.coiNumber}
                onChange={(value) => onChange("coiNumber", value)}
                onFile={onAttachment}
              />
            </div>
          </FormSection>

          <FormSection icon={<FiUser />} title="Primary Contact">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label="Full Name"
                required
                value={form.contactName}
                onChange={(value) => onChange("contactName", value)}
              />

              <FormInput
                label="Designation"
                required
                value={form.designation}
                placeholder="e.g. Procurement Manager"
                onChange={(value) => onChange("designation", value)}
              />

              <FormInput
                label="Mobile Number"
                required
                value={form.mobileNumber}
                placeholder="XXXXXXXXXX"
                onChange={(value) => onChange("mobileNumber", value)}
              />

              <FormInput
                label="Email Address"
                required
                type="email"
                value={form.email}
                onChange={(value) => onChange("email", value)}
              />
            </div>
          </FormSection>
        </div>

        {/* RIGHT */}

        <div className="space-y-4">
          <FormSection icon={<FiBriefcase />} title="Sales Information">
            <div className="space-y-4">
              <FormSelect
                label="Lead Source"
                required
                value={form.leadSource}
                onChange={(value) => onChange("leadSource", value)}
                options={LEAD_SOURCES}
              />

              <UserSelect
                label="Assigned To"
                required
                value={form.assignedToId}
                users={users}
                onChange={(value) => onChange("assignedToId", value)}
              />
            </div>
          </FormSection>

          <FormSection icon={<FiFileText />} title="Requirements & Files">
            <div className="space-y-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Remarks
                </label>

                <textarea
                  rows={6}
                  value={form.remarks}
                  onChange={(event) => onChange("remarks", event.target.value)}
                  placeholder="Enter specific hardware requirements or customization requests..."
                  className="
                    w-full
                    resize-none
                    rounded-xl
                    border
                    border-slate-200
                    bg-slate-50/70
                    p-3
                    text-xs
                    text-slate-800
                    outline-none
                    transition
                    focus:border-primary
                    focus:ring-2
                    focus:ring-primary/20
                    dark:border-[#0d2336]
                    dark:bg-[#071929]
                    dark:text-white
                  "
                />
              </div>

              <label
                className="
                  flex
                  min-h-[150px]
                  cursor-pointer
                  flex-col
                  items-center
                  justify-center
                  rounded-2xl
                  border-2
                  border-dashed
                  border-slate-200
                  p-5
                  text-center
                  hover:bg-slate-50
                  dark:border-[#0d2336]
                  dark:hover:bg-[#071929]
                "
              >
                <FiPaperclip className="mb-3 text-2xl text-slate-400" />

                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Drop files or click to upload
                </span>

                <span className="mt-1 text-[10px] text-slate-400">
                  PDF, DOC, XLS up to 10MB
                </span>

                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={onAttachment}
                />
              </label>

              {form.attachments.length > 0 && (
                <div className="space-y-2">
                  {form.attachments.map((attachment, index) => (
                    <div
                      key={`${attachment}-${index}`}
                      className="
                          flex
                          items-center
                          gap-2
                          rounded-lg
                          bg-slate-50
                          px-3
                          py-2
                          text-[10px]
                          font-semibold
                          text-slate-500
                          dark:bg-[#071929]
                        "
                    >
                      <FiCheckCircle className="text-emerald-500" />

                      <span className="truncate">{attachment}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormSection>

          <div
            className="
            grid
            grid-cols-2
            gap-3
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-4
            dark:border-[#0d2336]
            dark:bg-[#051422]
          "
          >
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="w-full justify-center"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={saving}
              className="w-full justify-center"
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <CgSpinner className="animate-spin" />
                  Saving...
                </span>
              ) : (
                "Save Lead"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

/* ============================================================================
   EXCEL IMPORT MODAL
============================================================================ */

function ExcelImportModal({
  file,
  saving,
  dragging,
  inputRef,
  onClose,
  onFile,
  onDrop,
  onDragEnter,
  onDragLeave,
  onDownloadSample,
  onImport,
}: {
  file: File | null;
  saving: boolean;
  dragging: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDownloadSample: () => void;
  onImport: () => void;
}) {
  return (
    <Modal isOpen onClose={onClose} title="Upload a CSV File">
      <div className="space-y-5">
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={(event) => event.preventDefault()}
          onDragEnter={(event) => {
            event.preventDefault();
            onDragEnter();
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            onDragLeave();
          }}
          className={`
            cursor-pointer
            rounded-2xl
            border-2
            border-dashed
            p-10
            text-center
            transition
            ${
              dragging
                ? "border-primary bg-primary/5"
                : "border-slate-300 bg-white hover:bg-slate-50"
            }
            dark:border-[#0d2336]
            dark:bg-[#051422]
          `}
        >
          <FiUploadCloud className="mx-auto text-3xl text-slate-400" />

          <p className="mt-4 text-sm text-slate-600 dark:text-slate-200">
            Drag and drop your file here, or{" "}
            <span className="font-bold text-blue-500">Browse</span>
          </p>

          <p className="mt-2 text-[10px] text-slate-400">
            Supported formats: .xlsx, .xls, .csv • Max file size: 10 MB
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={onFile}
          />
        </div>

        {file && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <div className="flex min-w-0 items-center gap-2">
              <FiCheckCircle className="shrink-0 text-emerald-500" />

              <span className="truncate text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {file.name}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                inputRef.current!.value = "";
              }}
              className="text-slate-400 hover:text-rose-500"
            >
              <FiX />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onDownloadSample}
          className="text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-primary dark:text-slate-300"
        >
          Download a sample CSV file
        </button>

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 dark:border-[#0d2336]">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <Button type="button" disabled={!file || saving} onClick={onImport}>
            {saving ? (
              <span className="flex items-center gap-2">
                <CgSpinner className="animate-spin" />
                Importing...
              </span>
            ) : (
              "Import Leads"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================================
   INTEGRATION MODAL
============================================================================ */

function IntegrationModal({
  selectedSource,
  integrationLead,
  users,
  saving,
  onClose,
  onSelectSource,
  onChange,
  onSubmit,
}: {
  selectedSource: string;
  integrationLead: IntegrationLeadState;
  users: User[];
  saving: boolean;
  onClose: () => void;
  onSelectSource: (source: string) => void;
  onChange: <K extends keyof IntegrationLeadState>(
    field: K,
    value: IntegrationLeadState[K],
  ) => void;
  onSubmit: () => void;
}) {
  return (
    <Modal isOpen onClose={onClose} title="Add From Integration" size="xl">
      {!selectedSource ? (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              Select Lead Source
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              Select an integration to enter and create the lead details.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <IntegrationCard
              icon={<FiLink />}
              title="Website Forms"
              description="Capture leads from your website."
              onClick={() => onSelectSource("Website")}
            />

            <IntegrationCard
              icon={<FiDatabase />}
              title="Meta / Social"
              description="Receive social campaign leads."
              onClick={() => onSelectSource("Meta Ads")}
            />

            <IntegrationCard
              icon={<FiMail />}
              title="Email"
              description="Convert inbound enquiries."
              onClick={() => onSelectSource("Email")}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-[#0d2336]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Integration Source
              </p>

              <h3 className="mt-1 text-base font-bold text-slate-800 dark:text-white">
                {selectedSource}
              </h3>
            </div>

            <button
              type="button"
              onClick={() => onSelectSource("")}
              className="text-xs font-bold text-primary"
            >
              Change Source
            </button>
          </div>

          <FormSection icon={<FiUser />} title="Lead Details">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormInput
                label="Full Name"
                required
                value={integrationLead.contactName}
                onChange={(value) => onChange("contactName", value)}
              />

              <FormInput
                label="Organization Name"
                required
                value={integrationLead.organizationName}
                onChange={(value) => onChange("organizationName", value)}
              />

              <FormInput
                label="Email Address"
                type="email"
                value={integrationLead.email}
                onChange={(value) => onChange("email", value)}
              />

              <FormInput
                label="Mobile Number"
                value={integrationLead.mobileNumber}
                onChange={(value) => onChange("mobileNumber", value)}
              />

              <FormInput
                label="Organization Website"
                value={integrationLead.website}
                onChange={(value) => onChange("website", value)}
              />

              <UserSelect
                label="Assigned To"
                value={integrationLead.assignedToId}
                users={users}
                onChange={(value) => onChange("assignedToId", value)}
              />
            </div>
          </FormSection>

          <FormSection icon={<FiFileText />} title="Requirements & Files">
            <textarea
              rows={5}
              value={integrationLead.remarks}
              onChange={(event) => onChange("remarks", event.target.value)}
              placeholder="Enter lead requirements..."
              className="
                w-full
                resize-none
                rounded-xl
                border
                border-slate-200
                bg-slate-50/70
                p-3
                text-xs
                outline-none
                focus:ring-2
                focus:ring-primary/20
                dark:border-[#0d2336]
                dark:bg-[#071929]
                dark:text-white
              "
            />
          </FormSection>

          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 dark:border-[#0d2336]">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>

            <Button disabled={saving} onClick={onSubmit}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <CgSpinner className="animate-spin" />
                  Saving...
                </span>
              ) : (
                "Add Lead"
              )}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ============================================================================
   LEAD DETAILS MODAL
============================================================================ */

function LeadDetailsModal({
  lead,
  isOpen,
  onClose,
  onEdit,
  onMarkDead,
  onConvert,
}: {
  lead: Lead;
  isOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onMarkDead: () => void;
  onConvert: () => void;
}) {
  const details = parseLeadDescription(lead.description);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lead Details" size="xl">
      <div className="space-y-6">
        {/* HEADER */}

        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-slate-50 p-5 md:flex-row dark:bg-[#071929]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-slate-400">
                {formatLeadId(lead.id)}
              </span>

              <StatusBadge status={lead.status} stage={lead.stage} />
            </div>

            <h2 className="mt-2 text-lg font-extrabold text-slate-900 dark:text-white">
              {details.contactName || lead.title}
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              {details.organizationName || "No organization"}
            </p>
          </div>

          <div className="flex items-start gap-2">
            <button
              type="button"
              title="Message"
              className="
                rounded-xl
                border
                border-slate-200
                bg-white
                p-2.5
                text-slate-500
                hover:text-primary
                dark:border-[#0d2336]
                dark:bg-[#051422]
              "
            >
              <FiMessageSquare />
            </button>

            <button
              type="button"
              title="Edit"
              onClick={onEdit}
              className="
                rounded-xl
                border
                border-slate-200
                bg-white
                p-2.5
                text-slate-500
                hover:text-primary
                dark:border-[#0d2336]
                dark:bg-[#051422]
              "
            >
              <FiEdit3 />
            </button>
          </div>
        </div>

        {/* DETAILS */}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailBox icon={<FiUser />} label="Primary Contact">
            <DetailLine label="Full Name" value={details.contactName} />

            <DetailLine label="Designation" value={details.designation} />

            <DetailLine label="Mobile" value={details.mobileNumber} />

            <DetailLine label="Email" value={details.email} />
          </DetailBox>

          <DetailBox icon={<FiBriefcase />} label="Organization">
            <DetailLine label="Customer Type" value={details.customerType} />

            <DetailLine label="Organization" value={details.organizationName} />

            <DetailLine label="Website" value={details.website} />

            <DetailLine
              label="Address"
              value={[
                details.address,
                details.city,
                details.state,
                details.zipCode,
                details.country,
              ]
                .filter(Boolean)
                .join(", ")}
            />
          </DetailBox>

          <DetailBox icon={<FiShield />} label="Compliance">
            <DetailLine label="GST" value={details.gstNumber} />

            <DetailLine label="PAN" value={details.panNumber} />

            <DetailLine label="COI" value={details.coiNumber} />
          </DetailBox>

          <DetailBox icon={<FiActivity />} label="Sales Information">
            <DetailLine label="Lead Source" value={details.leadSource} />

            <DetailLine
              label="Assigned To"
              value={lead.assigned_to_name || "Unassigned"}
            />

            <DetailLine label="Created" value={formatDate(lead.created_at)} />

            <DetailLine label="Created By" value={lead.creator_name} />
          </DetailBox>
        </div>

        {/* REQUIREMENTS */}

        <DetailBox icon={<FiFileText />} label="Requirements & Files">
          <div className="rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-600 dark:bg-[#071929] dark:text-slate-300">
            {details.remarks || "No requirements or remarks added."}
          </div>

          {details.attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {details.attachments.map((file) => (
                <div
                  key={file}
                  className="flex items-center gap-2 text-xs font-semibold"
                >
                  <FiPaperclip />
                  {file}
                </div>
              ))}
            </div>
          )}
        </DetailBox>

        {/* ACTIVITY */}

        <DetailBox icon={<FiActivity />} label="Activity History">
          <div className="space-y-4">
            {lead.activity_history?.length ? (
              lead.activity_history.map((activity) => (
                <div
                  key={activity.id || activity.created_at}
                  className="flex gap-3"
                >
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />

                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {activity.action}
                    </p>

                    {activity.description && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {activity.description}
                      </p>
                    )}

                    <p className="mt-1 text-[10px] text-slate-400">
                      {formatDate(activity.created_at)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <>
                <ActivityItem
                  title="Lead Created"
                  description="Lead was registered in the CRM."
                  date={lead.created_at}
                />

                <ActivityItem
                  title={`Current Stage: ${lead.stage}`}
                  description={`Current status is ${lead.status}.`}
                  date={lead.created_at}
                />
              </>
            )}
          </div>
        </DetailBox>

        {/* ACTIONS */}

        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5 dark:border-[#0d2336]">
          <Button variant="outline" onClick={onEdit}>
            <FiEdit3 className="mr-2" />
            Edit
          </Button>

          <button
            type="button"
            onClick={onMarkDead}
            className="
              rounded-xl
              border
              border-rose-200
              px-4
              py-2
              text-xs
              font-bold
              text-rose-500
              hover:bg-rose-50
              dark:border-rose-900
              dark:hover:bg-rose-950/20
            "
          >
            <span className="flex items-center gap-2">
              <FiXCircle />
              Mark as Dead
            </span>
          </button>

          <Button onClick={onConvert}>
            <FiArrowUpRight className="mr-2" />
            Convert to Opportunity
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================================
   UI COMPONENTS
============================================================================ */

function KpiCard({
  label,
  value,
  percentage,
  positive,
  icon,
}: {
  label: string;
  value: number;
  percentage: string;
  positive: boolean;
  icon: ReactNode;
}) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-slate-200/80
        bg-white
        p-5
        shadow-sm
        dark:border-[#0d2336]
        dark:bg-[#051422]
      "
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </span>

        <span
          className={`
            inline-flex
            items-center
            gap-1
            rounded-md
            px-2
            py-1
            text-[10px]
            font-bold
            ${
              positive
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-rose-500/10 text-rose-500"
            }
          `}
        >
          {icon}
          {percentage}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
          {value.toLocaleString("en-IN")}
        </p>

        <p
          className={`
            mt-1
            text-[10px]
            font-bold
            ${positive ? "text-emerald-500" : "text-rose-500"}
          `}
        >
          vs last month
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ status, stage }: { status: string; stage: string }) {
  let label = status || "Unknown";

  let className =
    "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";

  if (status === "new" || stage === "lead") {
    label = "New";

    className =
      "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300";
  }

  if (status === "contacted") {
    label = "Contacted";

    className = "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  if (status === "qualified" || stage === "opportunity") {
    label = "Qualified";

    className = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }

  if (stage === "quotation") {
    label = "Quotation";

    className = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
  }

  if (status === "dead" || stage === "dead") {
    label = "Dead";

    className = "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  }

  if (status === "won") {
    label = "Won";

    className = "bg-emerald-500/10 text-emerald-600";
  }

  return (
    <span
      className={`
        inline-flex
        rounded-lg
        px-2.5
        py-1.5
        text-[10px]
        font-bold
        capitalize
        ${className}
      `}
    >
      {label}
    </span>
  );
}

function TableHeader({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2">
      {label}

      <span className="flex flex-col leading-[6px] text-slate-300">
        <span>⌃</span>
        <span>⌄</span>
      </span>
    </span>
  );
}

function FilterChip({ label }: { label: string }) {
  return (
    <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 dark:bg-[#071929] dark:text-slate-300">
      {label}
    </span>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-500">
        {label}
      </label>

      {children}
    </div>
  );
}

function DateFilterInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <FiCalendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />

      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="
          h-11
          w-full
          rounded-xl
          border
          border-slate-200
          bg-white
          pl-10
          pr-3
          text-xs
          text-slate-700
          outline-none
          focus:border-primary
          focus:ring-2
          focus:ring-primary/10
          dark:border-[#0d2336]
          dark:bg-[#071929]
          dark:text-white
        "
      />
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<
    | string
    | {
        value: string;
        label: string;
      }
  >;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="
          h-11
          w-full
          appearance-none
          rounded-xl
          border
          border-slate-200
          bg-white
          px-3
          pr-9
          text-xs
          text-slate-700
          outline-none
          focus:border-primary
          focus:ring-2
          focus:ring-primary/10
          dark:border-[#0d2336]
          dark:bg-[#071929]
          dark:text-white
        "
      >
        <option value="">{placeholder}</option>

        {options.map((option) => {
          const item =
            typeof option === "string"
              ? {
                  value: option,
                  label: option,
                }
              : option;

          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>

      <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

const filterInput = `
  w-full
  rounded-xl
  border
  border-slate-200
  bg-slate-50/70
  px-3.5
  py-2.5
  text-xs
  text-slate-800
  outline-none
  focus:ring-2
  focus:ring-primary/30
  dark:border-[#0d2336]
  dark:bg-[#071929]
  dark:text-white
`;

function FormSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 dark:border-[#0d2336] dark:bg-[#051422]">
      <div className="mb-5 flex items-center gap-2.5 border-b border-slate-100 pb-3 dark:border-[#0d2336]">
        <span className="text-slate-500">{icon}</span>

        <h3 className="text-sm font-bold text-slate-800 dark:text-white">
          {title}
        </h3>
      </div>

      {children}
    </section>
  );
}

function FormInput({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
        {label}

        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>

      <Input
        type={type}
        value={value}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  options,
  required,
  allowCustom = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
  allowCustom?: boolean;
}) {
  const isCustom = allowCustom && value && !options.includes(value);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
        {label}

        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>

      <div className="relative">
        <select
          value={isCustom ? "" : value}
          onChange={(event) => onChange(event.target.value)}
          className={`
            ${filterInput}
            appearance-none
            pr-9
          `}
        >
          <option value="">Select {label}</option>

          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>

        <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>

      {/* {allowCustom && (
        <input
          value={isCustom ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Or enter custom state"
          className={`
            ${filterInput}
            mt-2
          `}
        />
      )} */}
    </div>
  );
}

function UserSelect({
  label,
  value,
  users,
  onChange,
  required,
}: {
  label: string;
  value: string;
  users: User[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
        {label}

        {required && <span className="ml-1 text-rose-500">*</span>}
      </label>

      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="
            w-full
            appearance-none
            rounded-xl
            border
            border-slate-200
            bg-slate-50/70
            px-3
            py-2.5
            pr-9
            text-xs
            outline-none
            focus:ring-2
            focus:ring-primary/30
            dark:border-[#0d2336]
            dark:bg-[#071929]
            dark:text-white
          "
        >
          <option value="">Select Assigned To</option>

          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {getUserName(user)}
            </option>
          ))}
        </select>

        <FiChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

function DocumentField({
  label,
  value,
  onChange,
  onFile,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
        {label}
      </label>

      <div className="grid grid-cols-[minmax(0,1fr)_150px] gap-3">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`Enter ${label}`}
        />

        <label
          className="
            flex
            cursor-pointer
            items-center
            justify-center
            gap-1.5
            rounded-xl
            border-2
            border-dashed
            border-slate-200
            px-3
            text-[10px]
            font-bold
            text-slate-500
            hover:bg-slate-50
            dark:border-[#0d2336]
            dark:hover:bg-[#071929]
          "
        >
          <FiUploadCloud />
          Upload Doc
          <input type="file" className="hidden" onChange={onFile} />
        </label>
      </div>
    </div>
  );
}

function DropdownMenu({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`
        absolute
        right-0
        top-full
        z-50
        mt-2
        w-52
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-1.5
        shadow-2xl
        dark:border-[#0d2336]
        dark:bg-[#051422]
        ${className}
      `}
    >
      {children}
    </div>
  );
}

function DropdownButton({
  icon,
  children,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        flex
        w-full
        items-center
        gap-3
        rounded-xl
        px-3
        py-2.5
        text-left
        text-xs
        font-semibold
        text-slate-700
        hover:bg-slate-100
        dark:text-slate-200
        dark:hover:bg-[#071929]
      "
    >
      {icon}
      {children}
    </button>
  );
}

function RowAction({
  icon,
  children,
  onClick,
  danger,
  success,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  success?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex
        w-full
        items-center
        gap-2
        rounded-lg
        px-3
        py-2
        text-left
        text-xs
        font-semibold
        hover:bg-slate-100
        dark:hover:bg-[#071929]
        ${
          danger
            ? "text-rose-500"
            : success
              ? "text-emerald-600"
              : "text-slate-700 dark:text-slate-200"
        }
      `}
    >
      {icon}
      {children}
    </button>
  );
}

function IntegrationCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="
        rounded-2xl
        border
        border-slate-200
        p-5
        text-left
        transition
        hover:-translate-y-0.5
        hover:border-primary/30
        hover:shadow-md
        dark:border-[#0d2336]
      "
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
        {icon}
      </div>

      <h4 className="mt-4 text-xs font-bold text-slate-800 dark:text-white">
        {title}
      </h4>

      <p className="mt-1 text-[10px] leading-5 text-slate-400">{description}</p>
    </button>
  );
}

function DetailBox({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 p-5 dark:border-[#0d2336]">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-[#0d2336]">
        <span className="text-slate-400">{icon}</span>

        <h3 className="text-xs font-bold text-slate-800 dark:text-white">
          {label}
        </h3>
      </div>

      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-5 text-xs">
      <span className="text-slate-400">{label}</span>

      <span className="max-w-[65%] text-right font-semibold text-slate-700 dark:text-slate-200">
        {value || "—"}
      </span>
    </div>
  );
}

function ActivityItem({
  title,
  description,
  date,
}: {
  title: string;
  description: string;
  date: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />

      <div>
        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {title}
        </p>

        <p className="mt-1 text-[11px] text-slate-400">{description}</p>

        <p className="mt-1 text-[10px] text-slate-400">{formatDate(date)}</p>
      </div>
    </div>
  );
}

function EmptyLeads() {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
      <div
        className="
          rounded-2xl
          bg-slate-100
          p-4
          text-slate-400
          dark:bg-[#071929]
        "
      >
        <FiUser className="text-3xl" />
      </div>

      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
        No Leads Found
      </p>

      <p className="text-xs text-slate-400">
        Try changing your search or filters.
      </p>
    </div>
  );
}
