"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import {
  FiPlus,
  FiSearch,
  FiGrid,
  FiList,
  FiDownload,
  FiRefreshCw,
  FiSliders,
  FiPhone,
  FiMoreVertical,
  FiMessageSquare,
  FiX,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiCalendar,
  FiMapPin,
  FiUser,
  FiBuilding,
  FiMail,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiShoppingCart,
  FiUploadCloud,
  FiEdit2,
  FiAlertCircle,
  FiExternalLink,
} from "react-icons/fi";

interface ProductItem {
  name: string;
  qty: number;
  price: number;
}

type CustomerType =
  | "Distributor"
  | "OEM"
  | "End Customer"
  | "Institution"
  | "Corporate";

type OpportunityStage =
  | "Qualified"
  | "Demo Scheduled"
  | "Proposal Sent"
  | "Negotiation"
  | "Closed Won"
  | "Dead";

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
  "Demo Scheduled",
  "Proposal Sent",
  "Negotiation",
];

const STAGE_PROGRESS: Record<OpportunityStage, number> = {
  Qualified: 25,
  "Demo Scheduled": 50,
  "Proposal Sent": 75,
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
  const status = String(value || "").toLowerCase();

  if (
    status === "inactive" ||
    status === "dead" ||
    status === "closed"
  ) {
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

function normalizeStage(lead: any): OpportunityStage {
  const stage = String(
    lead.stage || lead.status || ""
  ).toLowerCase();

  if (
    stage === "won" ||
    stage === "closed won" ||
    stage === "closed_won"
  ) {
    return "Closed Won";
  }

  if (
    stage === "dead" ||
    stage === "lost" ||
    stage === "inactive"
  ) {
    return "Dead";
  }

  if (
    stage === "negotiation" ||
    lead.demo_status === "given"
  ) {
    return "Negotiation";
  }

  if (
    stage === "quotation" ||
    stage === "proposal" ||
    stage === "proposal sent"
  ) {
    return "Proposal Sent";
  }

  if (
    stage === "demo" ||
    stage === "demo_scheduled" ||
    stage === "demo scheduled"
  ) {
    return "Demo Scheduled";
  }

  return "Qualified";
}

function getLeadId(lead: any) {
  return (
    lead.lead_id ||
    lead.leadId ||
    lead.reference_id ||
    lead.id ||
    ""
  );
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

  if (
    Array.isArray(lead.quotation_items) &&
    lead.quotation_items.length
  ) {
    return lead.quotation_items.reduce(
      (sum: number, item: any) =>
        sum +
        Number(item.qty || 1) *
          Number(item.price || 0),
      0
    );
  }

  return 0;
}

function mapLeadToOpportunity(lead: any): Opportunity {
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
    leadId: String(getLeadId(lead)),

    customerName,
    email:
      lead.email ||
      lead.email_address ||
      "",
    phone:
      lead.phone ||
      lead.mobile ||
      lead.mobile_number ||
      "",

    company,

    city:
      lead.city ||
      lead.location_city ||
      "",

    state:
      lead.state ||
      lead.state_name ||
      "",

    country:
      lead.country ||
      "India",

    customerType: normalizeCustomerType(
      lead.customer_type
    ),

    stage,

    status: normalizeStatus(
      lead.status
    ),

    priority: normalizePriority(
      lead.priority
    ),

    dealValue: getDealValue(lead),

    owner,

    ownerId:
      lead.assigned_to_id ||
      lead.owner_id ||
      undefined,

    expectedClosingDate:
      lead.expected_closing_date ||
      lead.expected_close_date ||
      lead.closing_date ||
      undefined,

    createdAt:
      lead.created_at ||
      lead.createdAt,

    designation:
      lead.designation ||
      lead.contact_designation ||
      "",

    officeAddress:
      lead.office_address ||
      lead.address ||
      "",

    gstNumber:
      lead.gst_number ||
      lead.gstin ||
      "",

    panNumber:
      lead.pan_number ||
      lead.pan ||
      "",

    coiNumber:
      lead.coi_number ||
      "",

    requirements:
      lead.requirements ||
      "",

    remarks:
      lead.remarks ||
      lead.notes ||
      "",

    productItems:
      Array.isArray(lead.quotation_items)
        ? lead.quotation_items
        : [],

    activityHistory:
      Array.isArray(lead.activity_history)
        ? lead.activity_history
        : [],
  };
}

export default function OpportunitiesPage() {
  const { addToast } = useUIStore();

  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [salesUsers, setSalesUsers] = useState<SalesUser[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState("");

  const [viewMode, setViewMode] =
    useState<"board" | "list">("board");

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const [showFilters, setShowFilters] = useState(false);
  const [showPageMenu, setShowPageMenu] =
    useState(false);

  const [filters, setFilters] =
    useState<OpportunityFilters>(
      DEFAULT_FILTERS
    );

  const [appliedFilters, setAppliedFilters] =
    useState<OpportunityFilters>(
      DEFAULT_FILTERS
    );

  const [showAddModal, setShowAddModal] =
    useState(false);

  const [selectedOpportunity, setSelectedOpportunity] =
    useState<Opportunity | null>(null);

  const [showDetails, setShowDetails] =
    useState(false);

  const [openActionMenu, setOpenActionMenu] =
    useState<string | null>(null);

  const [editingOpportunity, setEditingOpportunity] =
    useState<Opportunity | null>(null);

  const pageMenuRef = useRef<HTMLDivElement>(null);

  const fetchOpportunities = async (
    silent = false
  ) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const res = await api.get(
        "/api/v1/leads/"
      );

      if (res.data?.success) {
        const list = Array.isArray(res.data.data)
          ? res.data.data
          : [];

        setOpps(
          list.map(mapLeadToOpportunity)
        );
      } else {
        setOpps([]);
      }
    } catch (error) {
      console.error(
        "Failed to fetch opportunities:",
        error
      );

      addToast(
        "Unable to load opportunities.",
        "error"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchSalesUsers = async () => {
    try {
      /*
       * If your application already has a users endpoint,
       * replace this URL with your actual endpoint.
       */
      const res = await api.get(
        "/api/v1/users/"
      );

      if (res.data?.success) {
        const users = Array.isArray(res.data.data)
          ? res.data.data
          : [];

        setSalesUsers(
          users.map((user: any) => ({
            id: String(
              user.id ||
                user.user_id
            ),
            name:
              user.name ||
              user.full_name ||
              user.username ||
              "Sales User",
          }))
        );
      }
    } catch (error) {
      /*
       * Users are optional for rendering the page.
       * The page still works if this endpoint doesn't exist.
       */
      console.warn(
        "Sales users endpoint unavailable.",
        error
      );
    }
  };

  useEffect(() => {
    fetchOpportunities();
    fetchSalesUsers();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        pageMenuRef.current &&
        !pageMenuRef.current.contains(
          event.target as Node
        )
      ) {
        setShowPageMenu(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );

    return () =>
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
  }, []);

  const filtered = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return opps.filter((opp) => {
      const matchesSearch =
        !query ||
        opp.customerName
          .toLowerCase()
          .includes(query) ||
        opp.company
          .toLowerCase()
          .includes(query) ||
        opp.email
          .toLowerCase()
          .includes(query) ||
        opp.leadId
          .toLowerCase()
          .includes(query) ||
        opp.owner
          .toLowerCase()
          .includes(query);

      const matchesCustomerType =
        !appliedFilters.customerType ||
        opp.customerType ===
          appliedFilters.customerType;

      const matchesAssignedTo =
        !appliedFilters.assignedTo ||
        opp.ownerId ===
          appliedFilters.assignedTo ||
        opp.owner ===
          appliedFilters.assignedTo;

      const matchesStatus =
        !appliedFilters.status ||
        appliedFilters.status === "All" ||
        opp.status ===
          appliedFilters.status;

      const matchesState =
        !appliedFilters.state ||
        appliedFilters.state === "All" ||
        opp.state ===
          appliedFilters.state;

      let matchesDate = true;

      if (
        appliedFilters.dateFrom ||
        appliedFilters.dateTo
      ) {
        const created =
          opp.createdAt
            ? new Date(opp.createdAt)
            : null;

        if (
          created &&
          !Number.isNaN(created.getTime())
        ) {
          if (
            appliedFilters.dateFrom &&
            created <
              new Date(
                `${appliedFilters.dateFrom}T00:00:00`
              )
          ) {
            matchesDate = false;
          }

          if (
            appliedFilters.dateTo &&
            created >
              new Date(
                `${appliedFilters.dateTo}T23:59:59`
              )
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
  }, [
    opps,
    search,
    appliedFilters,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filtered.length / PAGE_SIZE
    )
  );

  const paginated = useMemo(() => {
    const start =
      (page - 1) * PAGE_SIZE;

    return filtered.slice(
      start,
      start + PAGE_SIZE
    );
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
    (opp) =>
      opp.stage === "Negotiation"
  ).length;

  const closedWonToday = opps.filter(
    (opp) => {
      if (
        opp.stage !== "Closed Won"
      ) {
        return false;
      }

      if (!opp.createdAt) {
        return false;
      }

      const date = new Date(
        opp.createdAt
      );

      const today = new Date();

      return (
        date.getFullYear() ===
          today.getFullYear() &&
        date.getMonth() ===
          today.getMonth() &&
        date.getDate() ===
          today.getDate()
      );
    }
  ).length;

  const applyFilters = () => {
    setAppliedFilters({
      ...filters,
    });

    setPage(1);
    setShowFilters(false);

    addToast(
      "Opportunity filters applied.",
      "success"
    );
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(
      DEFAULT_FILTERS
    );
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

  const handleCreateOpportunity =
    async (
      payload: Record<string, any>
    ) => {
      try {
        setLoading(true);

        const createRes =
          await api.post(
            "/api/v1/leads/",
            {
              title:
                payload.contactName ||
                payload.organizationName,

              description:
                payload.organizationName,

              status: "active",

              customer_type:
                payload.customerType,

              organization_name:
                payload.organizationName,

              organization_website:
                payload.organizationWebsite,

              office_address:
                payload.officeAddress,

              city: payload.city,

              state:
                payload.state,

              pin_code:
                payload.pinCode,

              country:
                payload.country,

              gst_number:
                payload.gstNumber,

              pan_number:
                payload.panNumber,

              coi_number:
                payload.coiNumber,

              contact_name:
                payload.contactName,

              designation:
                payload.designation,

              mobile_number:
                payload.mobileNumber,

              email:
                payload.email,

              priority:
                payload.priority,

              expected_closing_date:
                payload.expectedClosingDate,

              requirements:
                payload.remarks,

              remarks:
                payload.remarks,
            }
          );

        if (!createRes.data?.success) {
          throw new Error(
            "Lead creation failed."
          );
        }

        const newLead =
          createRes.data.data;

        /*
         * Advance newly created lead into
         * opportunity stage.
         */
        await api.put(
          `/api/v1/leads/${newLead.id}/progress`,
          {
            stage: "opportunity",
            status: "active",
            demo_status: "skipped",

            customer_type:
              payload.customerType,

            priority:
              payload.priority,

            expected_closing_date:
              payload.expectedClosingDate,

            requirements:
              payload.remarks,

            quotation_type:
              "quotation",

            quotation_items:
              payload.productItems || [],
          }
        );

        addToast(
          "Opportunity created successfully.",
          "success"
        );

        setShowAddModal(false);

        /*
         * IMPORTANT:
         * Refresh immediately after creation.
         */
        await fetchOpportunities(true);

        setPage(1);
      } catch (error: any) {
        console.error(
          "Create opportunity error:",
          error
        );

        addToast(
          error?.response?.data
            ?.detail ||
            error?.message ||
            "Failed to create opportunity.",
          "error"
        );
      } finally {
        setLoading(false);
      }
    };

  const handleRefresh = async () => {
    await fetchOpportunities(true);

    addToast(
      "Opportunity list refreshed.",
      "success"
    );
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

    const rows = filtered.map(
      (opp) => [
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
        opp.expectedClosingDate ||
          "",
      ]
    );

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((cell) => {
            const value =
              cell == null
                ? ""
                : String(cell);

            return `"${value.replace(
              /"/g,
              '""'
            )}"`;
          })
          .join(",")
      )
      .join("\n");

    const blob = new Blob(
      [csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      `opportunities-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    setShowPageMenu(false);

    addToast(
      "Opportunity data exported.",
      "success"
    );
  };

  const handleDownloadChart = () => {
    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width = 1200;
    canvas.height = 700;

    const ctx =
      canvas.getContext("2d");

    if (!ctx) return;

    ctx.fillStyle = "#f5f6f8";
    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.fillStyle = "#233353";
    ctx.font =
      "700 32px Arial";

    ctx.fillText(
      "Opportunity Pipeline",
      60,
      70
    );

    const chartData = [
      {
        label: "Qualified",
        value: opps.filter(
          (x) =>
            x.stage ===
            "Qualified"
        ).length,
      },
      {
        label: "Demo Scheduled",
        value: opps.filter(
          (x) =>
            x.stage ===
            "Demo Scheduled"
        ).length,
      },
      {
        label: "Proposal Sent",
        value: opps.filter(
          (x) =>
            x.stage ===
            "Proposal Sent"
        ).length,
      },
      {
        label: "Negotiation",
        value: negotiationCount,
      },
    ];

    const max =
      Math.max(
        ...chartData.map(
          (x) => x.value
        ),
        1
      );

    chartData.forEach(
      (item, index) => {
        const x =
          100 + index * 260;

        const barHeight =
          (item.value / max) *
          400;

        const y =
          570 - barHeight;

        ctx.fillStyle =
          "#233353";

        ctx.fillRect(
          x,
          y,
          120,
          barHeight
        );

        ctx.fillStyle =
          "#475569";

        ctx.font =
          "600 18px Arial";

        ctx.fillText(
          item.label,
          x - 10,
          620
        );

        ctx.fillStyle =
          "#233353";

        ctx.font =
          "700 24px Arial";

        ctx.fillText(
          String(item.value),
          x + 45,
          y - 15
        );
      }
    );

    const link =
      document.createElement("a");

    link.download =
      "opportunity-pipeline.png";

    link.href =
      canvas.toDataURL(
        "image/png"
      );

    link.click();

    setShowPageMenu(false);

    addToast(
      "Pipeline chart downloaded.",
      "success"
    );
  };

  const openDetails = async (
    opp: Opportunity
  ) => {
    setSelectedOpportunity(opp);
    setShowDetails(true);
    setOpenActionMenu(null);

    /*
     * Optional detail endpoint.
     * If unavailable, the already loaded lead
     * remains usable.
     */
    try {
      const res =
        await api.get(
          `/api/v1/leads/${opp.id}`
        );

      if (res.data?.success) {
        setSelectedOpportunity(
          mapLeadToOpportunity(
            res.data.data
          )
        );
      }
    } catch {
      // Keep current opportunity data.
    }
  };

  const handleMarkDead = async (
    opp: Opportunity
  ) => {
    try {
      /*
       * Change this endpoint/body if your backend
       * uses a dedicated "mark dead" endpoint.
       */
      await api.put(
        `/api/v1/leads/${opp.id}/progress`,
        {
          stage: "dead",
          status: "inactive",
        }
      );

      setOpps((current) =>
        current.map((item) =>
          item.id === opp.id
            ? {
                ...item,
                stage: "Dead",
                status: "Inactive",
              }
            : item
        )
      );

      setOpenActionMenu(null);

      addToast(
        "Opportunity marked as dead.",
        "success"
      );
    } catch (error) {
      console.error(error);

      addToast(
        "Failed to mark opportunity as dead.",
        "error"
      );
    }
  };

  const handleSaveEdit = async (
    payload: Partial<Opportunity>
  ) => {
    if (!editingOpportunity) {
      return;
    }

    try {
      /*
       * Change this endpoint/body to match your API.
       */
      const res =
        await api.put(
          `/api/v1/leads/${editingOpportunity.id}`,
          {
            title:
              payload.customerName,

            organization_name:
              payload.company,

            customer_type:
              payload.customerType,

            priority:
              payload.priority,

            assigned_to_id:
              payload.ownerId,

            expected_closing_date:
              payload.expectedClosingDate,
          }
        );

      if (
        res.data?.success !== false
      ) {
        setOpps((current) =>
          current.map((item) =>
            item.id ===
            editingOpportunity.id
              ? {
                  ...item,
                  ...payload,
                }
              : item
          )
        );

        setEditingOpportunity(null);

        addToast(
          "Opportunity updated.",
          "success"
        );
      }
    } catch (error) {
      console.error(error);

      addToast(
        "Failed to update opportunity.",
        "error"
      );
    }
  };

  return (
    <div className="min-h-full bg-[#f5f6f8] dark:bg-[#020b14] text-slate-800 dark:text-white">
      <div className="space-y-5 p-1">

        {/* =========================================================
            PAGE HEADER
        ========================================================= */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">
              Opportunity
            </h1>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh opportunities"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-300"
            >
              <FiRefreshCw
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
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
                onClick={() =>
                  setShowPageMenu(
                    (value) => !value
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm hover:bg-slate-50 dark:bg-[#071929] dark:text-slate-300"
              >
                <FiMoreVertical
                  size={15}
                />
              </button>
            </div>

            {showPageMenu && (
              <div className="absolute right-0 top-10 z-[100] w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-[#17304a] dark:bg-[#071929]">
                <button
                  type="button"
                  onClick={handleExportData}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-xs font-medium hover:bg-slate-50 dark:hover:bg-[#0b2034]"
                >
                  <FiDownload
                    size={14}
                  />
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

          <KpiCard
            title="Total Orders"
            value={totalOrders}
            change="18.0%"
            positive
          />

          <KpiCard
            title="Total Negotiation"
            value={negotiationCount}
            change="12%"
            positive={false}
          />

          <KpiCard
            title="Closed Won Today"
            value={closedWonToday}
            change="15.0%"
            positive
          />

        </div>

        {/* =========================================================
            SEARCH + VIEW + FILTER + ADD
        ========================================================= */}
        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center">

          <div className="relative flex-1">
            <FiSearch
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              size={15}
            />

            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(
                  event.target.value
                );
                setPage(1);
              }}
              placeholder="Search Opportunities"
              className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-11 pr-4 text-xs outline-none placeholder:text-slate-400 focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2">

            <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-white p-1 dark:border-[#17304a] dark:bg-[#071929]">
              <button
                type="button"
                onClick={() =>
                  setViewMode("list")
                }
                className={`flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold ${
                  viewMode === "list"
                    ? "bg-[#f1f2f4] text-slate-900 shadow-sm dark:bg-[#10243a] dark:text-white"
                    : "text-slate-500"
                }`}
              >
                <FiList size={14} />
                List
              </button>

              <button
                type="button"
                onClick={() =>
                  setViewMode("board")
                }
                className={`flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold ${
                  viewMode === "board"
                    ? "bg-[#f1f2f4] text-slate-900 shadow-sm dark:bg-[#10243a] dark:text-white"
                    : "text-slate-500"
                }`}
              >
                <FiGrid size={14} />
                Board
              </button>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowFilters(
                  (value) => !value
                )
              }
              className={`relative flex h-11 w-11 items-center justify-center rounded-lg border bg-white ${
                showFilters ||
                activeFilterCount > 0
                  ? "border-[#233353] text-[#233353]"
                  : "border-slate-200 text-slate-600"
              } dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-300`}
            >
              <FiSliders
                size={17}
              />

              {activeFilterCount >
                0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#233353] px-1 text-[8px] font-bold text-white">
                  {
                    activeFilterCount
                  }
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setShowAddModal(true)
              }
              className="flex h-11 items-center gap-2 rounded-lg bg-[#233353] px-5 text-xs font-bold text-white shadow-sm hover:bg-[#18243a]"
            >
              <FiPlus size={16} />
              Add New Opportunity
            </button>
          </div>

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
            openActionMenu={
              openActionMenu
            }
            setOpenActionMenu={
              setOpenActionMenu
            }
            onEdit={(opp) => {
              setEditingOpportunity(
                opp
              );
              setOpenActionMenu(null);
            }}
            onMarkDead={
              handleMarkDead
            }
          />
        ) : (
          <ListView
            opportunities={paginated}
            filteredCount={
              filtered.length
            }
            page={page}
            pageSize={PAGE_SIZE}
            totalPages={totalPages}
            onPageChange={setPage}
            onDetails={openDetails}
            openActionMenu={
              openActionMenu
            }
            setOpenActionMenu={
              setOpenActionMenu
            }
            onEdit={(opp) => {
              setEditingOpportunity(
                opp
              );
              setOpenActionMenu(null);
            }}
            onMarkDead={
              handleMarkDead
            }
          />
        )}

        {/* =========================================================
            ADD OPPORTUNITY
        ========================================================= */}
        {showAddModal && (
          <AddOpportunityModal
            onClose={() =>
              setShowAddModal(false)
            }
            onSubmit={
              handleCreateOpportunity
            }
          />
        )}

        {/* =========================================================
            EDIT OPPORTUNITY
        ========================================================= */}
        {editingOpportunity && (
          <EditOpportunityModal
            opportunity={
              editingOpportunity
            }
            salesUsers={salesUsers}
            onClose={() =>
              setEditingOpportunity(
                null
              )
            }
            onSubmit={
              handleSaveEdit
            }
          />
        )}

        {/* =========================================================
            LEAD DETAILS DRAWER
        ========================================================= */}
        {showDetails &&
          selectedOpportunity && (
            <LeadDetailsDrawer
              opportunity={
                selectedOpportunity
              }
              onClose={() =>
                setShowDetails(false)
              }
              onEdit={() => {
                setShowDetails(false);
                setEditingOpportunity(
                  selectedOpportunity
                );
              }}
              onMarkDead={() => {
                setShowDetails(false);
                handleMarkDead(
                  selectedOpportunity
                );
              }}
            />
          )}
      </div>
    </div>
  );
}

/* ================================================================
   KPI CARD
================================================================ */

function KpiCard({
  title,
  value,
  change,
  positive,
}: {
  title: string;
  value: number;
  change: string;
  positive: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-[#17304a] dark:bg-[#071929]">
      <div
        className={`absolute right-3 top-3 rounded px-2 py-1 text-[10px] font-bold ${
          positive
            ? "bg-emerald-50 text-emerald-500"
            : "bg-rose-50 text-rose-500"
        }`}
      >
        {positive ? "↗" : "↘"}{" "}
        {change}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {title}
      </p>

      <h2 className="mt-2 text-[27px] font-semibold tracking-tight text-[#233353] dark:text-white">
        {value.toLocaleString("en-IN")}
      </h2>
    </div>
  );
}

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
  setFilters: React.Dispatch<
    React.SetStateAction<OpportunityFilters>
  >;
  salesUsers: SalesUser[];
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <div className="absolute right-0 top-14 z-[90] w-[455px] rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#17304a] dark:bg-[#071929]">

      <div className="mb-5 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">
          Date Range
        </span>

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
              setFilters(
                (current) => ({
                  ...current,
                  dateFrom:
                    event.target.value,
                })
              )
            }
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-2 text-xs outline-none dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
          />
        </div>

        <span className="text-slate-400">
          -
        </span>

        <div className="relative flex-1">
          <FiCalendar
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            size={15}
          />

          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              setFilters(
                (current) => ({
                  ...current,
                  dateTo:
                    event.target.value,
                })
              )
            }
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-2 text-xs outline-none dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">

        {/* Customer Type */}
        <FilterSelect
          label="Customer Type *"
          value={
            filters.customerType
          }
          placeholder="Select the customer type"
          options={CUSTOMER_TYPES}
          onChange={(value) =>
            setFilters(
              (current) => ({
                ...current,
                customerType:
                  value,
              })
            )
          }
        />

        {/* Assigned To */}
        <FilterSelect
          label="Assigned to"
          value={
            filters.assignedTo
          }
          placeholder="Select"
          options={salesUsers.map(
            (user) => user.id
          )}
          displayOptions={salesUsers.map(
            (user) => ({
              value: user.id,
              label: user.name,
            })
          )}
          onChange={(value) =>
            setFilters(
              (current) => ({
                ...current,
                assignedTo:
                  value,
              })
            )
          }
        />

        {/* Status */}
        <FilterSelect
          label="Status"
          value={
            filters.status
          }
          placeholder="Select Status"
          options={
            STATUS_OPTIONS
          }
          onChange={(value) =>
            setFilters(
              (current) => ({
                ...current,
                status:
                  value,
              })
            )
          }
        />

        {/* State */}
        <FilterSelect
          label="State"
          value={
            filters.state
          }
          placeholder="Select"
          options={STATES}
          onChange={(value) =>
            setFilters(
              (current) => ({
                ...current,
                state:
                  value,
              })
            )
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
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-medium text-slate-500">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="h-10 w-full appearance-none rounded-lg border border-slate-200 bg-white px-3 text-xs outline-none dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
      >
        <option value="">
          {placeholder}
        </option>

        {displayOptions
          ? displayOptions.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {option.label}
                </option>
              )
            )
          : options.map(
              (option) => (
                <option
                  key={option}
                  value={
                    option
                  }
                >
                  {option}
                </option>
              )
            )}
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
}: {
  opportunities: Opportunity[];
  onDetails: (
    opportunity: Opportunity
  ) => void;
  openActionMenu: string | null;
  setOpenActionMenu: (
    id: string | null
  ) => void;
  onEdit: (
    opportunity: Opportunity
  ) => void;
  onMarkDead: (
    opportunity: Opportunity
  ) => void;
}) {
  return (
    <div className="overflow-x-auto pb-5">
      <div className="grid min-w-[1080px] grid-cols-4 gap-4">

        {BOARD_STAGES.map(
          (stage) => {
            const stageDeals =
              opportunities.filter(
                (opp) =>
                  opp.stage ===
                  stage
              );

            const totalValue =
              stageDeals.reduce(
                (sum, deal) =>
                  sum +
                  deal.dealValue,
                0
              );

            return (
              <div
                key={stage}
                className="min-h-[530px] rounded-xl border border-slate-200 bg-white p-3 dark:border-[#17304a] dark:bg-[#071929]"
              >
                {/* Column Header */}
                <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#17304a]">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold">
                      {stage}
                    </span>

                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-500 dark:bg-blue-500/10">
                      {
                        stageDeals.length
                      }
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-slate-400">
                      {formatShortCurrency(
                        totalValue
                      )}
                    </span>

                    <button
                      type="button"
                      className="text-slate-500"
                    >
                      <FiMoreVertical
                        size={15}
                      />
                    </button>
                  </div>
                </div>

                {/* Cards */}
                <div className="space-y-2.5">
                  {stageDeals.map(
                    (opp) => (
                      <OpportunityBoardCard
                        key={opp.id}
                        opportunity={
                          opp
                        }
                        onDetails={
                          onDetails
                        }
                        openActionMenu={
                          openActionMenu
                        }
                        setOpenActionMenu={
                          setOpenActionMenu
                        }
                        onEdit={
                          onEdit
                        }
                        onMarkDead={
                          onMarkDead
                        }
                      />
                    )
                  )}

                  {!stageDeals.length && (
                    <div className="flex min-h-[130px] items-center justify-center rounded-lg border border-dashed border-slate-200 text-[10px] italic text-slate-400 dark:border-[#17304a]">
                      No opportunities
                    </div>
                  )}
                </div>
              </div>
            );
          }
        )}
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
}: {
  opportunity: Opportunity;
  onDetails: (
    opportunity: Opportunity
  ) => void;
  openActionMenu: string | null;
  setOpenActionMenu: (
    id: string | null
  ) => void;
  onEdit: (
    opportunity: Opportunity
  ) => void;
  onMarkDead: (
    opportunity: Opportunity
  ) => void;
}) {
  const progress =
    STAGE_PROGRESS[
      opportunity.stage
    ];

  return (
    <div className="relative rounded-xl border border-slate-200 bg-[#f8f8f8] p-3 shadow-sm transition hover:shadow-md dark:border-[#17304a] dark:bg-[#0b1d2e]">

      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() =>
            onDetails(
              opportunity
            )
          }
          className="min-w-0 text-left"
        >
          <p className="truncate text-[12px] font-bold text-slate-900 dark:text-white">
            {
              opportunity.customerName
            }
          </p>

          <p className="truncate text-[9px] font-medium text-slate-500">
            {opportunity.company}
          </p>
        </button>

        <ActionMenu
          opportunity={
            opportunity
          }
          open={
            openActionMenu ===
            opportunity.id
          }
          onToggle={() =>
            setOpenActionMenu(
              openActionMenu ===
                opportunity.id
                ? null
                : opportunity.id
            )
          }
          onEdit={() =>
            onEdit(
              opportunity
            )
          }
          onMarkDead={() =>
            onMarkDead(
              opportunity
            )
          }
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500">
          {formatShortCurrency(
            opportunity.dealValue
          )}
        </span>

        <PriorityBadge
          priority={
            opportunity.priority
          }
        />
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
          <Avatar
            name={
              opportunity.owner
            }
          />

          <span className="max-w-[95px] truncate text-[9px] font-medium text-slate-500">
            {opportunity.owner}
          </span>
        </div>

        <span className="text-[9px] text-slate-400">
          {formatDate(
            opportunity.expectedClosingDate ||
              opportunity.createdAt
          )}
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
}: {
  opportunities: Opportunity[];
  filteredCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (
    page: number
  ) => void;
  onDetails: (
    opportunity: Opportunity
  ) => void;
  openActionMenu: string | null;
  setOpenActionMenu: (
    id: string | null
  ) => void;
  onEdit: (
    opportunity: Opportunity
  ) => void;
  onMarkDead: (
    opportunity: Opportunity
  ) => void;
}) {
  const start =
    filteredCount === 0
      ? 0
      : (page - 1) *
          pageSize +
        1;

  const end = Math.min(
    page * pageSize,
    filteredCount
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#17304a] dark:bg-[#071929]">

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-white dark:border-[#17304a] dark:bg-[#071929]">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded"
                />
              </th>

              <TableHeader>
                Lead ID
              </TableHeader>

              <TableHeader>
                Customer Name
              </TableHeader>

              <TableHeader>
                Company
              </TableHeader>

              <TableHeader>
                Deal Value
              </TableHeader>

              <TableHeader>
                Assigned To
              </TableHeader>

              <TableHeader>
                Status
              </TableHeader>

              <TableHeader>
                Priority
              </TableHeader>

              <TableHeader align="right">
                Actions
              </TableHeader>
            </tr>
          </thead>

          <tbody>
            {opportunities.map(
              (opp) => (
                <tr
                  key={opp.id}
                  className="border-b border-slate-100 transition hover:bg-slate-50 dark:border-[#17304a]/70 dark:hover:bg-[#0b2034]"
                >
                  <td className="px-3 py-3.5">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded"
                    />
                  </td>

                  <td className="px-3 py-3.5">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      #
                      {
                        opp.leadId
                      }
                    </span>
                  </td>

                  <td className="px-3 py-3.5">
                    <button
                      type="button"
                      onClick={() =>
                        onDetails(
                          opp
                        )
                      }
                      className="text-left"
                    >
                      <p className="text-[12px] font-bold text-slate-900 hover:text-[#233353] dark:text-white">
                        {
                          opp.customerName
                        }
                      </p>

                      <p className="mt-0.5 text-[9px] text-slate-500">
                        {
                          opp.email
                        }
                      </p>

                      {opp.city && (
                        <p className="mt-0.5 flex items-center gap-1 text-[8px] text-slate-500">
                          <FiMapPin
                            size={8}
                          />
                          {
                            opp.city
                          }
                        </p>
                      )}
                    </button>
                  </td>

                  <td className="px-3 py-3.5">
                    <span className="block max-w-[130px] text-[11px] font-medium text-slate-700 dark:text-slate-300">
                      {
                        opp.company
                      }
                    </span>
                  </td>

                  <td className="px-3 py-3.5">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-white">
                      {formatShortCurrency(
                        opp.dealValue
                      )}
                    </span>
                  </td>

                  <td className="px-3 py-3.5">
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={
                          opp.owner
                        }
                      />

                      <span className="max-w-[80px] truncate text-[10px] font-medium text-slate-600 dark:text-slate-300">
                        {
                          opp.owner
                        }
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-3.5">
                    <StatusBadge
                      status={
                        opp.stage
                      }
                    />
                  </td>

                  <td className="px-3 py-3.5">
                    <PriorityBadge
                      priority={
                        opp.priority
                      }
                    />
                  </td>

                  <td className="px-3 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        title="Call"
                        onClick={() =>
                          onDetails(
                            opp
                          )
                        }
                        className="text-slate-600 transition hover:text-[#233353] dark:text-slate-300"
                      >
                        <FiPhone
                          size={14}
                        />
                      </button>

                      <ActionMenu
                        opportunity={
                          opp
                        }
                        open={
                          openActionMenu ===
                          opp.id
                        }
                        onToggle={() =>
                          setOpenActionMenu(
                            openActionMenu ===
                              opp.id
                              ? null
                              : opp.id
                          )
                        }
                        onEdit={() =>
                          onEdit(
                            opp
                          )
                        }
                        onMarkDead={() =>
                          onMarkDead(
                            opp
                          )
                        }
                      />
                    </div>
                  </td>
                </tr>
              )
            )}

            {opportunities.length ===
              0 && (
              <tr>
                <td
                  colSpan={9}
                  className="py-16 text-center"
                >
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <FiAlertCircle
                      size={24}
                    />

                    <p className="text-xs font-medium">
                      No opportunities
                      found.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-[#17304a]">
        <p className="text-[10px] text-slate-500">
          Showing{" "}
          {start}-{end} of{" "}
          {filteredCount}{" "}
          opportunities
        </p>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page === 1}
            onClick={() =>
              onPageChange(
                Math.max(
                  1,
                  page - 1
                )
              )
            }
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 disabled:opacity-30"
          >
            <FiChevronLeft
              size={14}
            />
          </button>

          {Array.from(
            {
              length: Math.min(
                totalPages,
                3
              ),
            },
            (_, index) =>
              index + 1
          ).map(
            (pageNumber) => (
              <button
                key={
                  pageNumber
                }
                type="button"
                onClick={() =>
                  onPageChange(
                    pageNumber
                  )
                }
                className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-semibold ${
                  page ===
                  pageNumber
                    ? "bg-[#233353] text-white"
                    : "border border-slate-200 bg-white text-slate-600 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-300"
                }`}
              >
                {
                  pageNumber
                }
              </button>
            )
          )}

          <button
            type="button"
            disabled={
              page ===
              totalPages
            }
            onClick={() =>
              onPageChange(
                Math.min(
                  totalPages,
                  page + 1
                )
              )
            }
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 disabled:opacity-30"
          >
            <FiChevronRight
              size={14}
            />
          </button>
        </div>
      </div>
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
        align === "right"
          ? "text-right"
          : "text-left"
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
}: {
  opportunity: Opportunity;
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onMarkDead: () => void;
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
        <FiMoreVertical
          size={15}
        />
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
            <FiEdit2
              size={12}
            />
            Edit
          </button>

          {opportunity.stage !==
            "Dead" && (
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
}: {
  opportunity: Opportunity;
  onClose: () => void;
  onEdit: () => void;
  onMarkDead: () => void;
}) {
  const [showMenu, setShowMenu] =
    useState(false);

  const activities =
    opportunity.activityHistory?.length
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
              formatDate(
                opportunity.createdAt
              ),
            time: "10:00 AM",
          },
          {
            id: "call",
            type: "Outgoing Call" as const,
            title: "Outgoing Call",
            description:
              "Discussed technical specifications and requirements.",
            date: "Yesterday",
          },
          {
            id: "form",
            type: "Form Submission" as const,
            title: "Form Submission",
            description:
              'Lead entered through "Synergy" landing page.',
            date:
              formatDate(
                opportunity.createdAt
              ),
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

              <h2 className="text-[16px] font-semibold">
                Lead Details
              </h2>
            </div>

            <button
              type="button"
              className="rounded-lg bg-[#233353] px-4 py-2 text-[11px] font-semibold text-white"
            >
              Create Sales Order
            </button>
          </div>

          {/* Pipeline Progress */}
          <div className="grid grid-cols-5 border-t border-slate-200 dark:border-[#17304a]">
            {[
              "New",
              "Open",
              "In Progress",
              "Open Deal",
              "Closed",
            ].map(
              (stage, index) => (
                <div
                  key={stage}
                  className={`flex h-8 items-center justify-center gap-1 text-[9px] ${
                    index <
                    3
                      ? "bg-emerald-50 text-emerald-600"
                      : index ===
                        3
                      ? "bg-amber-50 text-amber-600"
                      : "bg-slate-50 text-slate-400"
                  }`}
                >
                  {index <
                  3 ? (
                    <FiCheckCircle
                      size={11}
                    />
                  ) : index ===
                    3 ? (
                    <FiClock
                      size={11}
                    />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full border border-slate-400" />
                  )}

                  {stage}
                </div>
              )
            )}
          </div>
        </div>

        {/* Customer */}
        <div className="flex items-start justify-between px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600 dark:bg-[#17304a] dark:text-white">
              {getInitials(
                opportunity.customerName
              )}
            </div>

            <div>
              <h3 className="text-[18px] font-semibold">
                {
                  opportunity.customerName
                }
              </h3>

              <p className="text-[11px] text-slate-500">
                {
                  opportunity.designation ||
                  "IT Director"
                }{" "}
                @{" "}
                {
                  opportunity.company
                }
              </p>

              <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
                {opportunity.email && (
                  <span className="flex items-center gap-1">
                    <FiMail
                      size={11}
                    />
                    {
                      opportunity.email
                    }
                  </span>
                )}

                {opportunity.phone && (
                  <span className="flex items-center gap-1">
                    <FiPhone
                      size={11}
                    />
                    {
                      opportunity.phone
                    }
                  </span>
                )}
              </div>

              {opportunity.state && (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                  <FiMapPin
                    size={11}
                  />
                  {
                    opportunity.state
                  }
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-[#17304a] dark:text-slate-300"
            >
              <FiMessageSquare
                size={16}
              />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setShowMenu(
                    (value) =>
                      !value
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 dark:border-[#17304a] dark:text-slate-300"
              >
                <FiMoreVertical
                  size={16}
                />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-10 z-50 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-[#17304a] dark:bg-[#071929]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(
                        false
                      );
                      onEdit();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] hover:bg-slate-50 dark:hover:bg-[#0b2034]"
                  >
                    <FiEdit2
                      size={12}
                    />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(
                        false
                      );
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
            <h4 className="text-[12px] font-bold">
              Activity History
            </h4>

            <button
              type="button"
              className="text-[10px] font-medium text-slate-500"
            >
              + Log Activity
            </button>
          </div>

          <div className="relative ml-2 border-l border-slate-200 pl-5 dark:border-[#17304a]">
            {activities.map(
              (activity) => (
                <div
                  key={activity.id}
                  className="relative mb-5"
                >
                  <span className="absolute -left-[25px] top-2 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#233353] dark:border-[#071929]" />

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#17304a] dark:bg-[#0b1d2e]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h5 className="text-[11px] font-bold">
                          {
                            activity.title
                          }
                        </h5>

                        <p className="mt-1 text-[10px] leading-5 text-slate-500">
                          {
                            activity.description
                          }
                        </p>
                      </div>

                      <span className="whitespace-nowrap text-[9px] text-slate-400">
                        {
                          activity.date
                        }
                        {activity.time
                          ? `, ${activity.time}`
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Opportunity information */}
          <div className="mt-8 grid grid-cols-2 gap-3">
            <InfoBox
              label="Lead ID"
              value={
                opportunity.leadId
              }
            />

            <InfoBox
              label="Deal Value"
              value={formatCurrency(
                opportunity.dealValue
              )}
            />

            <InfoBox
              label="Customer Type"
              value={
                opportunity.customerType
              }
            />

            <InfoBox
              label="Priority"
              value={
                opportunity.priority
              }
            />
          </div>
        </div>
      </aside>
    </div>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-[#17304a]">
      <p className="text-[9px] text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-[11px] font-semibold">
        {value || "-"}
      </p>
    </div>
  );
}

/* ================================================================
   ADD OPPORTUNITY MODAL
================================================================ */

function AddOpportunityModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (
    payload: Record<string, any>
  ) => Promise<void>;
}) {
  const [customerType, setCustomerType] =
    useState<CustomerType>(
      "Distributor"
    );

  const [organizationName, setOrganizationName] =
    useState("");

  const [organizationWebsite, setOrganizationWebsite] =
    useState("");

  const [officeAddress, setOfficeAddress] =
    useState("");

  const [city, setCity] =
    useState("");

  const [state, setState] =
    useState("");

  const [pinCode, setPinCode] =
    useState("");

  const [country, setCountry] =
    useState("India");

  const [gstNumber, setGstNumber] =
    useState("");

  const [panNumber, setPanNumber] =
    useState("");

  const [coiNumber, setCoiNumber] =
    useState("");

  const [contactName, setContactName] =
    useState("");

  const [designation, setDesignation] =
    useState("");

  const [mobileNumber, setMobileNumber] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [priority, setPriority] =
    useState<Priority>("Medium");

  const [expectedClosingDate, setExpectedClosingDate] =
    useState("");

  const [remarks, setRemarks] =
    useState("");

  const [purchaseTimeline, setPurchaseTimeline] =
    useState("");

  const [productItems, setProductItems] =
    useState<ProductItem[]>([
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

  const [submitting, setSubmitting] =
    useState(false);

  const totalQty =
    productItems.reduce(
      (sum, item) =>
        sum + item.qty,
      0
    );

  const totalValue =
    productItems.reduce(
      (sum, item) =>
        sum +
        item.qty *
          item.price,
      0
    );

  const updateProductQty = (
    index: number,
    delta: number
  ) => {
    setProductItems(
      (current) =>
        current.map(
          (item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  qty: Math.max(
                    0,
                    item.qty +
                      delta
                  ),
                }
              : item
        )
    );
  };

  const handleSubmit = async (
    event: React.FormEvent
  ) => {
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
        remarks,
        productItems:
          productItems.filter(
            (item) =>
              item.qty > 0
          ),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/30"
        onClick={onClose}
      />

      <div className="relative mx-auto my-6 w-[calc(100%-24px)] max-w-[1120px]">
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#071929]">

          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-[#17304a]">
            <div>
              <h2 className="text-[18px] font-semibold">
                New Opportunity
              </h2>

              <p className="mt-0.5 text-[10px] text-slate-400">
                Opportunity{" "}
                <span className="mx-1">
                  ›
                </span>{" "}
                New
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#10243a]"
            >
              <FiX size={17} />
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="max-h-[78vh] overflow-y-auto"
          >
            <div className="grid grid-cols-1 gap-3 bg-[#f5f6f8] p-4 lg:grid-cols-[1fr_310px] dark:bg-[#020b14]">

              {/* LEFT */}
              <div className="space-y-3">

                {/* Customer Information */}
                <FormSection
                  icon={
                    <FiUser
                      size={17}
                    />
                  }
                  title="Customer Information"
                >
                  <div className="grid grid-cols-1 gap-4">
                    <FormSelect
                      label="Customer Type *"
                      value={
                        customerType
                      }
                      options={
                        CUSTOMER_TYPES
                      }
                      onChange={(
                        value
                      ) =>
                        setCustomerType(
                          value as CustomerType
                        )
                      }
                    />

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <FormInput
                        label="Organization Name *"
                        value={
                          organizationName
                        }
                        onChange={
                          setOrganizationName
                        }
                        placeholder="Acme Solutions Pvt. Ltd."
                      />

                      <FormInput
                        label="Organization Website *"
                        value={
                          organizationWebsite
                        }
                        onChange={
                          setOrganizationWebsite
                        }
                        placeholder="www.example.com"
                      />
                    </div>
                  </div>
                </FormSection>

                {/* Organization Details */}
                <FormSection
                  icon={
                    <FiMapPin
                      size={17}
                    />
                  }
                  title="Organization Details"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FormInput
                      label="Office Address *"
                      value={
                        officeAddress
                      }
                      onChange={
                        setOfficeAddress
                      }
                      placeholder="42, MG Road, Building A, Suite 304"
                    />

                    <FormInput
                      label="City *"
                      value={city}
                      onChange={setCity}
                      placeholder="Bengaluru"
                    />

                    <FormInput
                      label="State / Province *"
                      value={state}
                      onChange={setState}
                      placeholder="Karnataka"
                    />

                    <FormInput
                      label="PIN / ZIP Code *"
                      value={pinCode}
                      onChange={
                        setPinCode
                      }
                      placeholder="560001"
                    />

                    <FormInput
                      label="Country *"
                      value={country}
                      onChange={
                        setCountry
                      }
                      placeholder="India"
                    />
                  </div>
                </FormSection>

                {/* Registration */}
                <FormSection
                  icon={
                    <FiCheckCircle
                      size={17}
                    />
                  }
                  title="Registration & Compliance"
                >
                  <div className="space-y-3">
                    <DocumentInput
                      label="GST Number"
                      value={
                        gstNumber
                      }
                      onChange={
                        setGstNumber
                      }
                      placeholder="Enter GSTIN"
                    />

                    <DocumentInput
                      label="PAN Number"
                      value={
                        panNumber
                      }
                      onChange={
                        setPanNumber
                      }
                      placeholder="Enter PAN"
                    />

                    <DocumentInput
                      label="COI (Certificate of Incorporation)"
                      value={
                        coiNumber
                      }
                      onChange={
                        setCoiNumber
                      }
                      placeholder="COI Number"
                    />
                  </div>
                </FormSection>

                {/* Primary Contact */}
                <FormSection
                  icon={
                    <FiUser
                      size={17}
                    />
                  }
                  title="Primary Contact"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FormInput
                      label="Full Name *"
                      value={
                        contactName
                      }
                      onChange={
                        setContactName
                      }
                      placeholder="Arjun Mehta"
                    />

                    <FormInput
                      label="Designation *"
                      value={
                        designation
                      }
                      onChange={
                        setDesignation
                      }
                      placeholder="Procurement Manager"
                    />

                    <FormInput
                      label="Mobile Number *"
                      value={
                        mobileNumber
                      }
                      onChange={
                        setMobileNumber
                      }
                      placeholder="9876543210"
                    />

                    <FormInput
                      label="Email Address *"
                      value={
                        email
                      }
                      onChange={
                        setEmail
                      }
                      placeholder="arjun@example.com"
                      type="email"
                    />
                  </div>
                </FormSection>
              </div>

              {/* RIGHT */}
              <div className="space-y-3">

                {/* Product Interest */}
                <FormSection
                  icon={
                    <FiShoppingCart
                      size={17}
                    />
                  }
                  title="Product Interest"
                >
                  <p className="mb-2 text-[10px] text-slate-500">
                    Product Categories
                  </p>

                  <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-[#17304a]">
                    {productItems.map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          key={
                            item.name
                          }
                          className="flex items-center justify-between border-b border-slate-100 px-3 py-2 last:border-b-0 dark:border-[#17304a]"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={
                                item.qty >
                                0
                              }
                              onChange={() =>
                                updateProductQty(
                                  index,
                                  item.qty >
                                    0
                                    ? -item.qty
                                    : 1
                                )
                              }
                              className="h-3.5 w-3.5"
                            />

                            <span className="text-[10px] font-medium">
                              {
                                item.name
                              }
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateProductQty(
                                  index,
                                  -1
                                )
                              }
                              className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-slate-500 dark:border-[#17304a]"
                            >
                              -
                            </button>

                            <span className="w-5 text-center text-[10px]">
                              {
                                item.qty
                              }
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                updateProductQty(
                                  index,
                                  1
                                )
                              }
                              className="flex h-5 w-5 items-center justify-center rounded border border-slate-200 text-slate-500 dark:border-[#17304a]"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )
                    )}

                    <div className="flex items-center justify-between bg-slate-50 px-3 py-2 dark:bg-[#0b2034]">
                      <span className="text-[10px] font-semibold">
                        Total
                      </span>

                      <span className="text-[11px] font-bold">
                        {
                          totalQty
                        }
                      </span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <FormInput
                      label="Total Est. Value *"
                      value={
                        totalValue
                          ? String(
                              totalValue
                            )
                          : ""
                      }
                      onChange={() => {}}
                      placeholder="₹ 0.00"
                      type="number"
                    />
                  </div>

                  <FormSelect
                    label="Purchase Timeline *"
                    value={
                      purchaseTimeline
                    }
                    options={[
                      "Immediate",
                      "Within 30 Days",
                      "1 - 3 Months",
                      "3 - 6 Months",
                      "6+ Months",
                    ]}
                    onChange={
                      setPurchaseTimeline
                    }
                  />
                </FormSection>

                {/* Sales Information */}
                <FormSection
                  icon={
                    <FiUser
                      size={17}
                    />
                  }
                  title="Sales Information"
                >
                  <FormSelect
                    label="Lead Source *"
                    value="Website"
                    options={[
                      "Website",
                      "Referral",
                      "Email",
                      "Phone",
                      "Exhibition",
                      "Partner",
                    ]}
                    onChange={() => {}}
                  />

                  <FormSelect
                    label="Assigned to *"
                    value=""
                    options={[
                      "Sales Team",
                    ]}
                    onChange={() => {}}
                  />

                  <div className="mt-3">
                    <label className="mb-1.5 block text-[10px] font-medium text-slate-500">
                      Priority
                    </label>

                    <div className="flex gap-2">
                      {(
                        [
                          "High",
                          "Medium",
                          "Low",
                        ] as Priority[]
                      ).map(
                        (item) => (
                          <button
                            type="button"
                            key={
                              item
                            }
                            onClick={() =>
                              setPriority(
                                item
                              )
                            }
                            className={`rounded-md px-3 py-1.5 text-[10px] font-semibold ${
                              priority ===
                              item
                                ? item ===
                                  "High"
                                  ? "bg-rose-50 text-rose-500"
                                  : item ===
                                    "Medium"
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-slate-100 text-slate-600"
                                : "bg-slate-100 text-slate-500 dark:bg-[#10243a]"
                            }`}
                          >
                            {
                              item
                            }
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <FormInput
                      label="Expected Closing Date"
                      type="date"
                      value={
                        expectedClosingDate
                      }
                      onChange={
                        setExpectedClosingDate
                      }
                    />
                  </div>
                </FormSection>

                {/* Requirements */}
                <FormSection
                  icon={
                    <FiFileText
                      size={17}
                    />
                  }
                  title="Requirements & Files"
                >
                  <label className="mb-1.5 block text-[10px] font-medium text-slate-500">
                    Remarks
                  </label>

                  <textarea
                    value={remarks}
                    onChange={(event) =>
                      setRemarks(
                        event.target.value
                      )
                    }
                    rows={5}
                    placeholder="Enter specific hardware requirements or customization requests..."
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white p-3 text-[10px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929]"
                  />

                  <div className="mt-3">
                    <label className="mb-1.5 block text-[10px] font-medium text-slate-500">
                      Attachments
                    </label>

                    <div className="flex min-h-[95px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 text-center dark:border-[#31506b]">
                      <FiUploadCloud
                        size={19}
                        className="text-slate-400"
                      />

                      <p className="mt-1 text-[10px] text-slate-500">
                        Drop files or
                        click to
                        upload
                      </p>

                      <p className="text-[8px] text-slate-400">
                        PDF, DOC,
                        XLS up to
                        10MB
                      </p>
                    </div>
                  </div>
                </FormSection>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4 dark:border-[#17304a] dark:bg-[#071929]">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:border-[#17304a] dark:text-slate-300"
              >
                Cancel
              </button>

              <button
                type="button"
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:border-[#17304a] dark:text-slate-300"
              >
                Save as Draft
              </button>

              <button
                type="submit"
                disabled={
                  submitting
                }
                className="rounded-lg bg-[#233353] px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {submitting
                  ? "Saving..."
                  : "Save Opportunity"}
              </button>
            </div>
          </form>
        </div>
      </div>
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
  onSubmit: (
    payload: Partial<Opportunity>
  ) => Promise<void>;
}) {
  const [customerName, setCustomerName] =
    useState(
      opportunity.customerName
    );

  const [company, setCompany] =
    useState(
      opportunity.company
    );

  const [customerType, setCustomerType] =
    useState(
      opportunity.customerType
    );

  const [priority, setPriority] =
    useState(
      opportunity.priority
    );

  const [ownerId, setOwnerId] =
    useState(
      opportunity.ownerId ||
        ""
    );

  const [expectedClosingDate, setExpectedClosingDate] =
    useState(
      opportunity.expectedClosingDate ||
        ""
    );

  const submit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    await onSubmit({
      customerName,
      company,
      customerType,
      priority,
      ownerId,
      expectedClosingDate,
      owner:
        salesUsers.find(
          (user) =>
            user.id ===
            ownerId
        )?.name ||
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
          <h2 className="text-[16px] font-semibold">
            Edit Opportunity
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-500"
          >
            <FiX size={17} />
          </button>
        </div>

        <div className="space-y-4">
          <FormInput
            label="Customer Name"
            value={
              customerName
            }
            onChange={
              setCustomerName
            }
          />

          <FormInput
            label="Company"
            value={company}
            onChange={
              setCompany
            }
          />

          <FormSelect
            label="Customer Type"
            value={
              customerType
            }
            options={
              CUSTOMER_TYPES
            }
            onChange={(
              value
            ) =>
              setCustomerType(
                value as CustomerType
              )
            }
          />

          <FormSelect
            label="Assigned To"
            value={
              ownerId
            }
            options={
              salesUsers.map(
                (user) =>
                  user.id
              )
            }
            displayOptions={salesUsers.map(
              (user) => ({
                value:
                  user.id,
                label:
                  user.name,
              })
            )}
            onChange={
              setOwnerId
            }
          />

          <FormSelect
            label="Priority"
            value={
              priority
            }
            options={[
              "High",
              "Medium",
              "Low",
            ]}
            onChange={(
              value
            ) =>
              setPriority(
                value as Priority
              )
            }
          />

          <FormInput
            label="Expected Closing Date"
            type="date"
            value={
              expectedClosingDate
            }
            onChange={
              setExpectedClosingDate
            }
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

function FormSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-[#17304a] dark:bg-[#071929]">
      <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-[#17304a]">
        <span className="text-slate-600 dark:text-slate-300">
          {icon}
        </span>

        <h3 className="text-[13px] font-semibold">
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
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
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
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
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
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-medium text-slate-500">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[10px] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
      >
        <option value="">
          Select here
        </option>

        {displayOptions
          ? displayOptions.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {
                    option.label
                  }
                </option>
              )
            )
          : options.map(
              (option) => (
                <option
                  key={option}
                  value={
                    option
                  }
                >
                  {option}
                </option>
              )
            )}
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
  onChange: (
    value: string
  ) => void;
  placeholder?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_145px] items-end gap-3">
      <FormInput
        label={label}
        value={value}
        onChange={onChange}
        placeholder={
          placeholder
        }
      />

      <button
        type="button"
        className="mb-0 flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 text-[10px] font-medium text-slate-400 dark:border-[#31506b]"
      >
        <FiUploadCloud
          size={14}
        />
        Upload Doc
      </button>
    </div>
  );
}

/* ================================================================
   BADGES / AVATAR
================================================================ */

function Avatar({
  name,
}: {
  name: string;
}) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[8px] font-bold text-slate-600 dark:bg-[#17304a] dark:text-slate-200">
      {getInitials(name)}
    </span>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: Priority;
}) {
  const styles =
    priority === "High"
      ? "border-rose-400 text-rose-500"
      : priority === "Low"
      ? "border-amber-400 text-amber-500"
      : "border-blue-400 text-blue-500";

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold ${styles}`}
    >
      {priority}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status: OpportunityStage;
}) {
  const styles =
    status === "Negotiation"
      ? "bg-slate-100 text-slate-600"
      : status ===
        "Proposal Sent"
      ? "bg-slate-100 text-slate-600"
      : status ===
        "Demo Scheduled"
      ? "bg-slate-100 text-slate-600"
      : status ===
        "Closed Won"
      ? "bg-emerald-50 text-emerald-600"
      : status === "Dead"
      ? "bg-rose-50 text-rose-500"
      : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-[9px] font-medium ${styles}`}
    >
      {status}
    </span>
  );
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