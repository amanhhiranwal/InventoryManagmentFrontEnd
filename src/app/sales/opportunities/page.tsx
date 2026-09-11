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

import { parseAmount } from "@/components/crm/AmountInput";
import {
  PRODUCT_CATALOG,
  PRODUCT_CATEGORIES,
  productSku,
  type CatalogProduct,
} from "@/features/catalog/productCatalog";
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
  Th,
  ListToolbar,
  PrimaryAction,
} from "@/components/crm/ListPageShell";
import {
  OPPORTUNITY_STATUS,
  OPPORTUNITY_STATUS_LABEL,
  OPPORTUNITY_TRANSITIONS,
  OpportunityStatus as CanonicalOpportunityStatus,
  canTransitionOpportunity,
  createOpportunityApi,
  getOpportunitiesApi,
  getOpportunityActivitiesApi,
  getOpportunityApi,
  logOpportunityActivityApi,
  updateOpportunityApi,
  updateOpportunityStatusApi,
  LogOpportunityActivityPayload,
  OpportunityActivity,
} from "@/features/opportunities/api/opportunities.api";
import {
  FiPlus,
  FiMinus,
  FiInfo,
  FiTrash2,
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
  FiChevronDown,
  FiAlertCircle,
} from "react-icons/fi";

interface ProductItem {
  name: string;
  qty: number;
  price: number;
}

/** Inline editors inside the Products & Order Items table. */
/* Fixed widths, not w-full: a stretching input widens its column and makes
   the whole table jump between view and edit mode. */
const LINE_CELL_BASE =
  "h-8 rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-800 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white";

const LINE_CELL_MODEL = `${LINE_CELL_BASE} w-[112px]`;
const LINE_CELL_SMALL = `${LINE_CELL_BASE} w-[46px] text-center`;

const LINE_STEPPER =
  "flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-[#17304a] dark:hover:bg-[#0d2336]";

/** Buying windows offered on the New Opportunity form. */
const PURCHASE_TIMELINES = ["Immediate (0-15 days)", "30 Days", "6 Months"];

/** A priced line on the opportunity, chosen through Add Product. */
interface OpportunityLineItem {
  key: string;
  productId: string;
  product: string;
  model: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
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
  /** The opportunity's own title, distinct from the customer or company. */
  name: string;
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
  opportunityName?: string;
  lineItems?: OpportunityLineItem[];
  /** Requirements & Files uploads, recorded by name/size/type on save. */
  attachments?: File[];

  /** The API record this was mapped from, kept so Edit can reopen the full
      New Opportunity form with every field - shipping address, product
      lines, lead source - rather than only the handful mapped above. */
  raw?: Record<string, any>;
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

/** Full rupee figure, as the Total Amount row shows in the design. */
function formatRupees(value: number) {
  return `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
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

/* Timestamp shown on an activity card. Recent entries read better relative -
   "Today, 2:15 PM" - because the timeline is mostly consulted for what just
   happened; anything older falls back to a plain date. */
function formatActivityStamp(value?: string) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  const time = date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const startOfDay = (input: Date) =>
    new Date(input.getFullYear(), input.getMonth(), input.getDate()).getTime();

  const dayDiff = Math.round(
    (startOfDay(new Date()) - startOfDay(date)) / 86400000,
  );

  if (dayDiff === 0) return `Today, ${time}`;

  if (dayDiff === 1) return "Yesterday";

  return formatDate(value);
}

/* Full date and time for the footer line of an activity card. */
function formatActivityDateTime(value?: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return `${formatDate(value)} at ${date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
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

    /* The opportunity's title was never carried through, so the list had
       nothing to show but the customer and company. */
    name: lead.title || lead.opportunity_name || company,

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

    raw: lead,
  };
}

function OpportunitiesPageInner() {
  const { addToast } = useUIStore();

  const searchParams = useSearchParams();

  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);

  /* Lead sources come from Masters so the source recorded on a lead can
     always be shown here; the form previously offered three fixed values. */
  const [leadSourceOptions, setLeadSourceOptions] = useState<string[]>([]);

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

  /* Activity History for the opportunity the drawer is showing. Held here so
     a stage change made from the row or board menu can refresh it without
     the drawer having to watch for it. */
  const [activities, setActivities] = useState<OpportunityActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [loggingActivity, setLoggingActivity] = useState(false);

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
            /* The users endpoint returns first_name/last_name; without
               these every option read "Sales User". */
            name:
              `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
              user.name ||
              user.full_name ||
              user.email ||
              "Sales User",
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

  const fetchLeadSources = async () => {
    try {
      const res = await api.get("/api/v1/lead-sources");

      if (res.data?.success) {
        setLeadSourceOptions(
          (res.data.data || [])
            .filter((source: any) => source.is_active !== false)
            .map((source: any) => source.name),
        );
      }
    } catch (error) {
      console.warn("Lead sources endpoint unavailable.", error);
    }
  };

  useEffect(() => {
    fetchOpportunities();
    fetchSalesUsers();
    fetchLeadSources();
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
   * KPI cards: Total Opportunities, Pipeline Value, Win Rate and
   * Closing This Month. All four are derived from the loaded
   * opportunities rather than being fixed numbers.
   */
  const totalOpportunities = opps.length;

  /* Pipeline value is what is still in play, so closed deals - won or
     dead - are excluded rather than inflating the figure. */
  const pipelineValue = opps
    .filter((opp) => opp.stage !== "Closed Won" && opp.stage !== "Dead")
    .reduce((sum, opp) => sum + (opp.dealValue || 0), 0);

  const wonCount = opps.filter((opp) => opp.stage === "Closed Won").length;
  const lostCount = opps.filter((opp) => opp.stage === "Dead").length;

  /* Win rate is measured against decided deals only; counting the open
     pipeline in the denominator would drag it towards zero. */
  const decidedCount = wonCount + lostCount;

  const winRate = decidedCount ? (wonCount / decidedCount) * 100 : 0;

  const closingThisMonth = opps.filter((opp) => {
    if (!opp.expectedClosingDate) return false;

    const date = new Date(opp.expectedClosingDate);

    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();

    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
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

        title:
          payload.opportunityName ||
          payload.contactName ||
          payload.organizationName,
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

        /* These three were gathered by the form and then dropped: the
           payload carried them but the request never did. */
        lead_source: payload.leadSource,
        purchase_timeline: payload.purchaseTimeline,

        /* Assigned to was a single hardcoded option and was never sent, so
           every opportunity was created unassigned. */
        assigned_to_id: payload.ownerId || undefined,
        attachments: (payload.attachments || []).map((file: File) => ({
          name: file.name,
          size: file.size,
          type: file.type,
        })),

        product_items: (payload.lineItems || []).map(
          (item: OpportunityLineItem) => ({
            product: item.product,
            model: item.model,
            sku: item.sku,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            discount: item.discount,
            tax: item.tax,
          }),
        ),
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
        value: opps.filter((x) => x.stage === "Negotiation").length,
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

  const loadActivities = useCallback(
    async (opportunityId: string) => {
      try {
        setActivitiesLoading(true);

        const data = await getOpportunityActivitiesApi(opportunityId);

        setActivities(data || []);
      } catch (error) {
        console.error(error);

        setActivities([]);

        addToast("Failed to load the activity history.", "error");
      } finally {
        setActivitiesLoading(false);
      }
    },
    [addToast],
  );

  const openDetails = async (opp: Opportunity) => {
    setSelectedOpportunity(opp);
    setShowDetails(true);
    setOpenActionMenu(null);

    setActivities([]);
    loadActivities(opp.id);

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

  /* The Log Activity form posts the note and the stage move together, so a
     stage change always carries the reason it happened. Returns whether it
     succeeded, so the form knows whether to clear itself. */
  const handleLogActivity = async (
    opp: Opportunity,
    payload: LogOpportunityActivityPayload,
  ) => {
    setLoggingActivity(true);

    try {
      const result = await logOpportunityActivityApi(opp.id, payload);

      const updated = mapLeadToOpportunity(result.opportunity);

      setOpps((current) =>
        current.map((item) => (item.id === opp.id ? updated : item)),
      );

      setSelectedOpportunity((currentSelected) =>
        currentSelected && currentSelected.id === opp.id
          ? updated
          : currentSelected,
      );

      addToast(
        payload.status
          ? `${opp.customerName} moved to ${updated.stage}.`
          : `Activity logged against ${opp.customerName}.`,
        "success",
      );

      await loadActivities(opp.id);

      return true;
    } catch (error: any) {
      console.error(error);

      addToast(
        error?.response?.data?.detail || "Failed to log the activity.",
        "error",
      );

      return false;
    } finally {
      setLoggingActivity(false);
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

      /* The move is now part of the opportunity's history, so an open drawer
         has to pick it up rather than keep showing the timeline as it was. */
      if (selectedOpportunity && selectedOpportunity.id === opp.id) {
        await loadActivities(opp.id);
      }

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

      if (selectedOpportunity && selectedOpportunity.id === opp.id) {
        await loadActivities(opp.id);
      }

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

  /* Takes the same payload the create form produces, so editing saves every
     field the page collects rather than the four the old modal carried. */
  const handleSaveEdit = async (payload: Record<string, any>) => {
    if (!editingOpportunity) {
      return;
    }

    try {
      const updated = await updateOpportunityApi(editingOpportunity.id, {
        title:
          payload.opportunityName ||
          payload.contactName ||
          payload.organizationName,
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

        lead_source: payload.leadSource,
        purchase_timeline: payload.purchaseTimeline,

        assigned_to_id: payload.ownerId || undefined,

        product_items: (payload.lineItems || []).map(
          (item: OpportunityLineItem) => ({
            product: item.product,
            model: item.model,
            sku: item.sku,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            discount: item.discount,
            tax: item.tax,
          }),
        ),
      });

      if (updated) {
        const mapped = mapLeadToOpportunity(updated);

        setOpps((current) =>
          current.map((item) =>
            item.id === editingOpportunity.id ? mapped : item,
          ),
        );

        setSelectedOpportunity((currentSelected) =>
          currentSelected && currentSelected.id === editingOpportunity.id
            ? mapped
            : currentSelected,
        );

        setEditingOpportunity(null);

        addToast("Opportunity updated.", "success");
      }
    } catch (error: any) {
      console.error(error);

      addToast(
        error?.response?.data?.detail || "Failed to update opportunity.",
        "error",
      );
    }
  };

  /* Edit opens the same full page as New, prefilled, rather than the old
     four-field modal - which could not reach the address, compliance,
     sourcing or product lines that the form collects. */
  if (showAddModal || editingOpportunity) {
    return (
      <NewOpportunityPage
        lead={sourceLead}
        opportunity={editingOpportunity}
        salesUsers={salesUsers}
        leadSourceOptions={leadSourceOptions}
        onClose={() => {
          setShowAddModal(false);
          setSourceLead(null);
          setEditingOpportunity(null);
        }}
        onSubmit={
          editingOpportunity ? handleSaveEdit : handleCreateOpportunity
        }
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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total Opportunities"
            value={totalOpportunities}
            change="18.0%"
            positive
          />

          <StatCard
            label="Pipeline Value"
            value={formatShortCurrency(pipelineValue)}
            change="12%"
            positive={false}
          />

          <StatCard
            label="Win Rate"
            value={`${winRate.toFixed(1)}%`}
            change="15.0%"
            positive
          />

          <StatCard
            label="Closing This Month"
            value={closingThisMonth}
            caption=""
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

        {/* Editing is handled by the full New Opportunity page above, which
            returns early when editingOpportunity is set. */}

        {/* =========================================================
            LEAD DETAILS DRAWER
        ========================================================= */}
        {showDetails && selectedOpportunity && (
          <LeadDetailsDrawer
            opportunity={selectedOpportunity}
            activities={activities}
            activitiesLoading={activitiesLoading}
            saving={loggingActivity}
            onClose={() => setShowDetails(false)}
            onEdit={() => {
              setShowDetails(false);
              setEditingOpportunity(selectedOpportunity);
            }}
            onMarkDead={() => {
              setShowDetails(false);
              handleMarkDead(selectedOpportunity);
            }}
            onLogActivity={(payload) =>
              handleLogActivity(selectedOpportunity, payload)
            }
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
  /* Grab-and-pan the board sideways, the way a Kanban board behaves. */
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const dragState = useRef({ startX: 0, startScroll: 0, moved: false });

  useEffect(() => {
    if (!dragging) return;

    /* Listen on the document so the pan keeps working when the pointer
       leaves the board, and still ends wherever the button is released. */
    function handleMove(event: MouseEvent) {
      const element = scrollRef.current;

      if (!element) return;

      const distance = event.pageX - dragState.current.startX;

      if (Math.abs(distance) > 4) dragState.current.moved = true;

      element.scrollLeft = dragState.current.startScroll - distance;
    }

    function handleUp() {
      setDragging(false);
    }

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);

    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [dragging]);

  return (
    /* A flex row rather than a fixed grid: grid-cols-4 held five stages,
       so Negotiation wrapped onto a second row instead of scrolling. */
    <div
      ref={scrollRef}
      onMouseDown={(event) => {
        /* Left button only. Cards are themselves buttons, so panning has
           to be allowed to start on one; a drag that actually moved is
           stopped from becoming a click in onClickCapture below. Real form
           controls are excluded so typing and selection still work. */
        if (event.button !== 0) return;

        if ((event.target as HTMLElement).closest("input, select, textarea")) {
          return;
        }

        const element = scrollRef.current;

        if (!element) return;

        dragState.current = {
          startX: event.pageX,
          startScroll: element.scrollLeft,
          moved: false,
        };

        setDragging(true);
      }}
      /* A pan that moved should not also register as a click on whatever
         happened to be under the pointer. */
      onClickCapture={(event) => {
        if (dragState.current.moved) {
          event.preventDefault();
          event.stopPropagation();
          dragState.current.moved = false;
        }
      }}
      /* scrollbar-none: the board is panned by dragging, so the bar itself
         is just a line across the page. Scrolling still works. */
      className={`scrollbar-none overflow-x-auto pb-2 ${
        dragging ? "cursor-grabbing select-none" : "cursor-grab"
      }`}
    >
      <div className="flex gap-4">
        {BOARD_STAGES.map((stage) => {
          const stageDeals = opportunities.filter((opp) => opp.stage === stage);

          const totalValue = stageDeals.reduce(
            (sum, deal) => sum + deal.dealValue,
            0,
          );

          return (
            <div
              key={stage}
              /* Viewport-relative so the board's horizontal scrollbar
                 always sits above the fold, whatever the screen height. */
              className="flex h-[calc(100vh-380px)] max-h-[720px] min-h-[380px] w-[290px] shrink-0 flex-col rounded-xl border border-slate-200 bg-white p-3 dark:border-[#17304a] dark:bg-[#071929]"
            >
              {/* Column Header */}
              <div className="mb-3 flex shrink-0 items-center justify-between border-b border-slate-100 pb-3 dark:border-[#17304a]">
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

              {/* Cards scroll within the column: the board keeps a fixed
                  height so its horizontal scrollbar is always in reach. */}
              <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
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
  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md dark:border-[#17304a] dark:bg-[#0b1d2e]">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onDetails(opportunity)}
          className="min-w-0 text-left"
        >
          <p className="truncate text-[12px] font-bold text-slate-900 dark:text-white">
            {opportunity.name}
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

      {/* Value and closing date share a line, as in the design. */}
      <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
        <span className="font-semibold text-slate-600 dark:text-slate-300">
          {formatShortCurrency(opportunity.dealValue)}
        </span>

        <span className="text-slate-300">·</span>

        <span className="flex items-center gap-1">
          <FiCalendar size={9} />
          {formatDate(
            opportunity.expectedClosingDate || opportunity.createdAt,
          )}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5 dark:border-[#17304a]">
        <div className="flex items-center gap-1.5">
          <Avatar name={opportunity.owner} />

          <span className="max-w-[95px] truncate text-[9px] font-medium text-slate-500">
            {opportunity.owner}
          </span>
        </div>

        <PriorityBadge priority={opportunity.priority} />
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

              <TableHeader>Opportunity Name</TableHeader>

              <TableHeader>Customer Name</TableHeader>

              <TableHeader>Est. Deal Value</TableHeader>

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
                /* The whole row opens the opportunity, not just the two name
                   cells: that is where the cursor already is. The checkbox
                   and the action cell stop the event so they still work. */
                onClick={() => onDetails(opp)}
                className="cursor-pointer border-b border-slate-100 transition hover:bg-slate-50 dark:border-[#17304a]/70 dark:hover:bg-[#0b2034]"
              >
                <td
                  className="px-3 py-3.5"
                  onClick={(event) => event.stopPropagation()}
                >
                  <input type="checkbox" className="h-3.5 w-3.5 rounded" />
                </td>

                <td className="px-3 py-3.5">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    #{opp.leadId}
                  </span>
                </td>

                {/* Opportunity name on top, its company underneath. Plain
                    markup now the row is clickable - a nested button would
                    fire the same handler a second time. */}
                <td className="max-w-[170px] px-3 py-3.5">
                  <p className="text-[12px] font-bold text-slate-900 dark:text-white">
                    {opp.name}
                  </p>

                  <p className="mt-0.5 text-[10px] text-slate-500">
                    {opp.company}
                  </p>
                </td>

                <td className="px-3 py-3.5">
                  <p className="text-[12px] font-bold text-slate-900 dark:text-white">
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

                <td
                  className="px-3 py-3.5"
                  onClick={(event) => event.stopPropagation()}
                >
                  {/* The phone icon opened the details drawer, which is now
                      what clicking the row does. */}
                  <div className="flex items-center justify-end gap-3">
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
  activities,
  activitiesLoading,
  saving,
  onClose,
  onEdit,
  onMarkDead,
  onLogActivity,
}: {
  opportunity: Opportunity;
  activities: OpportunityActivity[];
  activitiesLoading: boolean;
  saving: boolean;
  onClose: () => void;
  onEdit: () => void;
  onMarkDead: () => void;
  onLogActivity: (
    payload: LogOpportunityActivityPayload,
  ) => Promise<boolean>;
}) {
  const [showActivityForm, setShowActivityForm] = useState(false);

  /* A different opportunity in the same drawer starts with a closed form, so
     a half-written note never carries over to another record. */
  useEffect(() => {
    setShowActivityForm(false);
  }, [opportunity.id]);

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

          {/* The three-dot menu that sat beside this is gone: Edit and Mark
              as Dead are the footer buttons, and the stage moves belong to
              the Log Activity form, which also captures why. */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-[#17304a] dark:text-slate-300"
            >
              <FiMessageSquare size={16} />
            </button>
          </div>
        </div>

        {/* Activity */}
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-[12px] font-bold">Activity History</h4>

            <button
              type="button"
              onClick={() => setShowActivityForm((value) => !value)}
              className="text-[10px] font-medium text-slate-500 hover:text-[#233353] dark:hover:text-white"
            >
              {showActivityForm ? "Cancel" : "+ Log Activity"}
            </button>
          </div>

          {showActivityForm && (
            <LogOpportunityActivityForm
              opportunity={opportunity}
              saving={saving}
              onCancel={() => setShowActivityForm(false)}
              onSubmit={async (payload) => {
                const ok = await onLogActivity(payload);

                if (ok) {
                  setShowActivityForm(false);
                }

                return ok;
              }}
            />
          )}

          <div className="relative ml-2 border-l border-slate-200 pl-5 dark:border-[#17304a]">
            {activitiesLoading ? (
              <p className="py-4 text-[10px] font-medium text-slate-400">
                Loading activity...
              </p>
            ) : activities.length === 0 ? (
              <p className="py-4 text-[10px] text-slate-400">
                No activity recorded yet.
              </p>
            ) : (
              activities.map((activity, index) => (
                <div
                  key={activity.id || `${activity.created_at}-${index}`}
                  className="relative mb-5"
                >
                  <span
                    className={`absolute -left-[25px] top-2 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[#071929] ${
                      index === 0
                        ? "bg-[#233353]"
                        : "bg-slate-300 dark:bg-slate-600"
                    }`}
                  />

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#17304a] dark:bg-[#0b1d2e]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="text-[11px] font-bold">
                          {activity.action}
                        </h5>

                        {activity.description && (
                          <p className="mt-1 text-[10px] leading-5 text-slate-500">
                            {activity.description}
                          </p>
                        )}
                      </div>

                      <span className="whitespace-nowrap text-[9px] text-slate-400">
                        {formatActivityStamp(activity.created_at)}
                      </span>
                    </div>

                    <p className="mt-1.5 flex items-center gap-1 text-[9px] text-slate-400">
                      <FiCalendar size={9} />
                      {formatActivityDateTime(activity.created_at)}
                      {activity.created_by_name
                        ? ` • ${activity.created_by_name}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
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

        {/* Footer actions */}
        <div className="flex shrink-0 items-center gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-[#17304a] dark:bg-[#071929]">
          <button
            type="button"
            onClick={onEdit}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-3 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#0b1d2e] dark:text-slate-200 dark:hover:bg-[#0b2034]"
          >
            <FiEdit2 size={13} />
            Edit Opportunity
          </button>

          <button
            type="button"
            onClick={onMarkDead}
            disabled={saving || opportunity.stage === "Dead"}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white py-3 text-[11px] font-bold text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900/40 dark:bg-[#0b1d2e] dark:hover:bg-rose-950/20"
          >
            <FiX size={13} />
            Mark as Dead
          </button>
        </div>
      </aside>
    </div>
  );
}

/* ================================================================
   LOG ACTIVITY FORM
================================================================ */

/* Opens under the Activity History heading. Stage and remarks are submitted
   together so the timeline records why an opportunity moved, not just that
   it did. */
function LogOpportunityActivityForm({
  opportunity,
  saving,
  onCancel,
  onSubmit,
}: {
  opportunity: Opportunity;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: LogOpportunityActivityPayload) => Promise<boolean>;
}) {
  const currentStatus = STAGE_TO_STATUS[opportunity.stage];

  const nextStatuses = OPPORTUNITY_TRANSITIONS[currentStatus] || [];

  /* Default to the step forward rather than to "no change": moving the
     opportunity on is what this form is opened for most of the time. */
  const [status, setStatus] = useState<string>(nextStatuses[0] || "");
  const [remarks, setRemarks] = useState("");

  /* Reset once the opportunity moves, so the select is never left offering a
     step that has already been taken. */
  useEffect(() => {
    setStatus((OPPORTUNITY_TRANSITIONS[currentStatus] || [])[0] || "");
    setRemarks("");
  }, [opportunity.id, currentStatus]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const ok = await onSubmit({
      status: status || undefined,
      remarks: remarks.trim() || undefined,
    });

    if (ok) {
      setRemarks("");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-[#17304a] dark:bg-[#0b1d2e]"
    >
      <div className="mb-3">
        <label className="mb-1.5 block text-[10px] font-semibold text-slate-600 dark:text-slate-400">
          Move Stage To
        </label>

        <div className="relative">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 pr-9 text-[11px] text-slate-700 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
          >
            {/* Always available, so the form can also record a call or a note
                without moving the opportunity on. */}
            <option value="">Keep at {opportunity.stage}</option>

            {nextStatuses.map((next) => (
              <option key={next} value={next}>
                {statusToStage(next)}
              </option>
            ))}
          </select>

          <FiChevronDown
            size={13}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>

        {!nextStatuses.length && (
          <p className="mt-1.5 text-[9px] text-slate-400">
            This opportunity is {opportunity.stage} and cannot move further.
            You can still log a note against it.
          </p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold text-slate-600 dark:text-slate-400">
          Remarks
        </label>

        <textarea
          rows={3}
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          placeholder="What happened? e.g. Discussed technical specifications and requirements."
          className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-800 outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
        />
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={saving || (!status && !remarks.trim())}
          className="rounded-lg bg-[#233353] px-4 py-2 text-[10px] font-bold text-white transition hover:bg-[#18243a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? "Saving..." : "Submit"}
        </button>
      </div>
    </form>
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
  opportunity,
  salesUsers,
  leadSourceOptions,
  onClose,
  onSubmit,
}: {
  /** When present, the form opens prefilled from this lead and saving it
      converts the lead rather than creating a standalone opportunity. */
  lead?: Lead | null;
  /** When present, the form opens as Edit Opportunity, prefilled from the
      record. Editing used to open a four-field modal, which could not reach
      the address, compliance, sourcing or product lines at all. */
  opportunity?: Opportunity | null;
  salesUsers: SalesUser[];
  /** Lead sources as configured in Masters, not a hardcoded list. */
  leadSourceOptions: string[];
  onClose: () => void;
  onSubmit: (payload: Record<string, any>) => Promise<void>;
}) {
  const isEditing = Boolean(opportunity);

  /* The opportunity record and the lead carry the same field names, so one
     seed serves both; the record wins when editing an existing row. */
  const seed: Record<string, any> = opportunity?.raw || lead || {};

  const [customerType, setCustomerType] = useState<CustomerType>(
    normalizeCustomerType(seed.customer_type_name),
  );

  const [organizationName, setOrganizationName] = useState(
    seed.organization_name || "",
  );

  const [organizationWebsite, setOrganizationWebsite] = useState(
    seed.website || "",
  );

  const [officeAddress, setOfficeAddress] = useState(seed.office_address || "");

  const [city, setCity] = useState(seed.city || "");

  const [state, setState] = useState(seed.state_name || "");

  const [pinCode, setPinCode] = useState(seed.zip_code || "");

  const [country, setCountry] = useState(seed.country || "India");

  const [shippingAddress, setShippingAddress] = useState(
    seed.shipping_address || "",
  );
  const [shippingCity, setShippingCity] = useState(seed.shipping_city || "");
  const [shippingState, setShippingState] = useState(seed.shipping_state || "");
  const [shippingPinCode, setShippingPinCode] = useState(
    seed.shipping_zip_code || "",
  );
  const [shippingCountry, setShippingCountry] = useState(
    seed.shipping_country || "India",
  );
  const [sameAsBilling, setSameAsBilling] = useState(false);

  /* Names the opportunity itself; previously the title was silently
     derived from the contact or organisation name. */
  const [opportunityName, setOpportunityName] = useState(
    seed.title || seed.organization_name || "",
  );

  const [gstNumber, setGstNumber] = useState(seed.gst_number || "");

  const [panNumber, setPanNumber] = useState(seed.pan_number || "");

  const [coiNumber, setCoiNumber] = useState(seed.coi_number || "");

  const [contactName, setContactName] = useState(seed.contact_name || "");

  const [designation, setDesignation] = useState(seed.designation || "");

  const [mobileNumber, setMobileNumber] = useState(seed.mobile_number || "");

  const [email, setEmail] = useState(seed.email || "");

  const [priority, setPriority] = useState<Priority>(
    normalizePriority(seed.priority),
  );

  /* The date input needs YYYY-MM-DD; the API sends a full ISO timestamp. */
  const [expectedClosingDate, setExpectedClosingDate] = useState(
    seed.expected_closing_date
      ? String(seed.expected_closing_date).slice(0, 10)
      : "",
  );

  const [remarks, setRemarks] = useState(
    seed.remarks || seed.requirements || "",
  );

  const [purchaseTimeline, setPurchaseTimeline] = useState(
    seed.purchase_timeline || "",
  );

  /* Kept as text so the field can be cleared; parsed on submit. */
  const [totalEstValue, setTotalEstValue] = useState(
    seed.deal_value ? String(seed.deal_value) : "",
  );

  /* Carried over from the lead rather than defaulting to Marketing, which
     misreported the source of every lead that came in another way. */
  const [leadSource, setLeadSource] = useState(
    seed.lead_source || seed.lead_source_name || "",
  );

  /* Holds the user id, not a display name: the previous single hardcoded
     "Sales Team" option could never map to a real user. */
  const [assignedTo, setAssignedTo] = useState(seed.assigned_to_id || "");

  const [attachments, setAttachments] = useState<File[]>([]);

  /* Line items chosen through Add Product, replacing the old fixed
     checkbox list which could not carry a model, SKU, price or tax. */
  const [lineItems, setLineItems] = useState<OpportunityLineItem[]>(() =>
    (seed.product_items || []).map((item: any, index: number) => ({
      key: `${item.sku || item.product || "line"}-${index}`,
      productId: String(item.product_id ?? item.sku ?? index),
      product: item.product || "",
      model: item.model || "",
      sku: item.sku || "",
      quantity: Number(item.quantity) || 1,
      unitPrice: Number(item.unit_price ?? item.unitPrice) || 0,
      discount: Number(item.discount) || 0,
      tax: Number(item.tax) || 0,
    })),
  );

  /* Row whose cells are currently editable. */
  const [editingLineKey, setEditingLineKey] = useState<string | null>(null);

  const productsRef = useRef<HTMLDivElement | null>(null);

  /* Clicking away from the table closes the open row, so a filled-in line
     goes back to its read-only form instead of staying in edit mode. */
  useEffect(() => {
    if (!editingLineKey) return;

    function handleOutside(event: MouseEvent) {
      if (!productsRef.current?.contains(event.target as Node)) {
        setEditingLineKey(null);
      }
    }

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Enter" || event.key === "Escape") {
        setEditingLineKey(null);
      }
    }

    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [editingLineKey]);

  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCategory, setProductCategory] = useState("All");
  const [pickedProducts, setPickedProducts] = useState<OpportunityLineItem[]>([]);

  const [submitting, setSubmitting] = useState(false);

  /* Mirrors compute_product_totals in app/services/opportunity_service.py
     so the table shows live figures while editing. The backend recomputes
     on save and its values are what get stored. */
  const productTotals = lineItems.reduce(
    (acc, item) => {
      const line = item.quantity * item.unitPrice;
      const discount = (line * (item.discount || 0)) / 100;
      const taxable = line - discount;

      acc.subtotal += line;
      acc.discount += discount;
      acc.tax += (taxable * (item.tax || 0)) / 100;

      return acc;
    },
    { subtotal: 0, discount: 0, tax: 0 },
  );

  const productsTotal =
    productTotals.subtotal - productTotals.discount + productTotals.tax;

  const filteredProducts = PRODUCT_CATALOG.filter((product) => {
    if (productCategory !== "All" && product.category !== productCategory) {
      return false;
    }

    const term = productSearch.trim().toLowerCase();

    if (!term) return true;

    return (
      product.name.toLowerCase().includes(term) ||
      productSku(product.id).toLowerCase().includes(term)
    );
  });

  const togglePicked = (product: CatalogProduct) => {
    setPickedProducts((current) => {
      if (current.some((item) => item.productId === product.id)) {
        return current.filter((item) => item.productId !== product.id);
      }

      return [
        ...current,
        {
          key: `${product.id}-${Date.now()}-${current.length}`,
          productId: product.id,
          product: product.category,
          model: product.name,
          sku: productSku(product.id),
          quantity: 1,
          unitPrice: product.price,
          discount: 0,
          tax: 18,
        },
      ];
    });
  };

  const updatePicked = (key: string, patch: Partial<OpportunityLineItem>) =>
    setPickedProducts((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );

  const confirmProducts = () => {
    if (!pickedProducts.length) return;

    setLineItems((current) => [...current, ...pickedProducts]);
    setPickedProducts([]);
    setShowProductModal(false);
  };

  const updateLineItem = (key: string, patch: Partial<OpportunityLineItem>) =>
    setLineItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );

  const removeLineItem = (key: string) =>
    setLineItems((current) => current.filter((item) => item.key !== key));

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
        ownerId: assignedTo,
        remarks,
        attachments,
        opportunityName,
        dealValue: totalEstValue,
        lineItems,
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
        title={isEditing ? "Edit Opportunity" : "New Opportunity"}
        parentLabel="Opportunity"
        currentLabel={isEditing ? "Edit" : "New"}
        actions={
          <>
            <CancelButton onClick={onClose} />

            <DraftButton disabled={submitting} onClick={onClose} />

            <SubmitButton formId="new-opportunity-form" disabled={submitting}>
              {submitting
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Opportunity"
                  : "Create Opportunity"}
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
                icon={<FiInfo size={17} />}
                title="Opportunity Information"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    Lead ID:
                  </span>

                  <span className="text-[11px] font-bold text-slate-800 dark:text-white">
                    {lead?.id ? `#LD-${lead.id}` : "Not from a lead"}
                  </span>
                </div>

                <FormInput
                  label="Opportunity Name *"
                  value={opportunityName}
                  onChange={setOpportunityName}
                  placeholder="Enter name here"
                />
              </FormSectionBlock>

              <FormSectionBlock
                icon={<FiUser size={17} />}
                title="Organization Details"
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
                title="Location Information"
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

              {/* =================================================
                  PRODUCTS & ORDER ITEMS
              ================================================= */}

              {/* Unlike the other sections this one has no heading rule:
                  the title and Add Product share a single row. */}
              <section className="mt-8">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">
                      <FiMapPin size={16} />
                    </span>

                    <h3 className="text-[15px] font-semibold text-slate-800 dark:text-white">
                      Products &amp; Order Items
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPickedProducts([]);
                      setProductSearch("");
                      setProductCategory("All");
                      setShowProductModal(true);
                    }}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#233353] px-4 text-xs font-semibold text-white transition hover:bg-[#18243a]"
                  >
                    <FiPlus size={13} />
                    Add Product
                  </button>
                </div>

                <div
                  ref={productsRef}
                  className="overflow-x-auto rounded-lg border border-slate-200 dark:border-[#17304a]"
                >
                  <table className="w-full min-w-[680px] table-fixed">
                    <colgroup>
                      <col className="w-[26%]" />
                      <col className="w-[19%]" />
                      <col className="w-[13%]" />
                      <col className="w-[13%]" />
                      <col className="w-[12%]" />
                      <col className="w-[13%]" />
                      <col className="w-[44px]" />
                    </colgroup>

                    <thead className="border-b border-slate-200 dark:border-[#17304a]">
                      <tr>
                        <Th>Product</Th>
                        <Th>Model / Variant</Th>
                        <Th>Qty</Th>
                        <Th>Discount</Th>
                        <Th>Tax</Th>
                        <Th>Unit Price</Th>
                        <Th />
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-[#0d2336]">
                      {lineItems.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-3 py-8 text-center text-[11px] text-slate-400"
                          >
                            No products added yet. Use Add Product to build the
                            opportunity.
                          </td>
                        </tr>
                      )}

                      {lineItems.map((item) => {
                        const editing = editingLineKey === item.key;

                        /* Clicking a row puts its cells into edit mode; the
                           design has no pencil, only the delete icon. */
                        return (
                          <tr
                            key={item.key}
                            onClick={() => setEditingLineKey(item.key)}
                            className={`cursor-pointer ${
                              editing
                                ? "bg-slate-50 dark:bg-[#071929]"
                                : "hover:bg-slate-50/60 dark:hover:bg-[#071929]/50"
                            }`}
                          >
                            <td className="px-3 py-2.5">
                              <p className="text-[11px] font-bold text-slate-900 dark:text-white">
                                {item.product}
                              </p>

                              <p className="mt-0.5 text-[9px] text-slate-400">
                                SKU: {item.sku}
                              </p>
                            </td>

                            <td className="px-3 py-2.5">
                              {editing ? (
                                <input
                                  value={item.model}
                                  onChange={(event) =>
                                    updateLineItem(item.key, {
                                      model: event.target.value,
                                    })
                                  }
                                  className={LINE_CELL_MODEL}
                                />
                              ) : (
                                <span className="text-[10px] text-slate-600 dark:text-slate-300">
                                  {item.model}
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2.5">
                              {editing ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    aria-label="Decrease quantity"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateLineItem(item.key, {
                                        quantity: Math.max(1, item.quantity - 1),
                                      });
                                    }}
                                    className={LINE_STEPPER}
                                  >
                                    <FiMinus size={10} />
                                  </button>

                                  <span className="w-5 text-center text-[10px] font-semibold">
                                    {item.quantity}
                                  </span>

                                  <button
                                    type="button"
                                    aria-label="Increase quantity"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      updateLineItem(item.key, {
                                        quantity: item.quantity + 1,
                                      });
                                    }}
                                    className={LINE_STEPPER}
                                  >
                                    <FiPlus size={10} />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-600 dark:text-slate-300">
                                  {item.quantity}
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2.5">
                              {editing ? (
                                <div className="flex items-center gap-1">
                                  <LineNumberInput
                                    ariaLabel={`Discount for ${item.model}`}
                                    value={item.discount}
                                    onChange={(next) =>
                                      updateLineItem(item.key, {
                                        discount: next,
                                      })
                                    }
                                  />
                                  <span className="text-[10px] text-slate-500">
                                    %
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-600 dark:text-slate-300">
                                  {item.discount} %
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2.5">
                              {editing ? (
                                <div className="flex items-center gap-1">
                                  <LineNumberInput
                                    ariaLabel={`Tax for ${item.model}`}
                                    value={item.tax}
                                    onChange={(next) =>
                                      updateLineItem(item.key, { tax: next })
                                    }
                                  />
                                  <span className="text-[10px] text-slate-500">
                                    %
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-600 dark:text-slate-300">
                                  {item.tax} %
                                </span>
                              )}
                            </td>

                            {/* Unit price comes from the catalogue via Add
                                Product and is not edited on the line. */}
                            <td className="px-3 py-2.5">
                              <span className="text-[10px] text-slate-600 dark:text-slate-300">
                                {item.unitPrice.toLocaleString("en-IN")}
                              </span>
                            </td>

                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                aria-label={`Remove ${item.model}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeLineItem(item.key);
                                }}
                                className={`rounded p-1 text-rose-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 ${
                                  editing ? "bg-rose-50 dark:bg-rose-950/20" : ""
                                }`}
                              >
                                <FiTrash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    <tfoot>
                      <tr className="border-t border-slate-200 dark:border-[#17304a]">
                        <td
                          colSpan={5}
                          className="px-3 py-2.5 text-[11px] text-slate-600 dark:text-slate-300"
                        >
                          Total Amount
                        </td>

                        <td
                          colSpan={2}
                          className="px-3 py-2.5 text-right text-[11px] font-bold text-slate-900 dark:text-white"
                          title={
                            `Subtotal ${formatRupees(productTotals.subtotal)}` +
                            ` − discount ${formatRupees(productTotals.discount)}` +
                            ` + tax ${formatRupees(productTotals.tax)}`
                          }
                        >
                          {formatRupees(productsTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Total Estimated Value. Defaults to the products total but
                    stays editable, since the deal value quoted to the client
                    is a commercial decision, not just the line sum. */}
                <div className="mt-3">
                  <FormInput
                    label="Total Est. Value *"
                    value={totalEstValue}
                    onChange={setTotalEstValue}
                    placeholder="₹ 0.00"
                    type="number"
                  />
                </div>

                <div className="mt-3">
                  <FormSelect
                    label="Purchase Timeline *"
                    value={purchaseTimeline}
                    options={PURCHASE_TIMELINES}
                    onChange={setPurchaseTimeline}
                  />
                </div>
              </section>
            </FormCard>

            {/* ===================================================
                RIGHT COLUMN
            =================================================== */}

            <FormCard className="h-fit">
              {/* =================================================
                  SALES INFORMATION

                  `first` matters: without it the section picks up mt-8 and
                  this card's heading sits 32px below the one opposite it.
              ================================================= */}

              <FormSectionBlock
                first
                icon={<FiUser size={17} />}
                title="Sales Information"
              >
                <div className="space-y-3">
                  <FormSelect
                    label="Lead Source *"
                    value={leadSource}
                    options={leadSourceOptions}
                    onChange={setLeadSource}
                  />

                  <FormSelect
                    label="Assigned to *"
                    value={assignedTo}
                    options={salesUsers.map((user) => user.id)}
                    displayOptions={salesUsers.map((user) => ({
                      value: user.id,
                      label: user.name,
                    }))}
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

      {showProductModal && (
        <OpportunityProductModal
          products={filteredProducts}
          picked={pickedProducts}
          search={productSearch}
          onSearch={setProductSearch}
          category={productCategory}
          onCategory={setProductCategory}
          onToggle={togglePicked}
          onUpdate={updatePicked}
          onClose={() => setShowProductModal(false)}
          onConfirm={confirmProducts}
        />
      )}
    </div>
  );
}

/**
 * Percentage cell inside the Products & Order Items table.
 *
 * Holds the text while focused so a half-typed or cleared value is not
 * clobbered by the parsed number, and selects on focus so typing replaces
 * the existing figure rather than appending to it.
 */
function LineNumberInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(String(value));

  /* Focus is tracked in a ref rather than state: setting state here would
     re-render and move the caret to the end, defeating select-on-focus. */
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      value={draft}
      onClick={(event) => event.stopPropagation()}
      onFocus={(event) => {
        focusedRef.current = true;
        event.target.select();
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        onChange(parseAmount(event.target.value));
      }}
      onBlur={() => {
        focusedRef.current = false;
        setDraft(String(parseAmount(draft)));
      }}
      className={LINE_CELL_SMALL}
    />
  );
}

/* ================================================================
   ADD PRODUCTS TO ORDER
================================================================ */

/**
 * Product picker shared in shape with the Quotation and Sales Order
 * screens, reading the same catalogue so all three offer the same
 * products at the same prices.
 */
function OpportunityProductModal({
  products,
  picked,
  search,
  onSearch,
  category,
  onCategory,
  onToggle,
  onUpdate,
  onClose,
  onConfirm,
}: {
  products: CatalogProduct[];
  picked: OpportunityLineItem[];
  search: string;
  onSearch: (value: string) => void;
  category: string;
  onCategory: (value: string) => void;
  onToggle: (product: CatalogProduct) => void;
  onUpdate: (key: string, patch: Partial<OpportunityLineItem>) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const lineTotal = picked.reduce(
    (sum, item) =>
      sum + item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
    0,
  );

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 p-5">
      <div className="flex h-[590px] w-full max-w-[780px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#051422]">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5 dark:border-[#17304a]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
            Add Products to Order
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-700"
          >
            <FiX size={17} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search by product name, model or SKU..."
              className="h-10 w-full rounded-md border border-slate-300 px-3 pr-10 text-xs outline-none focus:border-slate-400 dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
            />

            <FiSearch
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600"
            />
          </div>
        </div>

        <div className="px-5 pt-3">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-[#17304a]">
            {PRODUCT_CATEGORIES.map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => onCategory(entry)}
                className={`whitespace-nowrap px-3 py-2 text-[10px] font-medium transition ${
                  category === entry
                    ? "rounded-t-md bg-[#24395f] text-white"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300"
                }`}
              >
                {entry}
              </button>
            ))}
          </div>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-5 overflow-hidden px-5 py-4">
          <div className="space-y-2 overflow-y-auto pr-1">
            {products.map((product) => {
              const checked = picked.some(
                (item) => item.productId === product.id,
              );

              return (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => onToggle(product)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    checked
                      ? "border-slate-400 bg-slate-50 dark:bg-[#0b2034]"
                      : "border-slate-200 bg-white hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border text-[9px] ${
                        checked
                          ? "border-[#24395f] bg-[#24395f] text-white"
                          : "border-slate-300"
                      }`}
                    >
                      {checked ? "\u2713" : ""}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-bold text-slate-800 dark:text-white">
                        {product.name}
                      </p>

                      <p className="mt-1 text-[10px] text-slate-500">
                        {formatShortCurrency(product.price)} ·{" "}
                        {product.available} available
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            {products.length === 0 && (
              <p className="py-10 text-center text-[11px] text-slate-400">
                No products match that search.
              </p>
            )}
          </div>

          <div className="flex flex-col overflow-hidden">
            <div className="mb-2 flex items-center gap-2">
              <FiShoppingCart size={13} className="text-slate-500" />

              <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                Selected Products
              </p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto border-t border-slate-200 pt-3 dark:border-[#17304a]">
              {picked.length === 0 && (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
                  <FiInfo size={16} className="text-slate-300" />

                  <p className="text-[11px] font-semibold text-slate-500">
                    No Product Selected
                  </p>

                  <p className="text-[10px] text-slate-400">
                    Select product to get started
                  </p>
                </div>
              )}

              {picked.map((item) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-slate-200 p-3 dark:border-[#17304a]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-bold text-slate-800 dark:text-white">
                      {item.model}
                    </p>

                    <button
                      type="button"
                      aria-label={`Remove ${item.model}`}
                      onClick={() =>
                        onToggle({
                          id: item.productId,
                          name: item.model,
                          category: item.product,
                          price: item.unitPrice,
                          available: 0,
                        })
                      }
                      className="text-rose-400 transition hover:text-rose-600"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">Quantity</span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() =>
                          onUpdate(item.key, {
                            quantity: Math.max(1, item.quantity - 1),
                          })
                        }
                        className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-[#17304a]"
                      >
                        −
                      </button>

                      <span className="w-6 text-center text-[11px] font-semibold">
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() =>
                          onUpdate(item.key, { quantity: item.quantity + 1 })
                        }
                        className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-[#17304a]"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div>
                      <label className="mb-1 block text-[9px] text-slate-500">
                        Unit Price (₹)
                      </label>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.unitPrice}
                        onChange={(event) =>
                          onUpdate(item.key, {
                            unitPrice: parseAmount(event.target.value),
                          })
                        }
                        className="h-8 w-full rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[9px] text-slate-500">
                        Discount (%)
                      </label>

                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.discount}
                        onChange={(event) =>
                          onUpdate(item.key, {
                            discount: parseAmount(event.target.value),
                          })
                        }
                        className="h-8 w-full rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[9px] text-slate-500">
                        Tax (GST %)
                      </label>

                      <select
                        value={item.tax}
                        onChange={(event) =>
                          onUpdate(item.key, { tax: Number(event.target.value) })
                        }
                        className="h-8 w-full rounded-md border border-slate-200 px-2 text-[11px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
                      >
                        <option value={18}>18%</option>
                        <option value={15}>15%</option>
                        <option value={12}>12%</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-[#17304a]">
              <span className="text-[11px] text-slate-500">Line Total</span>

              <span className="text-[11px] font-bold text-slate-800 dark:text-white">
                {picked.length ? formatShortCurrency(lineTotal) : 0}
              </span>
            </div>
          </div>
        </div>

        <div className="flex h-16 shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-5 dark:border-[#17304a]">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-slate-200 px-5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-200"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-[#233353] px-5 text-xs font-bold text-white transition hover:bg-[#18243a]"
          >
            <FiPlus size={13} />
            Add Product
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   EDIT MODAL
================================================================ */

/* EditOpportunityModal lived here: a four-field modal (name, company,
   priority, owner) that could not reach the address, compliance,
   sourcing or product lines. Edit now opens the full New Opportunity
   page prefilled instead. */


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
