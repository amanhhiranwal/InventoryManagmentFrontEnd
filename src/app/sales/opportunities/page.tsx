"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import { Lead, getLeadsApi } from "@/features/workflows/api/workflows.api";
import StatCard from "@/components/crm/StatCard";
import Pagination from "@/components/crm/Pagination";
import { PriorityPill, StatusPill } from "@/components/crm/Pill";
import {
  BillingShippingHeader,
  FormCard,
  FormSectionBlock,
} from "@/components/crm/FormCard";
import FormPageHeader, {
  CancelButton,
  DraftButton,
  SubmitButton,
} from "@/components/crm/FormPageHeader";
import {
  ListToolbar,
  PrimaryAction,
} from "@/components/crm/ListPageShell";
import {
  OPPORTUNITY_STATUS,
  OPPORTUNITY_STATUS_LABEL,
  OpportunityStatus as CanonicalOpportunityStatus,
  canTransitionOpportunity,
  createOpportunityApi,
  getOpportunitiesApi,
  getOpportunityApi,
  updateOpportunityApi,
  updateOpportunityStatusApi,
} from "@/features/opportunities/api/opportunities.api";
import {
  FiPlus,
  FiSearch,
  FiGrid,
  FiList,
  FiDownload,
  FiRefreshCw,
  FiPhone,
  FiMoreVertical,
  FiMessageSquare,
  FiX,
  FiCalendar,
  FiMapPin,
  FiUser,
  FiMail,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiShoppingCart,
  FiUploadCloud,
  FiEdit2,
  FiAlertCircle,
} from "react-icons/fi";

interface ProductItem {
  name: string;
  qty: number;
  price: number;
}

type CustomerType =
  "Distributor" | "OEM" | "End Customer" | "Institution" | "Corporate";

type OpportunityStage =
  | "Qualified"
  | "Requirement"
  | "Demo Scheduled"
  | "Proposal Sent"
  | "Negotiation"
  | "Closed Won"
  | "Dead";

/* Display label <-> canonical backend status. The labels below are the
   existing UI wording; only the persisted values are canonical. */
const STAGE_TO_STATUS: Record<OpportunityStage, CanonicalOpportunityStatus> = {
  Qualified: OPPORTUNITY_STATUS.QUALIFICATION,
  Requirement: OPPORTUNITY_STATUS.REQUIREMENT,
  "Demo Scheduled": OPPORTUNITY_STATUS.DEMO,
  "Proposal Sent": OPPORTUNITY_STATUS.PROPOSAL,
  Negotiation: OPPORTUNITY_STATUS.NEGOTIATION,
  "Closed Won": OPPORTUNITY_STATUS.WON,
  Dead: OPPORTUNITY_STATUS.LOST,
};

/* Next step along the pipeline, or WON after NEGOTIATION. */
function nextStatusOf(
  current: CanonicalOpportunityStatus,
): CanonicalOpportunityStatus | null {
  const order: CanonicalOpportunityStatus[] = [
    OPPORTUNITY_STATUS.QUALIFICATION,
    OPPORTUNITY_STATUS.REQUIREMENT,
    OPPORTUNITY_STATUS.DEMO,
    OPPORTUNITY_STATUS.PROPOSAL,
    OPPORTUNITY_STATUS.NEGOTIATION,
    OPPORTUNITY_STATUS.WON,
  ];

  const index = order.indexOf(current);

  if (index === -1 || index === order.length - 1) {
    return null;
  }

  return order[index + 1];
}

function statusToStage(status?: string | null): OpportunityStage {
  return (OPPORTUNITY_STATUS_LABEL[
    (status || "QUALIFICATION") as CanonicalOpportunityStatus
  ] || "Qualified") as OpportunityStage;
}

type OpportunityStatus = "Active" | "Inactive";

type Priority = "High" | "Medium" | "Low";

interface Opportunity {
  id: string;
  leadId: string;
  customerName: string;
  email: string;
  phone: string;
  company: string;
  city: string;
  state: string;
  country: string;

  customerType: CustomerType;
  stage: OpportunityStage;
  status: OpportunityStatus;
  priority: Priority;

  dealValue: number;
  owner: string;
  ownerId?: string;

  expectedClosingDate?: string;
  createdAt?: string;

  designation?: string;
  officeAddress?: string;

  gstNumber?: string;
  panNumber?: string;
  coiNumber?: string;

  requirements?: string;
  remarks?: string;

  productItems?: ProductItem[];

  activityHistory?: Activity[];
}

interface Activity {
  id: string;
  type: "Demo Scheduled" | "Outgoing Call" | "Form Submission" | "Note";
  title: string;
  description: string;
  date: string;
  time?: string;
}

interface SalesUser {
  id: string;
  name: string;
}

interface OpportunityFilters {
  dateFrom: string;
  dateTo: string;
  customerType: string;
  assignedTo: string;
  status: string;
  state: string;
}

const CUSTOMER_TYPES: CustomerType[] = [
  "Distributor",
  "OEM",
  "End Customer",
  "Institution",
  "Corporate",
];

const STATES = [
  "All",
  "Delhi",
  "Maharashtra",
  "Pune",
  "Gujarat",
  "Karnataka",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "West Bengal",
  "Rajasthan",
  "Madhya Pradesh",
  "Kerala",
  "Andhra Pradesh",
  "Haryana",
  "Punjab",
];

const BOARD_STAGES: OpportunityStage[] = [
  "Qualified",
  "Requirement",
  "Demo Scheduled",
  "Proposal Sent",
  "Negotiation",
];

/* Pipeline shown in the details drawer, in canonical order. */
const DRAWER_PIPELINE: { label: string; stage: OpportunityStage }[] = [
  { label: "Qualified", stage: "Qualified" },
  { label: "Requirement", stage: "Requirement" },
  { label: "Demo", stage: "Demo Scheduled" },
  { label: "Proposal", stage: "Proposal Sent" },
  { label: "Negotiation", stage: "Negotiation" },
  { label: "Closed Won", stage: "Closed Won" },
];

const STAGE_PROGRESS: Record<OpportunityStage, number> = {
  Qualified: 20,
  Requirement: 40,
  "Demo Scheduled": 60,
  "Proposal Sent": 80,
  Negotiation: 90,
  "Closed Won": 100,
  Dead: 0,
};

const STATUS_OPTIONS = ["All", "Active", "Inactive"];

const DEFAULT_FILTERS: OpportunityFilters = {
  dateFrom: "",
  dateTo: "",
  customerType: "",
  assignedTo: "",
  status: "",
  state: "",
};

function formatCurrency(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function formatShortCurrency(value: number) {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  }

  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)} L`;
  }

  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)} K`;
  }

  return formatCurrency(value);
}

function formatDate(value?: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function normalizePriority(value: any): Priority {
  const priority = String(value || "").toLowerCase();

  if (priority === "high") return "High";
  if (priority === "low") return "Low";

  return "Medium";
}

function normalizeStatus(value: any): OpportunityStatus {
  /* Terminal opportunities read as Inactive in the existing UI. */
  const status = String(value || "").toUpperCase();

  if (status === OPPORTUNITY_STATUS.LOST || status === OPPORTUNITY_STATUS.WON) {
    return "Inactive";
  }

  return "Active";
}

function normalizeCustomerType(value: any): CustomerType {
  const type = String(value || "").toLowerCase();

  if (type === "oem") return "OEM";
  if (type === "end customer") return "End Customer";
  if (type === "institution") return "Institution";
  if (type === "corporate") return "Corporate";

  return "Distributor";
}

function normalizeStage(record: any): OpportunityStage {
  return statusToStage(record?.status);
}

function getLeadId(lead: any) {
  return lead.lead_id || lead.leadId || lead.reference_id || lead.id || "";
}

function getDealValue(lead: any) {
  if (typeof lead.deal_value === "number") {
    return lead.deal_value;
  }

  if (typeof lead.value === "number") {
    return lead.value;
  }

  if (typeof lead.estimated_value === "number") {
    return lead.estimated_value;
  }

  if (Array.isArray(lead.quotation_items) && lead.quotation_items.length) {
    return lead.quotation_items.reduce(
      (sum: number, item: any) =>
        sum + Number(item.qty || 1) * Number(item.price || 0),
      0,
    );
  }

  return 0;
}

function mapLeadToOpportunity(lead: any): Opportunity {
  /* Accepts an OpportunityModel from /api/v1/opportunities. */
  const customerName =
    lead.customer_name ||
    lead.contact_name ||
    lead.full_name ||
    lead.name ||
    lead.title ||
    "Unknown Customer";

  const company =
    lead.company ||
    lead.organization_name ||
    lead.account ||
    lead.description ||
    "Corporate Client";

  const owner =
    lead.assigned_to_name ||
    lead.assignee_name ||
    lead.creator_name ||
    lead.assigned_to ||
    "Sales Team";

  const stage = normalizeStage(lead);

  return {
    id: String(lead.id),
    leadId: String(lead.lead_id ?? getLeadId(lead)),

    customerName,
    email: lead.email || lead.email_address || "",
    phone: lead.phone || lead.mobile || lead.mobile_number || "",

    company,

    city: lead.city || lead.location_city || "",

    state: lead.state || lead.state_name || "",

    country: lead.country || "India",

    customerType: normalizeCustomerType(
      lead.customer_type_name || lead.customer_type,
    ),

    stage,

    status: normalizeStatus(lead.status),

    priority: normalizePriority(lead.priority),

    dealValue: getDealValue(lead),

    owner,

    ownerId: lead.assigned_to_id || lead.owner_id || undefined,

    expectedClosingDate:
      lead.expected_closing_date ||
      lead.expected_close_date ||
      lead.closing_date ||
      undefined,

    createdAt: lead.created_at || lead.createdAt,

    designation: lead.designation || lead.contact_designation || "",

    officeAddress: lead.office_address || lead.address || "",

    gstNumber: lead.gst_number || lead.gstin || "",

    panNumber: lead.pan_number || lead.pan || "",

    coiNumber: lead.coi_number || "",

    requirements: lead.requirements || "",

    remarks: lead.remarks || lead.notes || "",

    productItems: Array.isArray(lead.product_items)
      ? lead.product_items
      : Array.isArray(lead.quotation_items)
        ? lead.quotation_items
        : [],

    activityHistory: Array.isArray(lead.activity_history)
      ? lead.activity_history
      : [],
  };
}

function OpportunitiesPageInner() {
  const { addToast } = useUIStore();

  const searchParams = useSearchParams();

  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");

  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [showFilters, setShowFilters] = useState(false);
  const [showPageMenu, setShowPageMenu] = useState(false);

  const [filters, setFilters] = useState<OpportunityFilters>(DEFAULT_FILTERS);

  const [appliedFilters, setAppliedFilters] =
    useState<OpportunityFilters>(DEFAULT_FILTERS);

  const [showAddModal, setShowAddModal] = useState(false);

  /* Lead-driven creation: pick a lead, then open the prefilled form. */
  const [showLeadPicker, setShowLeadPicker] = useState(false);
  const [convertibleLeads, setConvertibleLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [sourceLead, setSourceLead] = useState<Lead | null>(null);

  const [selectedOpportunity, setSelectedOpportunity] =
    useState<Opportunity | null>(null);

  const [showDetails, setShowDetails] = useState(false);

  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);

  const [editingOpportunity, setEditingOpportunity] =
    useState<Opportunity | null>(null);

  const pageMenuRef = useRef<HTMLDivElement>(null);

  const fetchOpportunities = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const list = await getOpportunitiesApi();

        setOpps(list.map(mapLeadToOpportunity));
      } catch (error) {
        console.error("Failed to fetch opportunities:", error);

        addToast("Unable to load opportunities.", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [addToast],
  );

  const fetchSalesUsers = async () => {
    try {
      /*
       * If your application already has a users endpoint,
       * replace this URL with your actual endpoint.
       */
      const res = await api.get("/api/v1/users/");

      if (res.data?.success) {
        const users = Array.isArray(res.data.data) ? res.data.data : [];

        setSalesUsers(
          users.map((user: any) => ({
            id: String(user.id || user.user_id),
            name: user.name || user.full_name || user.username || "Sales User",
          })),
        );
      }
    } catch (error) {
      /*
       * Users are optional for rendering the page.
       * The page still works if this endpoint doesn't exist.
       */
      console.warn("Sales users endpoint unavailable.", error);
    }
  };

  /* Only QUALIFIED leads may become an opportunity: a lead has to pass the
     qualification checklist first. Leads already carrying an opportunity are
     excluded too. */
  const loadConvertibleLeads = useCallback(async () => {
    setLoadingLeads(true);

    try {
      const [leads, existing] = await Promise.all([
        getLeadsApi(),
        getOpportunitiesApi(),
      ]);

      const taken = new Set(
        existing
          .map((opportunity) => opportunity.lead_id)
          .filter((id): id is number => id !== null && id !== undefined)
          .map(String),
      );

      setConvertibleLeads(
        leads.filter(
          (lead) =>
            lead.status === "QUALIFIED" && !taken.has(String(lead.id)),
        ),
      );
    } catch (error) {
      console.error(error);

      addToast("Unable to load leads.", "error");
      setConvertibleLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  }, [addToast]);

  const openLeadPicker = () => {
    setShowLeadPicker(true);
    loadConvertibleLeads();
  };

  const startFromLead = (lead: Lead | null) => {
    setSourceLead(lead);
    setShowLeadPicker(false);
    setShowAddModal(true);
  };

  useEffect(() => {
    fetchOpportunities();
    fetchSalesUsers();
  }, [fetchOpportunities]);

  /* Arriving from the Leads page via "Convert To Opportunity". */
  const handledLeadParam = useRef(false);

  useEffect(() => {
    const leadId = searchParams.get("leadId");

    if (!leadId || handledLeadParam.current) return;

    handledLeadParam.current = true;

    (async () => {
      try {
        const leads = await getLeadsApi();
        const match = leads.find((lead) => String(lead.id) === String(leadId));

        if (!match) {
          addToast("That lead could not be found.", "error");
          return;
        }

        if (match.status === "CONVERTED") {
          addToast("This lead has already been converted.", "info");
          return;
        }

        setSourceLead(match);
        setShowAddModal(true);
      } catch (error) {
        console.error(error);
        addToast("Unable to load that lead.", "error");
      } finally {
        /* Drop the param so a refresh does not reopen the form. A plain
           history replace is used rather than router.replace: the latter
           re-runs the Suspense boundary and remounts this page, which would
           discard the state we just set. */
        window.history.replaceState({}, "", "/sales/opportunities");
      }
    })();
  }, [searchParams, addToast]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        pageMenuRef.current &&
        !pageMenuRef.current.contains(event.target as Node)
      ) {
        setShowPageMenu(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return opps.filter((opp) => {
      const matchesSearch =
        !query ||
        opp.customerName.toLowerCase().includes(query) ||
        opp.company.toLowerCase().includes(query) ||
        opp.email.toLowerCase().includes(query) ||
        opp.leadId.toLowerCase().includes(query) ||
        opp.owner.toLowerCase().includes(query);

      const matchesCustomerType =
        !appliedFilters.customerType ||
        opp.customerType === appliedFilters.customerType;

      const matchesAssignedTo =
        !appliedFilters.assignedTo ||
        opp.ownerId === appliedFilters.assignedTo ||
        opp.owner === appliedFilters.assignedTo;

      const matchesStatus =
        !appliedFilters.status ||
        appliedFilters.status === "All" ||
        opp.status === appliedFilters.status;

      const matchesState =
        !appliedFilters.state ||
        appliedFilters.state === "All" ||
        opp.state === appliedFilters.state;

      let matchesDate = true;

      if (appliedFilters.dateFrom || appliedFilters.dateTo) {
        const created = opp.createdAt ? new Date(opp.createdAt) : null;

        if (created && !Number.isNaN(created.getTime())) {
          if (
            appliedFilters.dateFrom &&
            created < new Date(`${appliedFilters.dateFrom}T00:00:00`)
          ) {
            matchesDate = false;
          }

          if (
            appliedFilters.dateTo &&
            created > new Date(`${appliedFilters.dateTo}T23:59:59`)
          ) {
            matchesDate = false;
          }
        }
      }

      return (
        matchesSearch &&
        matchesCustomerType &&
        matchesAssignedTo &&
        matchesStatus &&
        matchesState &&
        matchesDate
      );
    });
  }, [opps, search, appliedFilters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;

    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  /*
   * Figma KPI values:
   *
   * Total Orders
   * Total Negotiation
   * Closed Won Today
   *
   * Since the existing API is a leads endpoint,
   * "Total Orders" is calculated as total opportunities.
   */
  const totalOrders = opps.length;

  const negotiationCount = opps.filter(
    (opp) => opp.stage === "Negotiation",
  ).length;

  const closedWonToday = opps.filter((opp) => {
    if (opp.stage !== "Closed Won") {
      return false;
    }

    if (!opp.createdAt) {
      return false;
    }

    const date = new Date(opp.createdAt);

    const today = new Date();

    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }).length;

  const applyFilters = () => {
    setAppliedFilters({
      ...filters,
    });

    setPage(1);
    setShowFilters(false);

    addToast("Opportunity filters applied.", "success");
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const activeFilterCount = [
    appliedFilters.dateFrom,
    appliedFilters.dateTo,
    appliedFilters.customerType,
    appliedFilters.assignedTo,
    appliedFilters.status,
    appliedFilters.state,
  ].filter(Boolean).length;

  const handleCreateOpportunity = async (payload: Record<string, any>) => {
    try {
      setLoading(true);

      await createOpportunityApi({
        ...(payload.leadId ? { lead_id: Number(payload.leadId) } : {}),

        title: payload.contactName || payload.organizationName,
        description: payload.organizationName,

        organization_name: payload.organizationName,
        website: payload.organizationWebsite,
        office_address: payload.officeAddress,
        city: payload.city,
        zip_code: payload.pinCode,
        country: payload.country,

        shipping_address: payload.shippingAddress,
        shipping_city: payload.shippingCity,
        shipping_state: payload.shippingState,
        shipping_zip_code: payload.shippingPinCode,
        shipping_country: payload.shippingCountry,

        gst_number: payload.gstNumber,
        pan_number: payload.panNumber,
        coi_number: payload.coiNumber,

        contact_name: payload.contactName,
        designation: payload.designation,
        mobile_number: payload.mobileNumber,
        email: payload.email,

        priority: payload.priority,
        expected_closing_date: payload.expectedClosingDate || null,
        deal_value: Number(payload.dealValue) || 0,

        requirements: payload.remarks,
        remarks: payload.remarks,

        product_items: payload.productItems || [],
      });

      addToast("Opportunity created successfully.", "success");

      setShowAddModal(false);
      setSourceLead(null);

      /*
       * IMPORTANT:
       * Refresh immediately after creation.
       */
      await fetchOpportunities(true);

      setPage(1);
    } catch (error: any) {
      console.error("Create opportunity error:", error);

      addToast(
        error?.response?.data?.detail ||
          error?.message ||
          "Failed to create opportunity.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await fetchOpportunities(true);

    addToast("Opportunity list refreshed.", "success");
  };

  const handleExportData = () => {
    const headers = [
      "Lead ID",
      "Customer Name",
      "Email",
      "Phone",
      "Company",
      "City",
      "State",
      "Customer Type",
      "Deal Value",
      "Assigned To",
      "Status",
      "Priority",
      "Stage",
      "Expected Closing Date",
    ];

    const rows = filtered.map((opp) => [
      opp.leadId,
      opp.customerName,
      opp.email,
      opp.phone,
      opp.company,
      opp.city,
      opp.state,
      opp.customerType,
      opp.dealValue,
      opp.owner,
      opp.status,
      opp.priority,
      opp.stage,
      opp.expectedClosingDate || "",
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => {
            const value = cell == null ? "" : String(cell);

            return `"${value.replace(/"/g, '""')}"`;
          })
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `opportunities-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setShowPageMenu(false);

    addToast("Opportunity data exported.", "success");
  };

  const handleDownloadChart = () => {
    const canvas = document.createElement("canvas");

    canvas.width = 1200;
    canvas.height = 700;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    ctx.fillStyle = "#f5f6f8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#233353";
    ctx.font = "700 32px Arial";

    ctx.fillText("Opportunity Pipeline", 60, 70);

    const chartData = [
      {
        label: "Qualified",
        value: opps.filter((x) => x.stage === "Qualified").length,
      },
      {
        label: "Demo Scheduled",
        value: opps.filter((x) => x.stage === "Demo Scheduled").length,
      },
      {
        label: "Proposal Sent",
        value: opps.filter((x) => x.stage === "Proposal Sent").length,
      },
      {
        label: "Negotiation",
        value: negotiationCount,
      },
    ];

    const max = Math.max(...chartData.map((x) => x.value), 1);

    chartData.forEach((item, index) => {
      const x = 100 + index * 260;

      const barHeight = (item.value / max) * 400;

      const y = 570 - barHeight;

      ctx.fillStyle = "#233353";

      ctx.fillRect(x, y, 120, barHeight);

      ctx.fillStyle = "#475569";

      ctx.font = "600 18px Arial";

      ctx.fillText(item.label, x - 10, 620);

      ctx.fillStyle = "#233353";

      ctx.font = "700 24px Arial";

      ctx.fillText(String(item.value), x + 45, y - 15);
    });

    const link = document.createElement("a");

    link.download = "opportunity-pipeline.png";

    link.href = canvas.toDataURL("image/png");

    link.click();

    setShowPageMenu(false);

    addToast("Pipeline chart downloaded.", "success");
  };

  const openDetails = async (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setShowDetails(true);
    setOpenActionMenu(null);

    /*
     * Optional detail endpoint.
     * If unavailable, the already loaded lead
     * remains usable.
     */
    try {
      const fresh = await getOpportunityApi(opp.id);

      setSelectedOpportunity(mapLeadToOpportunity(fresh));
    } catch {
      // Keep current opportunity data.
    }
  };

  /* Advance an opportunity one step along the canonical pipeline.
     This is what previously never reached the backend. */
  const handleAdvanceStage = async (opp: Opportunity) => {
    const current = STAGE_TO_STATUS[opp.stage];
    const next = nextStatusOf(current);

    /* Returning silently here left the user with no idea why nothing
       happened, which is exactly the case at the end of the pipeline. */
    if (!next) {
      addToast(
        `${opp.customerName} is already at ${opp.stage} — there is no further stage.`,
        "info",
      );
      return;
    }

    if (!canTransitionOpportunity(current, next)) {
      addToast(
        `An opportunity at ${opp.stage} cannot move to ${statusToStage(next)}.`,
        "warning",
      );
      return;
    }

    try {
      const updated = await updateOpportunityStatusApi(opp.id, next);

      setOpps((current) =>
        current.map((item) =>
          item.id === opp.id ? mapLeadToOpportunity(updated) : item,
        ),
      );

      setSelectedOpportunity((currentSelected) =>
        currentSelected && currentSelected.id === opp.id
          ? mapLeadToOpportunity(updated)
          : currentSelected,
      );

      setOpenActionMenu(null);

      addToast(`Opportunity moved to ${statusToStage(next)}.`, "success");
    } catch (error: any) {
      console.error(error);

      addToast(
        error?.response?.data?.detail || "Failed to update opportunity stage.",
        "error",
      );
    }
  };

  const handleMarkDead = async (opp: Opportunity) => {
    try {
      /*
       * Change this endpoint/body if your backend
       * uses a dedicated "mark dead" endpoint.
       */
      await updateOpportunityStatusApi(opp.id, OPPORTUNITY_STATUS.LOST);

      setOpps((current) =>
        current.map((item) =>
          item.id === opp.id
            ? {
                ...item,
                stage: "Dead",
                status: "Inactive",
              }
            : item,
        ),
      );

      /* Keep the open drawer in step with the list, the same way
         handleAdvanceStage does. */
      setSelectedOpportunity((currentSelected) =>
        currentSelected && currentSelected.id === opp.id
          ? { ...currentSelected, stage: "Dead", status: "Inactive" }
          : currentSelected,
      );

      setOpenActionMenu(null);

      addToast(`${opp.customerName} was marked as dead.`, "success");
    } catch (error: any) {
      console.error(error);

      addToast(
        error?.response?.data?.detail ||
          "Failed to mark opportunity as dead.",
        "error",
      );
    }
  };

  const handleSaveEdit = async (payload: Partial<Opportunity>) => {
    if (!editingOpportunity) {
      return;
    }

    try {
      const updated = await updateOpportunityApi(editingOpportunity.id, {
        title: payload.customerName,

        organization_name: payload.company,

        priority: payload.priority,

        assigned_to_id: payload.ownerId,

        expected_closing_date: payload.expectedClosingDate || null,

        deal_value: payload.dealValue,
      });

      if (updated) {
        setOpps((current) =>
          current.map((item) =>
            item.id === editingOpportunity.id
              ? {
                  ...item,
                  ...payload,
                }
              : item,
          ),
        );

        setEditingOpportunity(null);

        addToast("Opportunity updated.", "success");
      }
    } catch (error) {
      console.error(error);

      addToast("Failed to update opportunity.", "error");
    }
  };

  if (showAddModal) {
    return (
      <NewOpportunityPage
        lead={sourceLead}
        onClose={() => {
          setShowAddModal(false);
          setSourceLead(null);
        }}
        onSubmit={handleCreateOpportunity}
      />
    );
  }

  return (
    <div className="min-h-full space-y-5 pb-8">
        {/* =========================================================
            PAGE HEADER
        ========================================================= */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Opportunity
            </h1>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh opportunities"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-300 dark:hover:bg-[#0b2034]"
            >
              <FiRefreshCw
                className={refreshing ? "animate-spin" : ""}
                size={13}
              />
            </button>
          </div>

          <div className="relative" ref={pageMenuRef}>
            <div className="flex items-center gap-1">
              {/* <button
                type="button"
                onClick={() =>
                  setShowPageMenu(
                    (value) => !value
                  )
                }
                className="flex h-8 items-center gap-3 rounded-lg bg-[#233353] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#18243a]"
              >
                <span>Button CTA</span>
                <FiChevronDown
                  size={12}
                />
              </button> */}

              <button
                type="button"
                onClick={() => setShowPageMenu((value) => !value)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:bg-[#071929] dark:text-slate-300"
              >
                <FiMoreVertical size={15} />
              </button>
            </div>

            {showPageMenu && (
              <div className="absolute right-0 top-10 z-[100] w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-[#17304a] dark:bg-[#071929]">
                <button
                  type="button"
                  onClick={handleExportData}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-[#0b2034]"
                >
                  <FiDownload size={14} />
                  Export Data
                </button>

                <button
                  type="button"
                  onClick={handleDownloadChart}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-[#0b2034]"
                >
                  <FiGrid size={14} />
                  Download Chart
                </button>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================
            KPI CARDS
        ========================================================= */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Total Orders"
            value={totalOrders}
            change="18.0%"
            positive
          />

          <StatCard
            label="Total Negotiation"
            value={negotiationCount}
            change="12%"
            positive={false}
          />

          <StatCard
            label="Closed Won Today"
            value={closedWonToday}
            change="15.0%"
            positive
          />
        </div>

        {/* =========================================================
            SEARCH + VIEW + FILTER + ADD
        ========================================================= */}
        <div className="relative">
        <ListToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search Opportunities"
          activeFilterCount={activeFilterCount}
          onToggleFilters={() => setShowFilters((value) => !value)}
          trailing={
            <PrimaryAction onClick={openLeadPicker} icon={<FiPlus size={16} />}>
              Add New Opportunity
            </PrimaryAction>
          }
        >
          <div className="flex h-11 shrink-0 items-center rounded-lg border border-slate-200 bg-white p-1 dark:border-[#17304a] dark:bg-[#071929]">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold ${
                viewMode === "list"
                  ? "bg-slate-100 text-slate-900 shadow-sm dark:bg-[#10243a] dark:text-white"
                  : "text-slate-500"
              }`}
            >
              <FiList size={14} />
              List
            </button>

            <button
              type="button"
              onClick={() => setViewMode("board")}
              className={`flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold ${
                viewMode === "board"
                  ? "bg-slate-100 text-slate-900 shadow-sm dark:bg-[#10243a] dark:text-white"
                  : "text-slate-500"
              }`}
            >
              <FiGrid size={14} />
              Board
            </button>
          </div>
        </ListToolbar>

          {/* =====================================================
              FILTER POPOVER
          ===================================================== */}
          {showFilters && (
            <OpportunityFilterPopover
              filters={filters}
              setFilters={setFilters}
              salesUsers={salesUsers}
              onApply={applyFilters}
              onClear={clearFilters}
            />
          )}
        </div>

        {/* =========================================================
            CONTENT
        ========================================================= */}
        {loading ? (
          <LoadingState />
        ) : viewMode === "board" ? (
          <BoardView
            opportunities={filtered}
            onDetails={openDetails}
            openActionMenu={openActionMenu}
            setOpenActionMenu={setOpenActionMenu}
            onEdit={(opp) => {
              setEditingOpportunity(opp);
              setOpenActionMenu(null);
            }}
            onMarkDead={handleMarkDead}
            onAdvance={handleAdvanceStage}
          />
        ) : (
          <ListView
            opportunities={paginated}
            filteredCount={filtered.length}
            page={page}
            pageSize={PAGE_SIZE}
            totalPages={totalPages}
            onPageChange={setPage}
            onDetails={openDetails}
            openActionMenu={openActionMenu}
            setOpenActionMenu={setOpenActionMenu}
            onEdit={(opp) => {
              setEditingOpportunity(opp);
              setOpenActionMenu(null);
            }}
            onMarkDead={handleMarkDead}
            onAdvance={handleAdvanceStage}
          />
        )}

        {/* =========================================================
            SELECT LEAD TO CONVERT
        ========================================================= */}
        {showLeadPicker && (
          <LeadPickerModal
            leads={convertibleLeads}
            loading={loadingLeads}
            onClose={() => setShowLeadPicker(false)}
            onSelect={startFromLead}
          />
        )}

        {/* =========================================================
            EDIT OPPORTUNITY
        ========================================================= */}
        {editingOpportunity && (
          <EditOpportunityModal
            opportunity={editingOpportunity}
            salesUsers={salesUsers}
            onClose={() => setEditingOpportunity(null)}
            onSubmit={handleSaveEdit}
          />
        )}

        {/* =========================================================
            LEAD DETAILS DRAWER
        ========================================================= */}
        {showDetails && selectedOpportunity && (
          <LeadDetailsDrawer
            opportunity={selectedOpportunity}
            onClose={() => setShowDetails(false)}
            onEdit={() => {
              setShowDetails(false);
              setEditingOpportunity(selectedOpportunity);
            }}
            onMarkDead={() => {
              setShowDetails(false);
              handleMarkDead(selectedOpportunity);
            }}
            onAdvance={() => handleAdvanceStage(selectedOpportunity)}
          />
        )}
    </div>
  );
}

/* ================================================================
   KPI CARD
================================================================ */

/* ================================================================
   FILTER POPOVER
================================================================ */

function OpportunityFilterPopover({
  filters,
  setFilters,
  salesUsers,
  onApply,
  onClear,
}: {
  filters: OpportunityFilters;
  setFilters: React.Dispatch<React.SetStateAction<OpportunityFilters>>;
  salesUsers: SalesUser[];
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <div className="absolute right-0 top-14 z-[90] w-[455px] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#17304a] dark:bg-[#071929]">
      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">Date Range</span>

        <button
          type="button"
          onClick={onClear}
          className="text-[10px] font-medium text-rose-400 hover:text-rose-500"
        >
          × Clear Filter
        </button>
      </div>

      {/* Date Range */}
      <div className="mb-5 flex items-center gap-2">
        <div className="relative flex-1">
          <FiCalendar
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            size={15}
          />

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                dateFrom: event.target.value,
              }))
            }
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-2 text-xs outline-none dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
          />
        </div>

        <span className="text-slate-400">-</span>

        <div className="relative flex-1">
          <FiCalendar
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            size={15}
          />

          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                dateTo: event.target.value,
              }))
            }
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-2 text-xs outline-none dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Customer Type */}
        <FilterSelect
          label="Customer Type *"
          value={filters.customerType}
          placeholder="Select the customer type"
          options={CUSTOMER_TYPES}
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              customerType: value,
            }))
          }
        />

        {/* Assigned To */}
        <FilterSelect
          label="Assigned to"
          value={filters.assignedTo}
          placeholder="Select"
          options={salesUsers.map((user) => user.id)}
          displayOptions={salesUsers.map((user) => ({
            value: user.id,
            label: user.name,
          }))}
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              assignedTo: value,
            }))
          }
        />

        {/* Status */}
        <FilterSelect
          label="Status"
          value={filters.status}
          placeholder="Select Status"
          options={STATUS_OPTIONS}
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              status: value,
            }))
          }
        />

        {/* State */}
        <FilterSelect
          label="State"
          value={filters.state}
          placeholder="Select"
          options={STATES}
          onChange={(value) =>
            setFilters((current) => ({
              ...current,
              state: value,
            }))
          }
        />
      </div>

      <div className="mt-5 flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={onApply}
          className="rounded-lg bg-[#233353] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#18243a]"
        >
          Apply Filter
        </button>

        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-slate-600 dark:text-slate-300"
        >
          Clear All Filter
        </button>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  displayOptions,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  displayOptions?: {
    value: string;
    label: string;
  }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-medium text-slate-500">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
      >
        <option value="">{placeholder}</option>

        {displayOptions
          ? displayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          : options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
      </select>
    </div>
  );
}

/* ================================================================
   BOARD VIEW
================================================================ */

function BoardView({
  opportunities,
  onDetails,
  openActionMenu,
  setOpenActionMenu,
  onEdit,
  onMarkDead,
  onAdvance,
}: {
  opportunities: Opportunity[];
  onDetails: (opportunity: Opportunity) => void;
  openActionMenu: string | null;
  setOpenActionMenu: (id: string | null) => void;
  onEdit: (opportunity: Opportunity) => void;
  onMarkDead: (opportunity: Opportunity) => void;
  onAdvance: (opportunity: Opportunity) => void;
}) {
  return (
    <div className="overflow-x-auto pb-5">
      <div className="grid min-w-[1080px] grid-cols-4 gap-4">
        {BOARD_STAGES.map((stage) => {
          const stageDeals = opportunities.filter((opp) => opp.stage === stage);

          const totalValue = stageDeals.reduce(
            (sum, deal) => sum + deal.dealValue,
            0,
          );

          return (
            <div
              key={stage}
              className="min-h-[530px] rounded-xl border border-slate-200 bg-white p-3 dark:border-[#17304a] dark:bg-[#071929]"
            >
              {/* Column Header */}
              <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#17304a]">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{stage}</span>

                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-500 dark:bg-blue-500/10">
                    {stageDeals.length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-slate-400">
                    {formatShortCurrency(totalValue)}
                  </span>

                  <button type="button" className="text-slate-500">
                    <FiMoreVertical size={15} />
                  </button>
                </div>
              </div>

              {/* Cards */}
              <div className="space-y-2.5">
                {stageDeals.map((opp) => (
                  <OpportunityBoardCard
                    key={opp.id}
                    opportunity={opp}
                    onDetails={onDetails}
                    openActionMenu={openActionMenu}
                    setOpenActionMenu={setOpenActionMenu}
                    onEdit={onEdit}
                    onMarkDead={onMarkDead}
                    onAdvance={onAdvance}
                  />
                ))}

                {!stageDeals.length && (
                  <div className="flex min-h-[130px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-[10px] italic text-slate-400 dark:border-[#17304a]">
                    No opportunities
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   BOARD CARD
================================================================ */

function OpportunityBoardCard({
  opportunity,
  onDetails,
  openActionMenu,
  setOpenActionMenu,
  onEdit,
  onMarkDead,
  onAdvance,
}: {
  opportunity: Opportunity;
  onDetails: (opportunity: Opportunity) => void;
  openActionMenu: string | null;
  setOpenActionMenu: (id: string | null) => void;
  onEdit: (opportunity: Opportunity) => void;
  onMarkDead: (opportunity: Opportunity) => void;
  onAdvance: (opportunity: Opportunity) => void;
}) {
  const progress = STAGE_PROGRESS[opportunity.stage];

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-[#17304a] dark:bg-[#0b1d2e]">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onDetails(opportunity)}
          className="min-w-0 text-left"
        >
          <p className="truncate text-[12px] font-bold text-slate-900 dark:text-white">
            {opportunity.customerName}
          </p>

          <p className="truncate text-[9px] font-medium text-slate-500">
            {opportunity.company}
          </p>
        </button>

        <ActionMenu
          opportunity={opportunity}
          open={openActionMenu === opportunity.id}
          onToggle={() =>
            setOpenActionMenu(
              openActionMenu === opportunity.id ? null : opportunity.id,
            )
          }
          onEdit={() => onEdit(opportunity)}
          onMarkDead={() => onMarkDead(opportunity)}
          onAdvance={() => onAdvance(opportunity)}
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500">
          {formatShortCurrency(opportunity.dealValue)}
        </span>

        <PriorityBadge priority={opportunity.priority} />
      </div>

      <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-[#e27c26]"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5 dark:border-[#17304a]">
        <div className="flex items-center gap-1.5">
          <Avatar name={opportunity.owner} />

          <span className="max-w-[95px] truncate text-[9px] font-medium text-slate-500">
            {opportunity.owner}
          </span>
        </div>

        <span className="text-[9px] text-slate-400">
          {formatDate(opportunity.expectedClosingDate || opportunity.createdAt)}
        </span>
      </div>
    </div>
  );
}

/* ================================================================
   LIST VIEW
================================================================ */

function ListView({
  opportunities,
  filteredCount,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onDetails,
  openActionMenu,
  setOpenActionMenu,
  onEdit,
  onMarkDead,
  onAdvance,
}: {
  opportunities: Opportunity[];
  filteredCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDetails: (opportunity: Opportunity) => void;
  openActionMenu: string | null;
  setOpenActionMenu: (id: string | null) => void;
  onEdit: (opportunity: Opportunity) => void;
  onMarkDead: (opportunity: Opportunity) => void;
  onAdvance: (opportunity: Opportunity) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#17304a] dark:bg-[#071929]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-white dark:border-[#17304a] dark:bg-[#071929]">
              <th className="w-10 px-3 py-3">
                <input type="checkbox" className="h-3.5 w-3.5 rounded" />
              </th>

              <TableHeader>Lead ID</TableHeader>

              <TableHeader>Customer Name</TableHeader>

              <TableHeader>Company</TableHeader>

              <TableHeader>Deal Value</TableHeader>

              <TableHeader>Assigned To</TableHeader>

              <TableHeader>Status</TableHeader>

              <TableHeader>Priority</TableHeader>

              <TableHeader align="right">Actions</TableHeader>
            </tr>
          </thead>

          <tbody>
            {opportunities.map((opp) => (
              <tr
                key={opp.id}
                className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-[#17304a]/70 dark:hover:bg-[#0b2034]"
              >
                <td className="px-3 py-3.5">
                  <input type="checkbox" className="h-3.5 w-3.5 rounded" />
                </td>

                <td className="px-3 py-3.5">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    #{opp.leadId}
                  </span>
                </td>

                <td className="px-3 py-3.5">
                  <button
                    type="button"
                    onClick={() => onDetails(opp)}
                    className="text-left"
                  >
                    <p className="text-[12px] font-bold text-slate-900 hover:text-[#233353] dark:text-white">
                      {opp.customerName}
                    </p>

                    <p className="mt-0.5 text-[9px] text-slate-500">
                      {opp.email}
                    </p>

                    {opp.city && (
                      <p className="mt-0.5 flex items-center gap-1 text-[8px] text-slate-500">
                        <FiMapPin size={8} />
                        {opp.city}
                      </p>
                    )}
                  </button>
                </td>

                <td className="px-3 py-3.5">
                  <span className="block max-w-[130px] text-[11px] font-medium text-slate-700 dark:text-slate-300">
                    {opp.company}
                  </span>
                </td>

                <td className="px-3 py-3.5">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-white">
                    {formatShortCurrency(opp.dealValue)}
                  </span>
                </td>

                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-2">
                    <Avatar name={opp.owner} />

                    <span className="max-w-[80px] truncate text-[10px] font-medium text-slate-600 dark:text-slate-300">
                      {opp.owner}
                    </span>
                  </div>
                </td>

                <td className="px-3 py-3.5">
                  <StatusBadge status={opp.stage} />
                </td>

                <td className="px-3 py-3.5">
                  <PriorityBadge priority={opp.priority} />
                </td>

                <td className="px-3 py-3.5">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      type="button"
                      title="Call"
                      onClick={() => onDetails(opp)}
                      className="text-slate-600 transition hover:text-[#233353] dark:text-slate-300"
                    >
                      <FiPhone size={14} />
                    </button>

                    <ActionMenu
                      opportunity={opp}
                      open={openActionMenu === opp.id}
                      onToggle={() =>
                        setOpenActionMenu(
                          openActionMenu === opp.id ? null : opp.id,
                        )
                      }
                      onEdit={() => onEdit(opp)}
                      onMarkDead={() => onMarkDead(opp)}
                      onAdvance={() => onAdvance(opp)}
                    />
                  </div>
                </td>
              </tr>
            ))}

            {opportunities.length === 0 && (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FiAlertCircle size={24} />

                    <p className="text-xs font-medium">
                      No opportunities found.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        pageSize={pageSize}
        totalItems={filteredCount}
        totalPages={totalPages}
        onPageChange={onPageChange}
        noun="opportunities"
      />
    </div>
  );
}

function TableHeader({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-3 py-3 text-[10px] font-semibold text-slate-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

/* ================================================================
   ACTION MENU
================================================================ */

function ActionMenu({
  opportunity,
  open,
  onToggle,
  onEdit,
  onMarkDead,
  onAdvance,
}: {
  opportunity: Opportunity;
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onMarkDead: () => void;
  onAdvance: () => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200 dark:hover:bg-[#17304a]"
      >
        <FiMoreVertical size={15} />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-[70] w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-[#17304a] dark:bg-[#071929]">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-medium hover:bg-slate-50 dark:hover:bg-[#0b2034]"
          >
            <FiEdit2 size={12} />
            Edit
          </button>

          {(() => {
            const next = nextStatusOf(STAGE_TO_STATUS[opportunity.stage]);

            if (!next) return null;

            return (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onAdvance();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-medium hover:bg-slate-50 dark:hover:bg-[#0b2034]"
              >
                <FiCheckCircle size={12} />
                Move to {statusToStage(next)}
              </button>
            );
          })()}

          {opportunity.stage !== "Dead" && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onMarkDead();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
            >
              <FiX size={12} />
              Mark as Dead
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   LEAD DETAILS DRAWER
================================================================ */

function LeadDetailsDrawer({
  opportunity,
  onClose,
  onEdit,
  onMarkDead,
  onAdvance,
}: {
  opportunity: Opportunity;
  onClose: () => void;
  onEdit: () => void;
  onMarkDead: () => void;
  onAdvance: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const activities = opportunity.activityHistory?.length
    ? opportunity.activityHistory
    : [
        {
          id: "demo",
          type: "Demo Scheduled" as const,
          title: "Demo Scheduled",
          description:
            "Requested a live demo for the selected display solution.",
          date:
            opportunity.expectedClosingDate ||
            formatDate(opportunity.createdAt),
          time: "10:00 AM",
        },
        {
          id: "call",
          type: "Outgoing Call" as const,
          title: "Outgoing Call",
          description: "Discussed technical specifications and requirements.",
          date: "Yesterday",
        },
        {
          id: "form",
          type: "Form Submission" as const,
          title: "Form Submission",
          description: 'Lead entered through "Synergy" landing page.',
          date: formatDate(opportunity.createdAt),
        },
      ];

  return (
    <div className="fixed inset-0 z-[200]">
      <div
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[570px] flex-col bg-white shadow-2xl dark:bg-[#071929]">
        {/* Drawer Header */}
        <div className="border-b border-slate-200 dark:border-[#17304a]">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-slate-600 dark:text-slate-300"
              >
                <FiX size={18} />
              </button>

              <h2 className="text-[16px] font-semibold">Lead Details</h2>
            </div>

            <button
              type="button"
              className="rounded-lg bg-[#233353] px-4 py-2 text-[11px] font-semibold text-white"
            >
              Create Sales Order
            </button>
          </div>

          {/* Pipeline Progress - reflects the opportunity's real status */}
          <div className="grid grid-cols-6 border-t border-slate-200 dark:border-[#17304a]">
            {(() => {
              const isLost = opportunity.stage === "Dead";

              const currentIndex = DRAWER_PIPELINE.findIndex(
                (step) => step.stage === opportunity.stage,
              );

              return DRAWER_PIPELINE.map((step, index) => {
                const done = !isLost && currentIndex > -1 && index < currentIndex;
                const current = !isLost && index === currentIndex;

                /* The final cell doubles as the outcome: Closed Won
                   normally, Dead when the opportunity was lost. */
                const isOutcomeCell = index === DRAWER_PIPELINE.length - 1;
                const label = isOutcomeCell && isLost ? "Dead" : step.label;

                return (
                  <div
                    key={step.stage}
                    title={label}
                    className={`flex h-8 items-center justify-center gap-1 px-1 text-center text-[9px] ${
                      isOutcomeCell && isLost
                        ? "bg-rose-50 text-rose-600 dark:bg-rose-950/20"
                        : current
                          ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20"
                          : done
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20"
                            : "bg-slate-50 text-slate-400 dark:bg-[#051422]"
                    }`}
                  >
                    {done ? (
                      <FiCheckCircle size={11} className="shrink-0" />
                    ) : current || (isOutcomeCell && isLost) ? (
                      <FiClock size={11} className="shrink-0" />
                    ) : (
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-400" />
                    )}

                    <span className="truncate">{label}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Customer */}
        <div className="flex items-start justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600 dark:bg-[#17304a] dark:text-white">
              {getInitials(opportunity.customerName)}
            </div>

            <div>
              <h3 className="text-[18px] font-semibold">
                {opportunity.customerName}
              </h3>

              <p className="text-[11px] text-slate-500">
                {opportunity.designation || "IT Director"} @{" "}
                {opportunity.company}
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                {opportunity.email && (
                  <span className="flex items-center gap-1">
                    <FiMail size={11} />
                    {opportunity.email}
                  </span>
                )}

                {opportunity.phone && (
                  <span className="flex items-center gap-1">
                    <FiPhone size={11} />
                    {opportunity.phone}
                  </span>
                )}
              </div>

              {opportunity.state && (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                  <FiMapPin size={11} />
                  {opportunity.state}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-[#17304a] dark:text-slate-300"
            >
              <FiMessageSquare size={16} />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((value) => !value)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-[#17304a] dark:text-slate-300"
              >
                <FiMoreVertical size={16} />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-10 z-50 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-[#17304a] dark:bg-[#071929]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onEdit();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] hover:bg-slate-50 dark:hover:bg-[#0b2034]"
                  >
                    <FiEdit2 size={12} />
                    Edit
                  </button>

                  {(() => {
                    const next = nextStatusOf(
                      STAGE_TO_STATUS[opportunity.stage],
                    );

                    if (!next) return null;

                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          onAdvance();
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] hover:bg-slate-50 dark:hover:bg-[#0b2034]"
                      >
                        <FiCheckCircle size={12} />
                        Move to {statusToStage(next)}
                      </button>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onMarkDead();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  >
                    <FiX size={12} />
                    Mark as Dead
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Activity */}
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-[12px] font-bold">Activity History</h4>

            <button
              type="button"
              className="text-[10px] font-medium text-slate-500"
            >
              + Log Activity
            </button>
          </div>

          <div className="relative ml-2 border-l border-slate-200 pl-5 dark:border-[#17304a]">
            {activities.map((activity) => (
              <div key={activity.id} className="relative mb-5">
                <span className="absolute -left-[25px] top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#233353] dark:border-[#071929]" />

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#17304a] dark:bg-[#0b1d2e]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h5 className="text-[11px] font-bold">
                        {activity.title}
                      </h5>

                      <p className="mt-1 text-[10px] leading-5 text-slate-500">
                        {activity.description}
                      </p>
                    </div>

                    <span className="whitespace-nowrap text-[9px] text-slate-400">
                      {activity.date}
                      {activity.time ? `, ${activity.time}` : ""}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Opportunity information */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            <InfoBox label="Lead ID" value={opportunity.leadId} />

            <InfoBox
              label="Deal Value"
              value={formatCurrency(opportunity.dealValue)}
            />

            <InfoBox label="Customer Type" value={opportunity.customerType} />

            <InfoBox label="Priority" value={opportunity.priority} />
          </div>
        </div>
      </aside>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-[#17304a]">
      <p className="text-[9px] text-slate-400">{label}</p>

      <p className="mt-1 text-[11px] font-semibold">{value || "-"}</p>
    </div>
  );
}

/* ================================================================
   NEW OPPORTUNITY PAGE
================================================================ */

/* ================================================================
   SELECT LEAD TO CONVERT
================================================================ */

function LeadPickerModal({
  leads,
  loading,
  onClose,
  onSelect,
}: {
  leads: Lead[];
  loading: boolean;
  onClose: () => void;
  onSelect: (lead: Lead | null) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) return leads;

    return leads.filter((lead) =>
      [
        lead.title,
        lead.contact_name,
        lead.organization_name,
        lead.email,
        String(lead.id),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [leads, query]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-[#17304a] dark:bg-[#071929]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-[#17304a]">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900 dark:text-white">
              Select a Lead
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Qualified leads only. Details carry over to the new
              opportunity.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-[#0b2034]"
          >
            <FiX size={16} />
          </button>
        </div>

        <div className="border-b border-slate-200 px-5 py-3 dark:border-[#17304a]">
          <div className="relative">
            <FiSearch
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search leads"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none focus:border-primary dark:border-[#17304a] dark:bg-[#051422] dark:text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <p className="py-10 text-center text-xs text-slate-400">
              Loading leads...
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-400">
              No qualified leads waiting. Mark a lead as Qualified on the
              Leads page first.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((lead) => (
                <button
                  key={String(lead.id)}
                  type="button"
                  onClick={() => onSelect(lead)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left transition hover:border-primary hover:bg-slate-50 dark:border-[#17304a] dark:hover:bg-[#0b2034]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800 dark:text-white">
                      {lead.contact_name || lead.title}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {lead.organization_name || "—"}
                      {lead.email ? ` · ${lead.email}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-[#0b2034] dark:text-slate-300">
                      {lead.status}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      #LD-{lead.id}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 dark:border-[#17304a]">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-[11px] font-semibold text-slate-500 underline hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Continue without a lead
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-300 dark:hover:bg-[#0b2034]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function NewOpportunityPage({
  lead,
  onClose,
  onSubmit,
}: {
  /** When present, the form opens prefilled from this lead and saving it
      converts the lead rather than creating a standalone opportunity. */
  lead?: Lead | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, any>) => Promise<void>;
}) {
  const [customerType, setCustomerType] = useState<CustomerType>(
    normalizeCustomerType(lead?.customer_type_name),
  );

  const [organizationName, setOrganizationName] = useState(
    lead?.organization_name || "",
  );

  const [organizationWebsite, setOrganizationWebsite] = useState(
    lead?.website || "",
  );

  const [officeAddress, setOfficeAddress] = useState(
    lead?.office_address || "",
  );

  const [city, setCity] = useState(lead?.city || "");

  const [state, setState] = useState(lead?.state_name || "");

  const [pinCode, setPinCode] = useState(lead?.zip_code || "");

  const [country, setCountry] = useState(lead?.country || "India");

  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingPinCode, setShippingPinCode] = useState("");
  const [shippingCountry, setShippingCountry] = useState("India");
  const [sameAsBilling, setSameAsBilling] = useState(false);

  const [gstNumber, setGstNumber] = useState(lead?.gst_number || "");

  const [panNumber, setPanNumber] = useState(lead?.pan_number || "");

  const [coiNumber, setCoiNumber] = useState(lead?.coi_number || "");

  const [contactName, setContactName] = useState(lead?.contact_name || "");

  const [designation, setDesignation] = useState(lead?.designation || "");

  const [mobileNumber, setMobileNumber] = useState(lead?.mobile_number || "");

  const [email, setEmail] = useState(lead?.email || "");

  const [priority, setPriority] = useState<Priority>("Medium");

  const [expectedClosingDate, setExpectedClosingDate] = useState("");

  const [remarks, setRemarks] = useState(
    lead?.remarks || lead?.requirements || "",
  );

  const [purchaseTimeline, setPurchaseTimeline] = useState("");

  const [leadSource, setLeadSource] = useState(
    lead?.lead_source_name || "Marketing",
  );

  const [assignedTo, setAssignedTo] = useState("");

  const [attachments, setAttachments] = useState<File[]>([]);

  const [productItems, setProductItems] = useState<ProductItem[]>([
    {
      name: "Interactive Flat Panel",
      qty: 0,
      price: 0,
    },
    {
      name: "LED Video Wall",
      qty: 0,
      price: 0,
    },
    {
      name: "Digital Signage",
      qty: 0,
      price: 0,
    },
    {
      name: "Commercial Display",
      qty: 0,
      price: 0,
    },
    {
      name: "Advertising Display",
      qty: 0,
      price: 0,
    },
    {
      name: "Signage",
      qty: 0,
      price: 0,
    },
  ]);

  const [submitting, setSubmitting] = useState(false);

  const totalQty = productItems.reduce((sum, item) => sum + item.qty, 0);

  const totalValue = productItems.reduce(
    (sum, item) => sum + item.qty * item.price,
    0,
  );

  const updateProductQty = (index: number, delta: number) => {
    setProductItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              qty: Math.max(0, item.qty + delta),
            }
          : item,
      ),
    );
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    setAttachments(files);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (
      !organizationName.trim() ||
      !contactName.trim() ||
      !mobileNumber.trim() ||
      !email.trim()
    ) {
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        leadId: lead?.id,

        shippingAddress: sameAsBilling ? officeAddress : shippingAddress,
        shippingCity: sameAsBilling ? city : shippingCity,
        shippingState: sameAsBilling ? state : shippingState,
        shippingPinCode: sameAsBilling ? pinCode : shippingPinCode,
        shippingCountry: sameAsBilling ? country : shippingCountry,

        customerType,
        organizationName,
        organizationWebsite,
        officeAddress,
        city,
        state,
        pinCode,
        country,
        gstNumber,
        panNumber,
        coiNumber,
        contactName,
        designation,
        mobileNumber,
        email,
        priority,
        expectedClosingDate,
        purchaseTimeline,
        leadSource,
        assignedTo,
        remarks,
        attachments,
        productItems: productItems.filter((item) => item.qty > 0),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full pb-8">
      {/* =========================================================
          PAGE HEADER
      ========================================================= */}

      <FormPageHeader
        title="New Opportunity"
        parentLabel="Opportunity"
        actions={
          <>
            <CancelButton onClick={onClose} />

            <DraftButton disabled={submitting} onClick={onClose} />

            <SubmitButton formId="new-opportunity-form" disabled={submitting}>
              {submitting ? "Creating..." : "Create Opportunity"}
            </SubmitButton>
          </>
        }
      />

      {/* =========================================================
          FORM
      ========================================================= */}

      <form
        id="new-opportunity-form"
        onSubmit={handleSubmit}
        className="flex min-h-[calc(100vh-138px)] flex-col"
      >
        {/* =======================================================
            CONTENT
        ======================================================= */}

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-[minmax(0,1fr)_310px]">
            {/* ===================================================
                LEFT COLUMN
            =================================================== */}

            <FormCard>
              {/* =================================================
                  CUSTOMER INFORMATION
              ================================================= */}

              <FormSectionBlock
                first
                icon={<FiUser size={17} />}
                title="Customer Information"
              >
                <div className="space-y-4">
                  <FormSelect
                    label="Customer Type *"
                    value={customerType}
                    options={CUSTOMER_TYPES}
                    onChange={(value) => setCustomerType(value as CustomerType)}
                  />

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FormInput
                      label="Organization Name *"
                      value={organizationName}
                      onChange={setOrganizationName}
                      placeholder="Acme Solutions Pvt. Ltd."
                    />

                    <FormInput
                      label="Organization Website *"
                      value={organizationWebsite}
                      onChange={setOrganizationWebsite}
                      placeholder="www.acmesolutions.example"
                    />
                  </div>
                </div>
              </FormSectionBlock>

              {/* =================================================
                  ORGANIZATION DETAILS
              ================================================= */}

              <FormSectionBlock
                icon={<FiMapPin size={17} />}
                title="Organization Details"
              >
                <div className="space-y-4">
                  <BillingShippingHeader
                    sameAsBilling={sameAsBilling}
                    onToggle={(value: boolean) => {
                      setSameAsBilling(value);

                      if (value) {
                        setShippingAddress(officeAddress);
                        setShippingCity(city);
                        setShippingState(state);
                        setShippingPinCode(pinCode);
                        setShippingCountry(country);
                      }
                    }}
                  />

                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormInput
                          label="Street Address *"
                          value={officeAddress}
                          onChange={setOfficeAddress}
                          placeholder="Street Address, Building, Suite"
                        />

                        <FormInput
                          label="State / Province *"
                          value={state}
                          onChange={setState}
                          placeholder="State"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <FormInput
                          label="City *"
                          value={city}
                          onChange={setCity}
                          placeholder="Type or select"
                        />

                        <FormInput
                          label="Country *"
                          value={country}
                          onChange={setCountry}
                          placeholder="India"
                        />

                        <FormInput
                          label="PIN / ZIP Code *"
                          value={pinCode}
                          onChange={setPinCode}
                          placeholder="Pin Code"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FormInput
                          label="Street Address *"
                          value={shippingAddress}
                          onChange={setShippingAddress}
                          placeholder="Street Address, Building, Suite"
                        />

                        <FormInput
                          label="State / Province *"
                          value={shippingState}
                          onChange={setShippingState}
                          placeholder="State"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <FormInput
                          label="City *"
                          value={shippingCity}
                          onChange={setShippingCity}
                          placeholder="Type or select"
                        />

                        <FormInput
                          label="Country *"
                          value={shippingCountry}
                          onChange={setShippingCountry}
                          placeholder="India"
                        />

                        <FormInput
                          label="PIN / ZIP Code *"
                          value={shippingPinCode}
                          onChange={setShippingPinCode}
                          placeholder="Pin Code"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </FormSectionBlock>

              {/* =================================================
                  REGISTRATION & COMPLIANCE
              ================================================= */}

              <FormSectionBlock
                icon={<FiCheckCircle size={17} />}
                title="Registration & Compliance"
              >
                <div className="space-y-3">
                  <DocumentInput
                    label="GST Number"
                    value={gstNumber}
                    onChange={setGstNumber}
                    placeholder="Enter GSTIN"
                  />

                  <DocumentInput
                    label="PAN Number"
                    value={panNumber}
                    onChange={setPanNumber}
                    placeholder="Enter PAN"
                  />

                  <DocumentInput
                    label="COI (Certificate of Incorporation)"
                    value={coiNumber}
                    onChange={setCoiNumber}
                    placeholder="COI Number"
                  />
                </div>
              </FormSectionBlock>

              {/* =================================================
                  PRIMARY CONTACT
              ================================================= */}

              <FormSectionBlock icon={<FiUser size={17} />} title="Primary Contact">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FormInput
                    label="Full Name *"
                    value={contactName}
                    onChange={setContactName}
                    placeholder="Arjun Mehta"
                  />

                  <FormInput
                    label="Designation *"
                    value={designation}
                    onChange={setDesignation}
                    placeholder="Procurement Manager"
                  />

                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium text-slate-500">
                      Mobile Number *
                    </label>

                    <div className="grid grid-cols-[74px_1fr] gap-2">
                      <div className="flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-[10px] text-slate-700 dark:border-[#17304a] dark:bg-[#071929] dark:text-white">
                        🇮🇳 +91
                      </div>

                      <input
                        type="tel"
                        value={mobileNumber}
                        onChange={(event) =>
                          setMobileNumber(event.target.value)
                        }
                        placeholder="9876543210"
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[10px] outline-none placeholder:text-slate-400 focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
                      />
                    </div>
                  </div>

                  <FormInput
                    label="Email Address *"
                    value={email}
                    onChange={setEmail}
                    placeholder="arjun.mehta@acmesolutions.example"
                    type="email"
                  />
                </div>
              </FormSectionBlock>
            </FormCard>

            {/* ===================================================
                RIGHT COLUMN
            =================================================== */}

            <FormCard className="h-fit">
              {/* =================================================
                      PRODUCT INTEREST
                  ================================================= */}

              <FormSectionBlock
                icon={<FiUser size={17} />}
                title="Sales Information"
              >
                <div className="space-y-3">
                  <FormSelect
                    label="Lead Source *"
                    value={leadSource}
                    options={["Marketing", "Cold Calling", "In-bound"]}
                    onChange={setLeadSource}
                  />

                  <FormSelect
                    label="Assigned to *"
                    value={assignedTo}
                    options={["Sales Team"]}
                    onChange={setAssignedTo}
                  />

                  {/* Priority */}
                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium text-slate-500">
                      Priority
                    </label>

                    <div className="flex gap-2">
                      {(["High", "Medium", "Low"] as Priority[]).map((item) => {
                        const isSelected = priority === item;

                        return (
                          <button
                            type="button"
                            key={item}
                            onClick={() => setPriority(item)}
                            className={`rounded-md px-3 py-1.5 text-[10px] font-semibold transition ${
                              isSelected
                                ? item === "High"
                                  ? "border border-rose-100 bg-rose-50 text-rose-500 shadow-sm"
                                  : item === "Medium"
                                    ? "border border-amber-100 bg-amber-50 text-amber-600 shadow-sm"
                                    : "border border-slate-200 bg-white text-slate-700 shadow-sm"
                                : "border border-transparent bg-slate-100 text-slate-500 dark:bg-[#10243a] dark:text-slate-400"
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[10px] font-medium text-slate-500">
                      Expected Closing Date
                    </label>

                    <div className="relative">
                      <FiCalendar
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                      />

                      <input
                        type="date"
                        value={expectedClosingDate}
                        onChange={(event) =>
                          setExpectedClosingDate(event.target.value)
                        }
                        className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-[10px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </FormSectionBlock>

              <FormSectionBlock
                icon={<FiShoppingCart size={17} />}
                title="Product Interest"
              >
                <p className="mb-2 text-[10px] text-slate-500">
                  Product Categories
                </p>

                {/* Product Categories */}
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-[#17304a]">
                  {/* 
                    Show 4 products at a time.
                    Additional products can be accessed using
                    the vertical scrollbar.
                  */}
                  <div className="max-h-[168px] overflow-y-auto">
                    {productItems.map((item, index) => (
                      <div
                        key={item.name}
                        className="flex min-h-[42px] items-center justify-between border-b border-slate-100 px-3 py-2.5 last:border-b-0 dark:border-[#17304a]"
                      >
                        {/* Product Name */}
                        <div className="flex min-w-0 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={item.qty > 0}
                            onChange={() =>
                              updateProductQty(
                                index,
                                item.qty > 0 ? -item.qty : 1,
                              )
                            }
                            className="h-3.5 w-3.5 shrink-0 cursor-pointer"
                          />

                          <span className="truncate text-[10px] font-medium text-slate-700 dark:text-slate-200">
                            {item.name}
                          </span>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateProductQty(index, -1)}
                            disabled={item.qty === 0}
                            className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-[12px] text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#17304a] dark:hover:bg-[#0b2034]"
                          >
                            −
                          </button>

                          <span className="flex w-5 items-center justify-center text-[10px] font-medium text-slate-700 dark:text-slate-200">
                            {item.qty}
                          </span>

                          <button
                            type="button"
                            onClick={() => updateProductQty(index, 1)}
                            className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-[12px] text-slate-500 transition hover:bg-slate-50 dark:border-[#17304a] dark:hover:bg-[#0b2034]"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total - stays fixed below scroll area */}
                  <div className="flex h-[32px] items-center justify-between bg-slate-50 px-3 dark:bg-[#0b2034]">
                    <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">
                      Total
                    </span>

                    <span className="text-[11px] font-bold text-slate-700 dark:text-white">
                      {totalQty}
                    </span>
                  </div>
                </div>

                {/* Total Estimated Value */}
                <div className="mt-3">
                  <FormInput
                    label="Total Est. Value *"
                    value={totalValue ? String(totalValue) : ""}
                    onChange={() => {}}
                    placeholder="₹ 0.00"
                    type="number"
                  />
                </div>

                {/* Purchase Timeline */}
                <div className="mt-3">
                  <FormSelect
                    label="Purchase Timeline *"
                    value={purchaseTimeline}
                    options={[
                      "Immediate",
                      "Within 30 Days",
                      "1 - 3 Months",
                      "3 - 6 Months",
                      "6+ Months",
                    ]}
                    onChange={setPurchaseTimeline}
                  />
                </div>
              </FormSectionBlock>

              {/* =================================================
                  SALES INFORMATION
              ================================================= */}


              {/* =================================================
                  REQUIREMENTS & FILES
              ================================================= */}

              <FormSectionBlock
                icon={<FiFileText size={17} />}
                title="Requirements & Files"
              >
                <label className="mb-1.5 block text-[10px] font-medium text-slate-500">
                  Remarks
                </label>

                <textarea
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  rows={5}
                  placeholder="Enter specific hardware requirements or customization requests..."
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-[10px] outline-none placeholder:text-slate-400 focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
                />

                <div className="mt-3">
                  <label className="mb-1.5 block text-[10px] font-medium text-slate-500">
                    Attachments
                  </label>

                  <label className="flex min-h-[105px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 text-center transition hover:bg-slate-50 dark:border-[#31506b] dark:hover:bg-[#0b2034]">
                    <FiUploadCloud size={19} className="text-slate-400" />

                    <p className="mt-1 text-[10px] text-slate-500">
                      {attachments.length
                        ? `${attachments.length} file(s) selected`
                        : "Drop files or click to upload"}
                    </p>

                    <p className="text-[8px] text-slate-400">
                      PDF, DOC, XLS up to 10MB
                    </p>

                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </FormSectionBlock>
            </FormCard>
          </div>
        </div>

        {/* =======================================================
            FOOTER
        ======================================================= */}

      </form>
    </div>
  );
}

/* ================================================================
   EDIT MODAL
================================================================ */

function EditOpportunityModal({
  opportunity,
  salesUsers,
  onClose,
  onSubmit,
}: {
  opportunity: Opportunity;
  salesUsers: SalesUser[];
  onClose: () => void;
  onSubmit: (payload: Partial<Opportunity>) => Promise<void>;
}) {
  const [customerName, setCustomerName] = useState(opportunity.customerName);

  const [company, setCompany] = useState(opportunity.company);

  const [customerType, setCustomerType] = useState(opportunity.customerType);

  const [priority, setPriority] = useState(opportunity.priority);

  const [ownerId, setOwnerId] = useState(opportunity.ownerId || "");

  const [expectedClosingDate, setExpectedClosingDate] = useState(
    opportunity.expectedClosingDate || "",
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    await onSubmit({
      customerName,
      company,
      customerType,
      priority,
      ownerId,
      expectedClosingDate,
      owner:
        salesUsers.find((user) => user.id === ownerId)?.name ||
        opportunity.owner,
    });
  };

  return (
    <div className="fixed inset-0 z-[170] flex items-center justify-center bg-black/30 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-[#071929]"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">Edit Opportunity</h2>

          <button type="button" onClick={onClose} className="text-slate-500">
            <FiX size={17} />
          </button>
        </div>

        <div className="space-y-4">
          <FormInput
            label="Customer Name"
            value={customerName}
            onChange={setCustomerName}
          />

          <FormInput label="Company" value={company} onChange={setCompany} />

          <FormSelect
            label="Customer Type"
            value={customerType}
            options={CUSTOMER_TYPES}
            onChange={(value) => setCustomerType(value as CustomerType)}
          />

          <FormSelect
            label="Assigned To"
            value={ownerId}
            options={salesUsers.map((user) => user.id)}
            displayOptions={salesUsers.map((user) => ({
              value: user.id,
              label: user.name,
            }))}
            onChange={setOwnerId}
          />

          <FormSelect
            label="Priority"
            value={priority}
            options={["High", "Medium", "Low"]}
            onChange={(value) => setPriority(value as Priority)}
          />

          <FormInput
            label="Expected Closing Date"
            type="date"
            value={expectedClosingDate}
            onChange={setExpectedClosingDate}
          />
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-[#17304a]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold dark:border-[#17304a]"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="rounded-lg bg-[#233353] px-5 py-2 text-xs font-bold text-white"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}

/* ================================================================
   FORM COMPONENTS
================================================================ */

function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-medium text-slate-500">
        {label}
      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[10px] outline-none placeholder:text-slate-400 focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
      />
    </div>
  );
}

function FormSelect({
  label,
  value,
  options,
  displayOptions,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  displayOptions?: {
    value: string;
    label: string;
  }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-medium text-slate-500">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[10px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
      >
        <option value="">Select here</option>

        {displayOptions
          ? displayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          : options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
      </select>
    </div>
  );
}

function DocumentInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_145px] items-end gap-3">
      <FormInput
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
      />

      <button
        type="button"
        className="mb-0 flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 text-[10px] font-medium text-slate-400 dark:border-[#31506b]"
      >
        <FiUploadCloud size={14} />
        Upload Doc
      </button>
    </div>
  );
}

/* ================================================================
   BADGES / AVATAR
================================================================ */

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[8px] font-bold text-slate-600 dark:bg-[#17304a] dark:text-slate-200">
      {getInitials(name)}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return <PriorityPill priority={priority} />;
}

function StatusBadge({ status }: { status: OpportunityStage }) {
  /* The board/list work in display labels; map back to the canonical
     status so the shared pill picks the right colour. */
  return <StatusPill status={STAGE_TO_STATUS[status]} label={status} />;
}

/* ================================================================
   LOADING
================================================================ */

function LoadingState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-[#17304a] dark:bg-[#071929]">
      <div className="flex flex-col items-center gap-3">
        <FiRefreshCw
          className="animate-spin text-[#233353] dark:text-sky-400"
          size={25}
        />

        <span className="text-xs font-medium text-slate-400">
          Loading opportunities...
        </span>
      </div>
    </div>
  );
}

export default function OpportunitiesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <OpportunitiesPageInner />
    </Suspense>
  );
}
