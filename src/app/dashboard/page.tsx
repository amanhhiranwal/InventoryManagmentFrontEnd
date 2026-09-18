"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiDownload, FiMoreVertical, FiRefreshCw } from "react-icons/fi";
import { LuEllipsisVertical, LuMapPin } from "react-icons/lu";

import { StatusPill } from "@/components/crm/Pill";
import {
  getSalesOrdersApi,
  salesOrderStatusLabel,
  type SalesOrderModel,
} from "@/features/salesOrders/api/salesOrders.api";
import {
  compactMoney,
  formatDate,
} from "@/features/proformaInvoices/components/ProformaParts";

import { getLeadsApi, Lead } from "@/features/workflows/api/workflows.api";

import {
  getOpportunitiesApi,
  type OpportunityModel,
} from "@/features/opportunities/api/opportunities.api";
import {
  getQuotationsApi,
  quotationStatusLabel,
  type QuotationModel,
} from "@/features/quotations/api/quotations.api";

import { useUIStore } from "@/lib/store/ui.store";

/* ============================================================
   TYPES
============================================================ */

type DashboardLead = Lead & {
  region?: string;
  state?: string;
  revenue?: number;
  units?: number;

  customer_name?: string;
  customer?: string;
  product_category?: string;
};

type SalesPerson = {
  name: string;
  revenue: number;
  units: number;
  deals: number;
  conversion: number;
};

type ChartMode = "monthly" | "yearly";

type ChartPoint = {
  label: string;
  year: number;
  revenue: number;
  units: number;
};

type PipelineStage = {
  key: string;
  label: string;
  count: number;
  revenue: number;
};

type RegionalData = {
  /** Short code shown on the bar, e.g. "MH". */
  name: string;
  /** Full state name, e.g. "Maharashtra". */
  state: string;
  revenue: number;
};

type ActivityItem = {
  id: string;
  title: string;
  person: string;
  detail: string;
  value: number;
  date: Date | null;
};

type ProductData = {
  name: string;
  units: number;
  percentage: number;
};

/* ============================================================
   DASHBOARD MENU TYPES
============================================================ */

type MenuType =
  | "dashboard"
  | "revenue"
  | "product"
  | "pipeline"
  | "regional"
  | "salesTeam"
  | "activity"
  | "orders"
  | null;

/* ============================================================
   CONSTANTS
============================================================ */

const MONTH_NAMES = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const PIPELINE_STAGES = [
  {
    key: "new",
    label: "New Leads",
  },
  {
    key: "qualified",
    label: "Qualified",
  },
  {
    key: "proposal",
    label: "Proposal Sent",
  },
  {
    key: "negotiation",
    label: "Negotiation",
  },
  {
    key: "won",
    label: "Won",
  },
];

/* ============================================================
   HELPERS
============================================================ */

function formatCurrency(value: number) {
  if (!value || Number.isNaN(value)) {
    return "₹0";
  }

  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  }

  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)} L`;
  }

  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}K`;
  }

  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatCompactCurrency(value: number) {
  if (!value || Number.isNaN(value)) {
    return "₹0";
  }

  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(1)}Cr`;
  }

  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(0)}L`;
  }

  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(0)}K`;
  }

  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function getLeadValue(lead: DashboardLead) {
  if (typeof lead.revenue === "number") {
    return lead.revenue;
  }

  if (!lead.quotation_items?.length) {
    return 0;
  }

  return lead.quotation_items.reduce((total, item) => {
    const qty = Number(item.qty || 0);
    const price = Number(item.price || 0);

    return total + qty * price;
  }, 0);
}





function getLeadCompanyName(lead: DashboardLead) {
  return lead.customer_name || lead.customer || "Lead";
}

function getPercentageChange(current: number, previous: number) {
  if (!previous) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}


function getRegionLabel(value?: string) {
  if (!value) {
    return "—";
  }

  const normalized = value.trim().toLowerCase();

  const stateMap: Record<string, string> = {
    maharashtra: "MH",
    mh: "MH",

    delhi: "DL",
    "new delhi": "DL",
    dl: "DL",

    gujarat: "GJ",
    gj: "GJ",

    karnataka: "KA",
    ka: "KA",

    tamilnadu: "TN",
    "tamil nadu": "TN",
    tamil: "TN",
    tn: "TN",

    "uttar pradesh": "UP",
    up: "UP",

    rajasthan: "RJ",
    rj: "RJ",

    telangana: "TG",
    tg: "TG",

    "west bengal": "WB",
    wb: "WB",

    kerala: "KL",
    kl: "KL",
  };

  return stateMap[normalized] || value;
}

/* Recent Orders lists real sales orders, with the columns of the Sales Order
   list page. */

type OrderSortKey =
  | "order"
  | "customer"
  | "company"
  | "value"
  | "assigned"
  | "date"
  | "status";

const orderNumber = (order: SalesOrderModel) =>
  `#${order.order_number || `SO-${order.id}`}`;

const orderContactEmail = (order: SalesOrderModel) => {
  const contact = (order.customer_information?.primary_contact || {}) as Record<
    string,
    unknown
  >;

  return typeof contact.email === "string" ? contact.email : "";
};

const orderDate = (order: SalesOrderModel) =>
  order.order_date || order.created_at || "";

const orderAssignee = (order: SalesOrderModel) =>
  order.assigned_to || order.sales_executive || "Unassigned";

const ORDER_SORT_VALUE: Record<
  OrderSortKey,
  (order: SalesOrderModel) => string | number
> = {
  order: (order) => order.id,
  customer: (order) => order.customer_name.toLowerCase(),
  company: (order) => (order.company_name || "").toLowerCase(),
  value: (order) => Number(order.grand_total || 0),
  assigned: (order) => orderAssignee(order).toLowerCase(),
  date: (order) => new Date(orderDate(order) || 0).getTime(),
  status: (order) => salesOrderStatusLabel(order.status),
};

/* Orders that count as business done: confirmed onwards, not drafts or
   cancelled ones. Revenue, units, regions and the team are measured on these. */
const BOOKED_ORDER_STATUSES = ["CONFIRMED", "ON_HOLD", "RELEASED", "COMPLETED"];

const isBookedOrder = (order: SalesOrderModel) =>
  BOOKED_ORDER_STATUSES.includes(order.status);

const orderDateValue = (order: SalesOrderModel) => {
  const date = new Date(orderDate(order) || 0);

  return Number.isNaN(date.getTime()) || !orderDate(order) ? null : date;
};

type OrderLine = {
  qty?: number | null;
  quantity_case?: number | null;
  product?: string | null;
  item?: string | null;
  description?: string | null;
};

/* Lines store their quantity in qty or, from the order form, quantity_case. */
const lineUnits = (line: OrderLine) =>
  Number(line.qty || 0) || Number(line.quantity_case || 0);

const orderUnits = (order: SalesOrderModel) =>
  (order.items || []).reduce(
    (total, line) => total + lineUnits(line as OrderLine),
    0,
  );

const lineProduct = (line: OrderLine) =>
  line.product || line.item || line.description || "Other";

const escapeSvgText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ============================================================
   SVG DOWNLOAD
============================================================ */

function downloadSvg(filename: string, svgMarkup: string) {
  const blob = new Blob([svgMarkup], {
    type: "image/svg+xml;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);

  link.click();

  link.remove();

  URL.revokeObjectURL(url);
}

/* ============================================================
   REUSABLE DASHBOARD MENU
============================================================ */

type DashboardMenuProps = {
  menu: Exclude<MenuType, null>;
  openMenu: MenuType;
  setOpenMenu: Dispatch<SetStateAction<MenuType>>;
  onExport: () => void;
  onDownloadChart?: () => void;
  /** White square trigger, as the page-level menu in the design. */
  boxed?: boolean;
};

function DashboardMenu({
  menu,
  openMenu,
  setOpenMenu,
  onExport,
  onDownloadChart,
  boxed = false,
}: DashboardMenuProps) {
  const isOpen = openMenu === menu;

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label="More options"
        onClick={() => {
          setOpenMenu(isOpen ? null : menu);
        }}
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          boxed
            ? "bg-white text-slate-700 hover:bg-slate-50 dark:bg-[#051422] dark:text-slate-200 dark:hover:bg-[#071929]"
            : "text-slate-700 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-[#071929] dark:hover:text-slate-200"
        }`}
      >
        <FiMoreVertical size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-9 z-50 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-[#0d2336] dark:bg-[#051422]">
          <button
            type="button"
            onClick={() => {
              setOpenMenu(null);
              onExport();
            }}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#071929]"
          >
            <FiDownload size={14} />
            Export Data
          </button>

          {onDownloadChart && (
            <button
              type="button"
              onClick={() => {
                setOpenMenu(null);
                onDownloadChart();
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#071929]"
            >
              <FiDownload size={14} />
              Download Chart
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function OrderSortTh({
  label,
  sortKey,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: OrderSortKey;
  sort: { key: OrderSortKey; dir: 1 | -1 } | null;
  onSort: (key: OrderSortKey) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;

  return (
    <th
      aria-sort={
        active ? (sort!.dir === 1 ? "ascending" : "descending") : undefined
      }
      className={`border-r border-slate-100 px-3 py-3 text-left dark:border-[#0d2336] ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="flex w-full items-center justify-between gap-2 text-xs font-normal text-[#777777] dark:text-slate-400"
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

/* ============================================================
   COMPONENT
============================================================ */

export default function Dashboard() {
  const { addToast } = useUIStore();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dbLeads, setDbLeads] = useState<DashboardLead[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityModel[]>([]);
  const [quotations, setQuotations] = useState<QuotationModel[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrderModel[]>([]);

  const [chartMode, setChartMode] = useState<ChartMode>("yearly");

  const [activeChartIndex, setActiveChartIndex] = useState(0);

  const [hoveredChartIndex, setHoveredChartIndex] = useState<number | null>(
    null,
  );

  const [openMenu, setOpenMenu] = useState<MenuType>(null);

  const [showAllOrders, setShowAllOrders] = useState(false);

  const [orderSort, setOrderSort] = useState<{
    key: OrderSortKey;
    dir: 1 | -1;
  } | null>(null);

  const [orderRowMenu, setOrderRowMenu] = useState<number | null>(null);

  const [hoveredPipelineIndex, setHoveredPipelineIndex] = useState<number | null>(
  null, );


  const chartRef = useRef<SVGSVGElement | null>(null);

  /* ==========================================================
     FETCH DATA
  ========================================================== */

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);

      const [leadsResult, opportunitiesResult, ordersResult, quotationsResult] =
        await Promise.allSettled([
          getLeadsApi(),
          getOpportunitiesApi(),
          getSalesOrdersApi(),
          getQuotationsApi(),
        ]);

      setOpportunities(
        opportunitiesResult.status === "fulfilled"
          ? opportunitiesResult.value || []
          : [],
      );

      setQuotations(
        quotationsResult.status === "fulfilled" ? quotationsResult.value || [] : [],
      );

      if (ordersResult.status === "fulfilled") {
        setSalesOrders(ordersResult.value || []);
      } else {
        console.error("Failed to load sales orders:", ordersResult.reason);

        setSalesOrders([]);
      }

      if (leadsResult.status === "fulfilled") {
        setDbLeads((leadsResult.value || []) as DashboardLead[]);
      } else {
        console.error("Failed to load leads:", leadsResult.reason);

        setDbLeads([]);
      }

    } catch (error) {
      console.error(error);

      addToast("Unable to load dashboard data.", "error");
    } finally {
      setLoading(false);

      window.setTimeout(() => {
        setRefreshing(false);
      }, 500);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ==========================================================
     OUTSIDE CLICK
  ========================================================== */

  useEffect(() => {
    const closeMenu = () => {
      setOpenMenu(null);
    };

    if (!openMenu) {
      return;
    }

    document.addEventListener("click", closeMenu);

    return () => {
      document.removeEventListener("click", closeMenu);
    };
  }, [openMenu]);

  /* ==========================================================
     BASIC DATA
  ========================================================== */

  const bookedOrders = useMemo(
    () => salesOrders.filter(isBookedOrder),
    [salesOrders],
  );

  const wonRevenue = useMemo(
    () =>
      bookedOrders.reduce(
        (total, order) => total + Number(order.grand_total || 0),
        0,
      ),
    [bookedOrders],
  );

  const unitsSold = useMemo(
    () => bookedOrders.reduce((total, order) => total + orderUnits(order), 0),
    [bookedOrders],
  );

  /* ==========================================================
     MONTHLY DATA
  ========================================================== */

  const monthlyRevenue = useMemo<ChartPoint[]>(() => {
    const currentYear = new Date().getFullYear();

    const months = MONTH_NAMES.map((name) => ({
      label: name,
      year: currentYear,
      revenue: 0,
      units: 0,
    }));

    bookedOrders.forEach((order) => {
      const date = orderDateValue(order);

      if (!date || date.getFullYear() !== currentYear) {
        return;
      }

      const month = date.getMonth();

      months[month].revenue += Number(order.grand_total || 0);

      months[month].units += orderUnits(order);
    });

    return months;
  }, [bookedOrders]);

  /* ==========================================================
     YEARLY DATA
  ========================================================== */

  const yearlyRevenue = useMemo<ChartPoint[]>(() => {
    const currentYear = new Date().getFullYear();

    const startYear = currentYear - 5;

    return Array.from({ length: 6 }, (_, index) => startYear + index).map(
      (year) => {
        const yearOrders = bookedOrders.filter(
          (order) => orderDateValue(order)?.getFullYear() === year,
        );

        return {
          label: String(year),
          year,
          revenue: yearOrders.reduce(
            (total, order) => total + Number(order.grand_total || 0),
            0,
          ),
          units: yearOrders.reduce(
            (total, order) => total + orderUnits(order),
            0,
          ),
        };
      },
    );
  }, [bookedOrders]);

  /* ==========================================================
     ACTIVE CHART
  ========================================================== */

  const chartData = chartMode === "monthly" ? monthlyRevenue : yearlyRevenue;

  const maxChartRevenue = Math.max(
    ...chartData.map((point) => point.revenue),
    1,
  );

  useEffect(() => {
    if (!chartData.length) {
      setActiveChartIndex(0);
      return;
    }

    if (activeChartIndex >= chartData.length) {
      setActiveChartIndex(chartData.length - 1);
    }
  }, [chartData.length, activeChartIndex]);

  const selectedChartPoint = chartData[
    hoveredChartIndex ?? activeChartIndex
  ] || {
    label: "",
    year: new Date().getFullYear(),
    revenue: 0,
    units: 0,
  };

  /* ==========================================================
     CURRENT / PREVIOUS MONTH
  ========================================================== */

  const currentMonthStats = useMemo(() => {
    const currentDate = new Date();

    const currentMonth = currentDate.getMonth();

    const currentYear = currentDate.getFullYear();

    const previousDate = new Date(currentYear, currentMonth - 1, 1);

    const previousMonth = previousDate.getMonth();

    const previousYear = previousDate.getFullYear();

    let currentRevenue = 0;
    let previousRevenue = 0;

    let currentUnits = 0;
    let previousUnits = 0;

    bookedOrders.forEach((order) => {
      const date = orderDateValue(order);

      if (!date) {
        return;
      }

      const revenue = Number(order.grand_total || 0);

      const units = orderUnits(order);

      if (
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear
      ) {
        currentRevenue += revenue;
        currentUnits += units;
      }

      if (
        date.getMonth() === previousMonth &&
        date.getFullYear() === previousYear
      ) {
        previousRevenue += revenue;
        previousUnits += units;
      }
    });

    return {
      revenueChange: getPercentageChange(currentRevenue, previousRevenue),

      unitsChange: getPercentageChange(currentUnits, previousUnits),
    };
  }, [bookedOrders]);

  /* ==========================================================
     REGIONAL PERFORMANCE
     Booked order revenue by the order's state.
  ========================================================== */

  const regionalPerformance = useMemo<RegionalData[]>(() => {
    const map = new Map<string, RegionalData>();

    bookedOrders.forEach((order) => {
      const state = (order.state || "").trim();

      if (!state) {
        return;
      }

      const region = getRegionLabel(state);

      const current = map.get(region) || {
        name: region,
        state,
        revenue: 0,
      };

      current.revenue += Number(order.grand_total || 0);

      map.set(region, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [bookedOrders]);

  const maxRegionRevenue = Math.max(
    ...regionalPerformance.map((region) => region.revenue),
    1,
  );

  const topRegion = regionalPerformance[0];

  /* ==========================================================
     STATE PERFORMANCE
     States with any booked order.
  ========================================================== */

  const activeStates = useMemo(() => {
    const states = new Set<string>();

    bookedOrders.forEach((order) => {
      if (order.state) {
        states.add(getRegionLabel(order.state));
      }
    });

    return states.size;
  }, [bookedOrders]);

  /* ==========================================================
     SALES TEAM
     Revenue, units and orders booked per assignee. Conversion is the
     share of their opportunities that became a booked order.
  ========================================================== */

  const salesTeam = useMemo<SalesPerson[]>(() => {
    const map = new Map<string, SalesPerson>();

    const personFor = (name: string) => {
      const current = map.get(name) || {
        name,
        revenue: 0,
        units: 0,
        deals: 0,
        conversion: 0,
      };

      map.set(name, current);

      return current;
    };

    bookedOrders.forEach((order) => {
      const person = personFor(orderAssignee(order));

      person.revenue += Number(order.grand_total || 0);
      person.units += orderUnits(order);
      person.deals += 1;
    });

    const opportunityCount = new Map<string, number>();

    opportunities.forEach((opportunity) => {
      const name = opportunity.assigned_to_name || "Unassigned";

      opportunityCount.set(name, (opportunityCount.get(name) || 0) + 1);
      personFor(name);
    });

    dbLeads.forEach((lead) => {
      personFor(lead.assigned_to_name || lead.creator_name || "Unassigned");
    });

    const result = Array.from(map.values()).filter(
      (person) => person.name !== "Unassigned",
    );

    result.forEach((person) => {
      const total = opportunityCount.get(person.name) || 0;

      person.conversion = total
        ? Math.min(100, Math.round((person.deals / total) * 100))
        : 0;
    });

    return result.sort((a, b) => b.revenue - a.revenue);
  }, [bookedOrders, opportunities, dbLeads]);

  const topSalesPerson = salesTeam[0];

  /* ==========================================================
     PRODUCT DISTRIBUTION
     Units sold on booked orders, by product.
  ========================================================== */

  const productDistribution = useMemo<ProductData[]>(() => {
    const distribution = new Map<string, number>();

    bookedOrders.forEach((order) => {
      (order.items || []).forEach((raw) => {
        const line = raw as OrderLine;
        const units = lineUnits(line);

        if (!units) {
          return;
        }

        const name = lineProduct(line);

        distribution.set(name, (distribution.get(name) || 0) + units);
      });
    });

    const entries = Array.from(distribution.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const maxUnits = Math.max(...entries.map(([, units]) => units), 1);

    return entries.map(([name, units]) => ({
      name,
      units,
      percentage: (units / maxUnits) * 100,
    }));
  }, [bookedOrders]);

  /* ==========================================================
     SALES PIPELINE
     New Leads: leads not yet converted or dead. The rest are
     opportunities by stage, with Won being those closed won or with a
     booked order. Value is the deal value.
  ========================================================== */

  const pipeline = useMemo<PipelineStage[]>(() => {
    const map = new Map<string, PipelineStage>();

    PIPELINE_STAGES.forEach((stage) => {
      map.set(stage.key, {
        key: stage.key,
        label: stage.label,
        count: 0,
        revenue: 0,
      });
    });

    dbLeads.forEach((lead) => {
      const status = (lead.status || "").toUpperCase();

      if (["CONVERTED", "DEAD", "LOST"].includes(status)) {
        return;
      }

      const stage = map.get("new")!;

      stage.count += 1;
      stage.revenue += getLeadValue(lead);
    });

    const orderedOpportunities = new Set(
      bookedOrders
        .map((order) => order.opportunity_id)
        .filter((id): id is number => typeof id === "number"),
    );

    opportunities.forEach((opportunity) => {
      if (opportunity.status === "LOST") {
        return;
      }

      const key =
        opportunity.status === "WON" || orderedOpportunities.has(opportunity.id)
          ? "won"
          : opportunity.status === "NEGOTIATION"
            ? "negotiation"
            : opportunity.status === "PROPOSAL"
              ? "proposal"
              : "qualified";

      const stage = map.get(key)!;

      stage.count += 1;
      stage.revenue += Number(opportunity.deal_value || 0);
    });

    return PIPELINE_STAGES.map((stage) => map.get(stage.key)!);
  }, [dbLeads, opportunities, bookedOrders]);

  /* ==========================================================
     SALES ACTIVITY
     The latest leads, quotations and orders, newest first.
  ========================================================== */

  const activities = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    const toDate = (value?: string | null) => {
      const date = value ? new Date(value) : null;

      return date && !Number.isNaN(date.getTime()) ? date : null;
    };

    dbLeads.forEach((lead) => {
      items.push({
        id: `lead-${lead.id}`,
        title: "New Lead",
        person: lead.assigned_to_name || lead.creator_name || "Sales Team",
        detail: lead.title || getLeadCompanyName(lead),
        value: getLeadValue(lead),
        date: toDate(lead.created_at),
      });
    });

    quotations.forEach((quotation) => {
      items.push({
        id: `quotation-${quotation.id}`,
        title: `Quotation ${quotationStatusLabel(quotation.status)}`,
        person:
          opportunities.find(
            (opportunity) => opportunity.id === quotation.opportunity_id,
          )?.assigned_to_name || "Sales Team",
        detail: `#${quotation.quote_number} · ${
          quotation.organization_name || quotation.contact_name || ""
        }`,
        value: Number(quotation.total_payable || 0),
        date: toDate(quotation.updated_at || quotation.created_at),
      });
    });

    salesOrders.forEach((order) => {
      items.push({
        id: `order-${order.id}`,
        title: isBookedOrder(order) ? "Deal Closed" : "Sales Order Drafted",
        person: orderAssignee(order),
        detail: `${orderNumber(order)} · ${order.company_name || order.customer_name}`,
        value: Number(order.grand_total || 0),
        date: toDate(order.updated_at || order.created_at),
      });
    });

    return items
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
      .slice(0, 6);
  }, [dbLeads, quotations, salesOrders, opportunities]);

  /* ==========================================================
   ORDERS TABLE
   Newest sales orders first; a column header sorts the rows shown.
========================================================== */
  const sortedSalesOrders = useMemo(
    () =>
      [...salesOrders].sort(
        (a, b) =>
          new Date(orderDate(b) || 0).getTime() -
            new Date(orderDate(a) || 0).getTime() || b.id - a.id,
      ),
    [salesOrders],
  );

  const displayedOrders = useMemo(() => {
    const rows = showAllOrders
      ? sortedSalesOrders
      : sortedSalesOrders.slice(0, 5);

    if (!orderSort) return rows;

    const valueOf = ORDER_SORT_VALUE[orderSort.key];

    return [...rows].sort((a, b) => {
      const left = valueOf(a);
      const right = valueOf(b);

      return (left < right ? -1 : left > right ? 1 : 0) * orderSort.dir;
    });
  }, [sortedSalesOrders, showAllOrders, orderSort]);

  const toggleOrderSort = (key: OrderSortKey) =>
    setOrderSort((current) =>
      current?.key === key
        ? current.dir === 1
          ? { key, dir: -1 }
          : null
        : { key, dir: 1 },
    );

  /* ==========================================================
     REVENUE CHART POINTS
  ========================================================== */

  const chartPoints = useMemo(() => {
    const width = 1000;
    const height = 260;

    if (!chartData.length) {
      return [];
    }

    const denominator = Math.max(chartData.length - 1, 1);

    return chartData.map((point, index) => {
      const x = (index / denominator) * width;

      const normalized = point.revenue / maxChartRevenue;

      const y = height - normalized * 205 - 15;

      return {
        x,
        y: Math.max(18, y),
      };
    });
  }, [chartData, maxChartRevenue]);

  const chartPolyline = chartPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  const chartArea = chartPoints.length ? `0,260 ${chartPolyline} 1000,260` : "";

  /* ==========================================================
     GENERIC CSV EXPORT
  ========================================================== */

  const exportRows = useCallback(
    (filename: string, rows: Array<Array<string | number>>) => {
      const csv = rows
        .map((row) =>
          row
            .map((value) => `"${String(value).replaceAll('"', '""')}"`)
            .join(","),
        )
        .join("\n");

      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);

      link.click();

      link.remove();

      URL.revokeObjectURL(url);

      setOpenMenu(null);

      addToast("Data exported successfully.", "success");
    },
    [addToast],
  );

  /* ==========================================================
     EXPORTS
  ========================================================== */

  const exportDashboardData = useCallback(() => {
    exportRows(
      `dashboard-export-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["Type", "Name", "Value", "Units"],

        ...yearlyRevenue.map((item) => [
          "Revenue",
          item.label,
          item.revenue,
          item.units,
        ]),

        ...pipeline.map((item) => [
          "Pipeline",
          item.label,
          item.revenue,
          item.count,
        ]),

        ...regionalPerformance.map((item) => [
          "Region",
          item.name,
          item.revenue,
          "",
        ]),
      ],
    );
  }, [exportRows, yearlyRevenue, pipeline, regionalPerformance]);

  const exportProductData = useCallback(() => {
    exportRows(
      `units-by-product-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["Product", "Units", "Percentage"],

        ...productDistribution.map((product) => [
          product.name,
          product.units,
          `${product.percentage.toFixed(1)}%`,
        ]),
      ],
    );
  }, [exportRows, productDistribution]);

  const exportPipelineData = useCallback(() => {
    exportRows(`sales-pipeline-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Stage", "Deals", "Revenue"],

      ...pipeline.map((stage) => [stage.label, stage.count, stage.revenue]),
    ]);
  }, [exportRows, pipeline]);

  const exportRegionalData = useCallback(() => {
    exportRows(
      `regional-performance-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ["Region", "Revenue"],

        ...regionalPerformance.map((region) => [region.name, region.revenue]),
      ],
    );
  }, [exportRows, regionalPerformance]);

  const exportSalesTeamData = useCallback(() => {
    exportRows(`sales-team-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Role", "Name", "Revenue", "Units", "Conversion"],

      ...salesTeam.map((person, index) => [
        index === 0 ? "AVP" : index === 1 ? "Zonal Head" : "Area Head",

        person.name,
        person.revenue,
        person.units,
        `${person.conversion}%`,
      ]),
    ]);
  }, [exportRows, salesTeam]);

  const exportActivityData = useCallback(() => {
    exportRows(`sales-activity-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Activity", "Sales Person", "Details", "Value", "Date"],

      ...activities.map((activity) => [
        activity.title,
        activity.person,
        activity.detail,
        activity.value,
        activity.date ? activity.date.toLocaleDateString("en-IN") : "",
      ]),
    ]);
  }, [exportRows, activities]);

  const exportOrdersData = useCallback(() => {
    exportRows(`recent-orders-${new Date().toISOString().slice(0, 10)}.csv`, [
      [
        "Order ID",
        "Customer Name",
        "Email",
        "State",
        "Company",
        "Order Value",
        "Assigned To",
        "Order Date",
        "Status",
      ],

      ...displayedOrders.map((order) => [
        orderNumber(order),
        order.customer_name,
        orderContactEmail(order),
        order.state || "",
        order.company_name || "",
        Number(order.grand_total || 0),
        orderAssignee(order),
        formatDate(orderDate(order)),
        salesOrderStatusLabel(order.status),
      ]),
    ]);
  }, [exportRows, displayedOrders]);

  /* ==========================================================
     REVENUE CHART DOWNLOAD
  ========================================================== */

  const downloadRevenueChart = useCallback(() => {
    const svg = chartRef.current;

    if (!svg) {
      addToast("Chart is not available.", "error");

      return;
    }

    const serializer = new XMLSerializer();

    const source = serializer.serializeToString(svg);

    downloadSvg(`revenue-chart-${chartMode}.svg`, source);

    addToast("Revenue chart downloaded.", "success");
  }, [addToast, chartMode]);

  /* ==========================================================
     PRODUCT CHART DOWNLOAD
  ========================================================== */

  const downloadProductChart = useCallback(() => {
    const width = 900;

    const height = Math.max(180, productDistribution.length * 65 + 50);

    const maxUnits = Math.max(
      ...productDistribution.map((item) => item.units),
      1,
    );

    const bars = productDistribution
      .map((item, index) => {
        const y = 45 + index * 60;

        const barWidth = (item.units / maxUnits) * 650;

        return `
                <text
                  x="10"
                  y="${y + 15}"
                  font-size="14"
                  fill="#233353"
                >
                  ${item.name}
                </text>

                <rect
                  x="10"
                  y="${y + 24}"
                  width="650"
                  height="10"
                  rx="5"
                  fill="#eef1f5"
                />

                <rect
                  x="10"
                  y="${y + 24}"
                  width="${barWidth}"
                  height="10"
                  rx="5"
                  fill="#38588f"
                />

                <text
                  x="680"
                  y="${y + 34}"
                  font-size="14"
                  font-weight="600"
                  fill="#233353"
                >
                  ${item.units.toLocaleString("en-IN")}
                </text>
              `;
      })
      .join("");

    const svg = `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="${width}"
          height="${height}"
          viewBox="0 0 ${width} ${height}"
        >
          <rect
            width="100%"
            height="100%"
            fill="white"
          />

          <text
            x="10"
            y="24"
            font-size="18"
            font-weight="700"
            fill="#18294a"
          >
            Units by Product
          </text>

          ${bars}
        </svg>
      `;

    downloadSvg(
      `units-by-product-${new Date().toISOString().slice(0, 10)}.svg`,
      svg,
    );

    addToast("Product chart downloaded.", "success");
  }, [productDistribution, addToast]);

  /* ==========================================================
     PIPELINE CHART DOWNLOAD
  ========================================================== */

  /* ==========================================================
   PIPELINE CHART DOWNLOAD
========================================================== */

  const downloadPipelineChart = useCallback(() => {
    const width = 600;
    const height = 470;

    const center = width / 2;

    /*
     * Keep the downloaded funnel visually consistent
     * with the funnel shown in the dashboard.
     */
    // const funnelWidth = 500;
    const stageHeight = 58;

    const topWidths = [500, 420, 340, 260, 180];
    const bottomWidths = [420, 340, 260, 180, 100];

    const colors = ["#26395B", "#304A78", "#42639B", "#6687C0", "#20C66B"];

    const funnelTop = 70;

    const segments = pipeline
      .map((stage, index) => {
        const topY = funnelTop + index * stageHeight;
        const bottomY = topY + stageHeight;

        const topHalf = topWidths[index] / 2;
        const bottomHalf = bottomWidths[index] / 2;

        const points = [
          `${center - topHalf},${topY}`,
          `${center + topHalf},${topY}`,
          `${center + bottomHalf},${bottomY}`,
          `${center - bottomHalf},${bottomY}`,
        ].join(" ");

        return `
        <polygon
          points="${points}"
          fill="${colors[index]}"
        />

        <text
          x="${center}"
          y="${topY + 22}"
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="12"
          font-weight="500"
          fill="#ffffff"
          font-family="Arial, Helvetica, sans-serif"
        >
          ${stage.label} (${stage.count} Deals)
        </text>

        <text
          x="${center}"
          y="${topY + 42}"
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="17"
          font-weight="700"
          fill="#ffffff"
          font-family="Arial, Helvetica, sans-serif"
        >
          ${formatCurrency(stage.revenue)}
        </text>
      `;
      })
      .join("");

    const legendY = funnelTop + pipeline.length * stageHeight + 35;

    const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${width}"
      height="${height}"
      viewBox="0 0 ${width} ${height}"
    >
      <rect
        width="100%"
        height="100%"
        fill="white"
      />

      <!-- TITLE -->
      <text
        x="${center}"
        y="32"
        text-anchor="middle"
        font-size="22"
        font-weight="700"
        fill="#18294a"
        font-family="Arial, Helvetica, sans-serif"
      >
        Sales Pipeline
      </text>

      <!-- FUNNEL -->
      ${segments}

      <!-- LEGEND -->
      <circle
        cx="${center - 62}"
        cy="${legendY}"
        r="5"
        fill="#42639B"
      />

      <text
        x="${center - 52}"
        y="${legendY + 4}"
        font-size="11"
        fill="#475569"
        font-family="Arial, Helvetica, sans-serif"
      >
        Active Stages
      </text>

      <circle
        cx="${center + 55}"
        cy="${legendY}"
        r="5"
        fill="#20C66B"
      />

      <text
        x="${center + 65}"
        y="${legendY + 4}"
        font-size="11"
        fill="#475569"
        font-family="Arial, Helvetica, sans-serif"
      >
        Conversion Success
      </text>
    </svg>
  `;

    downloadSvg(
      `sales-pipeline-${new Date().toISOString().slice(0, 10)}.svg`,
      svg,
    );

    addToast("Pipeline chart downloaded.", "success");
  }, [pipeline, addToast]);

  /* ==========================================================
     REGION CHART DOWNLOAD
  ========================================================== */

  const downloadRegionChart = useCallback(() => {
    const width = 900;

    const height = Math.max(180, regionalPerformance.length * 55 + 60);

    const maxRevenue = Math.max(
      ...regionalPerformance.map((item) => item.revenue),
      1,
    );

    const bars = regionalPerformance
      .map((item, index) => {
        const y = 45 + index * 50;

        const barWidth = (item.revenue / maxRevenue) * 650;

        return `
                <text
                  x="10"
                  y="${y + 17}"
                  font-size="14"
                  font-weight="600"
                  fill="#64748b"
                >
                  ${item.name}
                </text>

                <rect
                  x="55"
                  y="${y}"
                  width="650"
                  height="26"
                  rx="4"
                  fill="#eef1f5"
                />

                <rect
                  x="55"
                  y="${y}"
                  width="${barWidth}"
                  height="26"
                  rx="4"
                  fill="#38588f"
                />

                <text
                  x="720"
                  y="${y + 18}"
                  font-size="14"
                  font-weight="600"
                  fill="#233353"
                >
                  ${formatCompactCurrency(item.revenue)}
                </text>
              `;
      })
      .join("");

    const svg = `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="${width}"
          height="${height}"
          viewBox="0 0 ${width} ${height}"
        >
          <rect
            width="100%"
            height="100%"
            fill="white"
          />

          <text
            x="10"
            y="25"
            font-size="18"
            font-weight="700"
            fill="#18294a"
          >
            Regional Performance
          </text>

          ${bars}
        </svg>
      `;

    downloadSvg(
      `regional-performance-${new Date().toISOString().slice(0, 10)}.svg`,
      svg,
    );

    addToast("Regional chart downloaded.", "success");
  }, [regionalPerformance, addToast]);

  /* ==========================================================
     SALES TEAM CHART DOWNLOAD
  ========================================================== */

  const downloadSalesTeamChart = useCallback(() => {
    const width = 1000;

    const rowHeight = 75;

    const height = 80 + Math.max(salesTeam.length, 1) * rowHeight;

    const maxRevenue = Math.max(
      ...salesTeam.map((person) => person.revenue),
      1,
    );

    const rows = salesTeam
      .map((person, index) => {
        const y = 65 + index * rowHeight;

        const barWidth = (person.revenue / maxRevenue) * 600;

        const role =
          index === 0 ? "AVP" : index === 1 ? "Zonal Head" : "Area Head";

        return `
                <text
                  x="20"
                  y="${y + 20}"
                  font-size="14"
                  font-weight="700"
                  fill="#18294a"
                >
                  ${role}
                </text>

                <text
                  x="120"
                  y="${y + 20}"
                  font-size="14"
                  fill="#38588f"
                >
                  ${person.name}
                </text>

                <rect
                  x="300"
                  y="${y + 5}"
                  width="600"
                  height="22"
                  rx="5"
                  fill="#eef1f5"
                />

                <rect
                  x="300"
                  y="${y + 5}"
                  width="${barWidth}"
                  height="22"
                  rx="5"
                  fill="#38588f"
                />

                <text
                  x="920"
                  y="${y + 21}"
                  text-anchor="end"
                  font-size="14"
                  font-weight="700"
                  fill="#233353"
                >
                  ${formatCompactCurrency(person.revenue)}
                </text>

                <text
                  x="300"
                  y="${y + 48}"
                  font-size="11"
                  fill="#64748b"
                >
                  ${person.units.toLocaleString("en-IN")} Units
                </text>

                <text
                  x="420"
                  y="${y + 48}"
                  font-size="11"
                  fill="#64748b"
                >
                  ${person.conversion}% Conversion
                </text>

                <text
                  x="620"
                  y="${y + 48}"
                  font-size="11"
                  fill="#64748b"
                >
                  ${person.deals} Deals
                </text>
              `;
      })
      .join("");

    const svg = `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="${width}"
          height="${height}"
          viewBox="0 0 ${width} ${height}"
        >
          <rect
            width="100%"
            height="100%"
            fill="white"
          />

          <text
            x="20"
            y="30"
            font-size="20"
            font-weight="700"
            fill="#18294a"
          >
            Sales Team Performance
          </text>

          ${rows}
        </svg>
      `;

    downloadSvg(
      `sales-team-performance-${new Date().toISOString().slice(0, 10)}.svg`,
      svg,
    );

    addToast("Sales team chart downloaded.", "success");
  }, [salesTeam, addToast]);

  /* ==========================================================
     SALES ACTIVITY CHART DOWNLOAD
  ========================================================== */

  const downloadActivityChart = useCallback(() => {
    const width = 900;

    const rowHeight = 85;

    const height = 80 + Math.max(activities.length, 1) * rowHeight;

    const rows = activities
      .map((item, index) => {
        const y = 55 + index * rowHeight;

        const activity = escapeSvgText(item.title);

        const dateLabel = item.date ? item.date.toLocaleDateString("en-IN") : "—";

        return `
                <line
                  x1="35"
                  y1="${y}"
                  x2="35"
                  y2="${y + 60}"
                  stroke="#d9dee7"
                  stroke-width="2"
                />

                <circle
                  cx="35"
                  cy="${y}"
                  r="7"
                  fill="#38588f"
                />

                <text
                  x="60"
                  y="${y + 5}"
                  font-size="14"
                  font-weight="700"
                  fill="#18294a"
                >
                  ${activity}
                </text>

                <text
                  x="60"
                  y="${y + 27}"
                  font-size="12"
                  fill="#64748b"
                >
                  ${escapeSvgText(item.person)}
                </text>

                <text
                  x="60"
                  y="${y + 48}"
                  font-size="12"
                  fill="#64748b"
                >
                  ${escapeSvgText(item.detail || "Sales activity")}
                </text>

                <text
                  x="820"
                  y="${y + 5}"
                  text-anchor="end"
                  font-size="12"
                  fill="#64748b"
                >
                  ${dateLabel}
                </text>

                <text
                  x="820"
                  y="${y + 30}"
                  text-anchor="end"
                  font-size="15"
                  font-weight="700"
                  fill="#233353"
                >
                  ${formatCurrency(item.value)}
                </text>
              `;
      })
      .join("");

    const svg = `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="${width}"
          height="${height}"
          viewBox="0 0 ${width} ${height}"
        >
          <rect
            width="100%"
            height="100%"
            fill="white"
          />

          <text
            x="20"
            y="30"
            font-size="20"
            font-weight="700"
            fill="#18294a"
          >
            Sales Activity
          </text>

          ${rows}
        </svg>
      `;

    downloadSvg(
      `sales-activity-${new Date().toISOString().slice(0, 10)}.svg`,
      svg,
    );

    addToast("Sales activity chart downloaded.", "success");
  }, [activities, addToast]);

  /* ==========================================================
     RECENT ORDERS CHART DOWNLOAD
  ========================================================== */

  const downloadOrdersChart = useCallback(() => {
    const width = 1100;

    const rowHeight = 70;

    const height = 90 + Math.max(displayedOrders.length, 1) * rowHeight;

    const columns = [
      { x: 40, label: "Order ID" },
      { x: 150, label: "Customer Name" },
      { x: 360, label: "Company" },
      { x: 560, label: "Order Value" },
      { x: 680, label: "Assigned To" },
      { x: 830, label: "Order Date" },
      { x: 960, label: "Status" },
    ];

    const header = columns
      .map(
        (column) =>
          `<text x="${column.x}" y="58" font-size="11" fill="#777777">${column.label}</text>`,
      )
      .join("");

    const rows = displayedOrders
      .map((order, index) => {
        const y = 75 + index * rowHeight;

        const cells = [
          orderNumber(order),
          order.customer_name,
          order.company_name || "-",
          compactMoney(order.grand_total),
          orderAssignee(order),
          formatDate(orderDate(order)),
          salesOrderStatusLabel(order.status),
        ];

        return `
                <rect x="20" y="${y}" width="1060" height="52" rx="8" fill="#f7f8fa" />
                ${cells
                  .map(
                    (cell, cellIndex) =>
                      `<text x="${columns[cellIndex].x}" y="${y + 31}" font-size="12" fill="${
                        cellIndex === 0 ? "#18294a" : "#475569"
                      }">${escapeSvgText(String(cell))}</text>`,
                  )
                  .join("")}
              `;
      })
      .join("");

    const svg = `
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="${width}"
          height="${height}"
          viewBox="0 0 ${width} ${height}"
        >
          <rect
            width="100%"
            height="100%"
            fill="white"
          />

          <text
            x="20"
            y="32"
            font-size="20"
            font-weight="700"
            fill="#18294a"
          >
            ${showAllOrders ? "All Orders" : "Recent Orders"}
          </text>

          ${header}

          ${rows}
        </svg>
      `;

    downloadSvg(
      `recent-orders-${new Date().toISOString().slice(0, 10)}.svg`,
      svg,
    );

    addToast("Orders chart downloaded.", "success");
  }, [displayedOrders, showAllOrders, addToast]);

  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <FiRefreshCw className="animate-spin text-2xl text-[#233353]" />

          <span className="text-sm font-medium text-slate-400">
            Loading dashboard...
          </span>
        </div>
      </div>
    );
  }

  /* ==========================================================
     RENDER
  ========================================================== */

  return (
    <div className="min-h-full space-y-5 pb-8">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-medium text-[#131313] dark:text-white">
            Dashboard
          </h2>

          <button
            type="button"
            onClick={fetchData}
            title="Refresh dashboard"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-[#0d2336] dark:bg-[#051422]"
          >
            <FiRefreshCw
              className={refreshing ? "animate-spin" : ""}
              size={11}
            />
          </button>
        </div>

        <DashboardMenu
          menu="dashboard"
          boxed
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          onExport={exportDashboardData}
          onDownloadChart={downloadRevenueChart}
        />
      </div>

      {/* ======================================================
          KPI CARDS
      ====================================================== */}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[68.75rem]:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                Revenue Performance
              </p>

              <h3 className="mt-1 text-[26px] font-medium leading-tight tracking-tight text-[#233353] dark:text-white">
                {formatCurrency(wonRevenue)}
              </h3>

              <p
                className={`mt-0.5 text-[11px] ${
                  currentMonthStats.revenueChange < 0 ? "text-rose-500" : "text-emerald-500"
                }`}
              >
                vs last month
              </p>
            </div>

            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
                currentMonthStats.revenueChange < 0
                  ? "bg-rose-50 text-rose-500 dark:bg-rose-500/10"
                  : "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10"
              }`}
            >
              {currentMonthStats.revenueChange < 0 ? "↘" : "↗"}{" "}
              {Math.abs(currentMonthStats.revenueChange).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">Units Sold</p>

              <h3 className="mt-1 text-[26px] font-medium leading-tight tracking-tight text-[#233353] dark:text-white">
                {unitsSold.toLocaleString("en-IN")} Units
              </h3>

              <p
                className={`mt-0.5 text-[11px] ${
                  currentMonthStats.unitsChange < 0 ? "text-rose-500" : "text-emerald-500"
                }`}
              >
                vs last month
              </p>
            </div>

            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${
                currentMonthStats.unitsChange < 0
                  ? "bg-rose-50 text-rose-500 dark:bg-rose-500/10"
                  : "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10"
              }`}
            >
              {currentMonthStats.unitsChange < 0 ? "↘" : "↗"}{" "}
              {Math.abs(currentMonthStats.unitsChange).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
          <p className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
            State Performance
          </p>

          <h3 className="mt-1 text-[26px] font-medium leading-tight tracking-tight text-[#233353] dark:text-white">
            {activeStates} Active
          </h3>

          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Top State:{" "}
            <span className="font-medium">{topRegion?.state || "—"}</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
          <p className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
            Sales Team Performance
          </p>

          <h3 className="mt-1 text-[26px] font-medium leading-tight tracking-tight text-[#233353] dark:text-white">
            {salesTeam.length} Active
          </h3>

          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Top Performer:{" "}
            <span className="font-medium">{topSalesPerson?.name || "—"}</span>
          </p>
        </div>
      </section>

      {/* ======================================================
          REVENUE TREND
      ====================================================== */}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-[17px] font-medium text-[#172839] dark:text-white">
              Revenue Trend
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Historical billing performance across regions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-[#f3f3f3] p-0.5 dark:border-[#0d2336] dark:bg-[#071929]">
              <button
                type="button"
                onClick={() => {
                  setChartMode("monthly");

                  setActiveChartIndex(new Date().getMonth());
                }}
                className={`rounded-md px-2.5 py-1 text-sm ${
                  chartMode === "monthly"
                    ? "bg-white text-slate-800 shadow-sm dark:bg-[#051422] dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Monthly
              </button>

              <button
                type="button"
                onClick={() => {
                  setChartMode("yearly");

                  setActiveChartIndex(Math.max(yearlyRevenue.length - 1, 0));
                }}
                className={`rounded-md px-2.5 py-1 text-sm ${
                  chartMode === "yearly"
                    ? "bg-white text-slate-800 shadow-sm dark:bg-[#051422] dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Yearly
              </button>
            </div>

            <DashboardMenu
              menu="revenue"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onExport={exportDashboardData}
              onDownloadChart={downloadRevenueChart}
            />
          </div>
        </div>

        <div className="relative mt-6 h-[250px] w-full">
          <svg
            ref={chartRef}
            viewBox="0 0 1000 300"
            preserveAspectRatio="none"
            className="absolute inset-x-0 top-0 h-[215px] w-full overflow-visible"
          >
            <defs>
              <linearGradient
                id="revenueAreaGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor="#38588f" stopOpacity="0.12" />

                <stop offset="100%" stopColor="#38588f" stopOpacity="0" />
              </linearGradient>
            </defs>

            {chartArea && (
              <polygon points={chartArea} fill="url(#revenueAreaGradient)" />
            )}

            {chartPolyline && (
              <polyline
                points={chartPolyline}
                fill="none"
                stroke="#38588f"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {chartData.map((point, index) => {
              const coords = chartPoints[index];

              if (!coords) {
                return null;
              }

              const selected = index === activeChartIndex;

              return (
                <g
                  key={`${point.label}-${point.year}`}
                  onMouseEnter={() => setHoveredChartIndex(index)}
                  onMouseLeave={() => setHoveredChartIndex(null)}
                  onClick={() => setActiveChartIndex(index)}
                  className="cursor-pointer"
                >
                  {selected && (
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r="8"
                      fill="white"
                      stroke="#38588f"
                      strokeWidth="2"
                    />
                  )}

                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={selected ? 4.5 : 3.5}
                    fill="#38588f"
                  />
                </g>
              );
            })}
          </svg>

          {hoveredChartIndex !== null && chartPoints[hoveredChartIndex] && (
            <div
              className="pointer-events-none absolute z-20 w-[138px] rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg dark:border-[#0d2336] dark:bg-[#071929]"
              style={{
                left: `${Math.min(
                  Math.max((chartPoints[hoveredChartIndex].x / 1000) * 100, 7),
                  88,
                )}%`,

                top: `${Math.max(
                  ((chartPoints[hoveredChartIndex].y / 300) * 215 / 250) * 100 - 12,
                  2,
                )}%`,

                transform: "translateX(-50%)",
              }}
            >
              <p className="text-[10px] font-medium text-slate-400">
                {chartMode === "monthly"
                  ? `${chartData[hoveredChartIndex].label} ${chartData[hoveredChartIndex].year}`
                  : chartData[hoveredChartIndex].label}
              </p>

              <p className="text-[10px] font-medium text-[#38588f]">Revenue</p>

              <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-white">
                {formatCurrency(chartData[hoveredChartIndex].revenue)}
              </p>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1">
            {chartData.map((point, index) => (
              <button
                type="button"
                key={`${point.label}-${point.year}`}
                onMouseEnter={() => setHoveredChartIndex(index)}
                onMouseLeave={() => setHoveredChartIndex(null)}
                onClick={() => setActiveChartIndex(index)}
                className={`text-[10px] ${
                  activeChartIndex === index
                    ? "font-semibold text-[#233353] dark:text-white"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {point.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-[#38588f]" />
          Selected:
          <span className="font-semibold text-slate-600 dark:text-slate-200">
            {selectedChartPoint.label}
          </span>
          <span>{formatCurrency(selectedChartPoint.revenue)}</span>
        </div>
      </section>

      {/* ======================================================
          PRODUCT / PIPELINE / REGION
      ====================================================== */}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* PRODUCT */}

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-medium text-[#172839] dark:text-white">
              Units by Product
            </h3>

            <DashboardMenu
              menu="product"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onExport={exportProductData}
              onDownloadChart={downloadProductChart}
            />
          </div>

          <div className="mt-5 space-y-6">
            {productDistribution.length > 0 ? (
              productDistribution.slice(0, 3).map((product) => (
                <div key={product.name}>
                  <div className="mb-2 flex justify-between gap-3 text-sm">
                    <span className="text-[#131313] dark:text-slate-300">
                      {product.name}
                    </span>

                    <span className="font-medium text-[#233353] dark:text-slate-200">
                      {product.units.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="h-1.5 rounded-full bg-[#f3f3f3] dark:bg-slate-800">
                    <div
                      className="h-1.5 rounded-full bg-[#293b60] dark:bg-[#6f8fc4]"
                      style={{
                        width: `${Math.max(4, product.percentage)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-xs text-slate-400">
                No inventory data available.
              </div>
            )}
          </div>
        </div>

        {/* ====================================================
    SALES PIPELINE
==================================================== */}

<div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
  {/* HEADER */}
  <div className="flex items-center justify-between">
    <h3 className="text-[17px] font-medium text-[#172839] dark:text-white">
      Sales Pipeline
    </h3>

    <DashboardMenu
      menu="pipeline"
      openMenu={openMenu}
      setOpenMenu={setOpenMenu}
      onExport={exportPipelineData}
      onDownloadChart={downloadPipelineChart}
    />
  </div>

  {/* FUNNEL */}
  <div
    className="mt-5 flex justify-center"
    onMouseLeave={() => setHoveredPipelineIndex(null)}
  >
    <div className="w-full max-w-[330px]">
      <svg
        viewBox="0 0 330 320"
        className="block h-auto w-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        {pipeline.map((stage, index) => {
          const center = 165;
          const stageHeight = 58;

          const topY = index * stageHeight;
          const bottomY = topY + stageHeight;

          const topWidths = [300, 252, 204, 156, 108];
          const bottomWidths = [252, 204, 156, 108, 60];

          const colors = [
            "#26395B",
            "#304A78",
            "#42639B",
            "#6687C0",
            "#20C66B",
          ];

          const topHalf = topWidths[index] / 2;
          const bottomHalf = bottomWidths[index] / 2;

          const points = [
            `${center - topHalf},${topY}`,
            `${center + topHalf},${topY}`,
            `${center + bottomHalf},${bottomY}`,
            `${center - bottomHalf},${bottomY}`,
          ].join(" ");

          const isHovered = hoveredPipelineIndex === index;

          return (
            <g
              key={stage.key}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredPipelineIndex(index)}
            >
              {/* Funnel segment */}
              <polygon
                points={points}
                fill={colors[index]}
                opacity={
                  hoveredPipelineIndex === null || isHovered ? 1 : 0.92
                }
                className="transition-opacity duration-150"
              />

              {/* Show information ONLY for hovered stage */}
              {isHovered && (
                <>
                  <text
                    x={center}
                    y={topY + 22}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="500"
                    pointerEvents="none"
                  >
                    {stage.label} ({stage.count} Deals)
                  </text>

                  <text
                    x={center}
                    y={topY + 42}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#ffffff"
                    fontSize="14"
                    fontWeight="700"
                    pointerEvents="none"
                  >
                    {formatCurrency(stage.revenue)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  </div>

  {/* LEGEND */}
  <div className="mt-4 flex items-center justify-center gap-5 text-[11px] text-slate-500">
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full bg-[#42639B]" />
      Active Stages
    </span>

    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full bg-[#20C66B]" />
      Conversion Success
    </span>
  </div>
</div>

        {/* REGIONAL */}

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
          <div className="flex items-center justify-between">
            <h3 className="text-[17px] font-medium text-[#172839] dark:text-white">
              Regional Performance
            </h3>

            <DashboardMenu
              menu="regional"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onExport={exportRegionalData}
              onDownloadChart={downloadRegionChart}
            />
          </div>

          <div className="mt-5 space-y-3.5">
            {regionalPerformance.length > 0 ? (
              regionalPerformance.map((region) => (
                <div key={region.name} className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-sm font-medium text-[#777777] dark:text-slate-400">
                    {region.name}
                  </span>

                  <div className="relative h-[26px] flex-1 rounded-sm bg-[#f3f3f3] dark:bg-slate-800">
                    <div
                      className="h-full rounded-sm bg-[#395388]"
                      style={{
                        width: `${Math.max(
                          8,
                          (region.revenue / maxRegionRevenue) * 100,
                        )}%`,
                      }}
                    />

                    <span className="absolute inset-y-0 right-2 flex items-center text-[10px] text-[#919191]">
                      {formatCompactCurrency(region.revenue)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-xs text-slate-400">
                Regional data is not available from the current lead API.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ======================================================
          SALES TEAM + ACTIVITY
      ====================================================== */}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* SALES TEAM */}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2 dark:border-[#0d2336] dark:bg-[#051422]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 dark:border-[#0d2336]">
            <div>
              <h3 className="text-[17px] font-medium text-[#172839] dark:text-white">
                Sales Team Hierarchy
              </h3>

      
            </div>

            <DashboardMenu
              menu="salesTeam"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onExport={exportSalesTeamData}
              onDownloadChart={downloadSalesTeamChart}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 dark:border-[#0d2336]">
                  <th className="px-5 py-4 font-semibold">Role</th>

                  <th className="px-5 py-4 font-semibold">Incumbent</th>

                  <th className="px-5 py-4 font-semibold">Revenue</th>

                  <th className="px-5 py-4 font-semibold">Units</th>

                  <th className="px-5 py-4 font-semibold">Conversion</th>

                  <th className="px-5 py-4 font-semibold">
                    Target Achievement
                  </th>
                </tr>
              </thead>

              <tbody>
                {salesTeam.length > 0 ? (
                  salesTeam.map((person, index) => (
                    <tr
                      key={person.name}
                      className="border-b border-slate-100 last:border-0 dark:border-[#0d2336]"
                    >
                      <td className="px-5 py-5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        {index === 0
                          ? "AVP"
                          : index === 1
                            ? "Zonal Head"
                            : "Area Head"}
                      </td>

                      <td className="px-5 py-5 text-xs font-medium text-[#38588f]">
                        {person.name}
                      </td>

                      <td className="px-5 py-5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {formatCurrency(person.revenue)}
                      </td>

                      <td className="px-5 py-5 text-xs text-slate-600 dark:text-slate-400">
                        {person.units.toLocaleString("en-IN")}
                      </td>

                      <td className="px-5 py-5 text-xs text-slate-600 dark:text-slate-400">
                        {person.conversion}%
                      </td>

                      <td className="px-5 py-5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-500">
                            {person.conversion}%
                          </span>

                          <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-slate-800">
                            <div
                              className="h-1.5 rounded-full bg-emerald-500"
                              style={{
                                width: `${Math.min(person.conversion, 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-xs text-slate-400"
                    >
                      No sales team data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* SALES ACTIVITY */}

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[17px] font-medium text-[#172839] dark:text-white">
                Sales Activity
              </h3>
            </div>

            <DashboardMenu
              menu="activity"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onExport={exportActivityData}
              onDownloadChart={downloadActivityChart}
            />
          </div>

          <div className="mt-6 space-y-6">
            {activities.length > 0 ? (
              activities.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="relative border-l-2 border-slate-200 pl-5 dark:border-slate-700"
                >
                  <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#38588f] dark:border-[#051422]" />

                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {item.title}
                    </h4>

                    <span className="shrink-0 text-[10px] text-slate-400">
                      {item.date ? item.date.toLocaleDateString("en-IN") : ""}
                    </span>
                  </div>

                  <p className="mt-1 text-[10px] text-slate-400">
                    {item.person}
                  </p>

                  <div className="mt-2 rounded-lg bg-slate-50 p-3 text-[10px] text-slate-500 dark:bg-[#071929] dark:text-slate-400">
                    {item.detail}
                    {item.value > 0 && (
                      <span className="ml-1 font-semibold text-slate-700 dark:text-slate-200">
                        · {formatCurrency(item.value)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-xs text-slate-400">
                No recent activity.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ======================================================
        RECENT ORDERS
      ====================================================== */}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 py-5">
          <div>
            <h3 className="text-[17px] font-medium text-[#172839] dark:text-white">
              {showAllOrders ? "All Orders" : "Recent Orders"}
            </h3>

            {showAllOrders && (
              <p className="mt-1 text-xs text-slate-400">
                Showing all {salesOrders.length} orders
              </p>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* VIEW ALL / SHOW RECENT */}
            <button
              type="button"
              onClick={() => {
                setShowAllOrders((current) => !current);
              }}
              className="text-sm text-[#aaaaaa] transition-colors hover:text-[#233353] dark:text-slate-400 dark:hover:text-white"
            >
              {showAllOrders ? "Show Recent Orders" : "View All Orders"}
            </button>

            {/* EXPORT + DOWNLOAD CHART */}
            <DashboardMenu
              menu="orders"
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              onExport={exportOrdersData}
              onDownloadChart={downloadOrdersChart}
            />
          </div>
        </div>

        {/* TABLE */}
        <div className="mx-5 mb-5 overflow-x-auto rounded-xl border border-[#e2e2e2] dark:border-[#0d2336]">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#e2e2e2] dark:border-[#0d2336]">
                <th className="w-10 border-r border-slate-100 px-3 py-3 dark:border-[#0d2336]">
                  <input
                    type="checkbox"
                    aria-label="Select all orders"
                    className="rounded border-slate-300"
                  />
                </th>
                <OrderSortTh sort={orderSort} onSort={toggleOrderSort} label="Order ID" sortKey="order" className="whitespace-nowrap" />
                <OrderSortTh sort={orderSort} onSort={toggleOrderSort} label="Customer Name" sortKey="customer" className="min-w-[150px]" />
                <OrderSortTh sort={orderSort} onSort={toggleOrderSort} label="Company" sortKey="company" />
                <OrderSortTh sort={orderSort} onSort={toggleOrderSort} label="Order Value" sortKey="value" />
                <OrderSortTh sort={orderSort} onSort={toggleOrderSort} label="Assigned To" sortKey="assigned" />
                <OrderSortTh sort={orderSort} onSort={toggleOrderSort} label="Order Date" sortKey="date" />
                <OrderSortTh sort={orderSort} onSort={toggleOrderSort} label="Status" sortKey="status" />
                <th className="px-3 py-3 text-center text-xs font-normal text-[#777777] dark:text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {displayedOrders.length > 0 ? (
                displayedOrders.map((order) => {
                  const email = orderContactEmail(order);

                  return (
                    <tr
                      key={order.id}
                      onClick={() => router.push(`/sales/orders/${order.id}`)}
                      className="cursor-pointer border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50 dark:border-[#0d2336] dark:hover:bg-[#071929]"
                    >
                      <td
                        className="px-3 py-3"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={`Select ${orderNumber(order)}`}
                          className="rounded border-slate-300"
                        />
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-[11px] text-slate-800 dark:text-white">
                        {orderNumber(order)}
                      </td>

                      <td className="px-3 py-3">
                        <p className="text-[12px] font-semibold text-slate-900 dark:text-white">
                          {order.customer_name}
                        </p>

                        {email && (
                          <p className="text-[10px] text-slate-700 [overflow-wrap:anywhere] dark:text-slate-400">
                            {email}
                          </p>
                        )}

                        {order.state && (
                          <p className="flex items-center gap-1 text-[9px] text-slate-600 dark:text-slate-400">
                            <LuMapPin size={9} />
                            {order.state}
                          </p>
                        )}
                      </td>

                      <td className="px-3 py-3 text-[12px] text-slate-700 dark:text-slate-300">
                        {order.company_name || "-"}
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-center text-[10px] font-medium text-slate-800 dark:text-slate-200">
                        {compactMoney(order.grand_total)}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-700 dark:bg-[#071929] dark:text-slate-200">
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-300 text-[8px] dark:bg-[#17304a]">
                            {orderAssignee(order).charAt(0).toUpperCase()}
                          </span>
                          {orderAssignee(order)}
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-3 py-3 text-center text-[10px] text-slate-700 dark:text-slate-300">
                        {formatDate(orderDate(order))}
                      </td>

                      <td className="px-3 py-3 text-center">
                        <StatusPill
                          status={order.status}
                          label={salesOrderStatusLabel(order.status)}
                        />
                      </td>

                      <td
                        className="relative px-3 py-3 text-center"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-label={`Actions for ${orderNumber(order)}`}
                          onClick={() =>
                            setOrderRowMenu(
                              orderRowMenu === order.id ? null : order.id,
                            )
                          }
                          className="rounded p-1 text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#071929]"
                        >
                          <LuEllipsisVertical size={15} />
                        </button>

                        {orderRowMenu === order.id && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={() => setOrderRowMenu(null)}
                            />

                            <div className="absolute right-4 top-9 z-30 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-xl dark:border-[#0d2336] dark:bg-[#051422]">
                              <Link
                                href={`/sales/orders/${order.id}`}
                                onClick={() => setOrderRowMenu(null)}
                                className="block px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-[#071929]"
                              >
                                View Order
                              </Link>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-xs text-slate-400"
                  >
                    No sales orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* SHOW RECENT FOOTER
        {showAllOrders && (
          <div className="flex items-center justify-center border-t border-slate-100 px-5 py-4 dark:border-[#0d2336]">
            <button
              type="button"
              onClick={() => {
                setShowAllOrders(false);
              }}
              className="text-xs font-semibold text-[#38588f] transition-colors hover:text-[#233353] dark:text-[#6f8fc4] dark:hover:text-white"
            >
              Show Recent Orders
            </button>
          </div>
        )} */}
      </section>
    </div>
  );
}
