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

import { FiDownload, FiEye, FiMoreVertical, FiRefreshCw } from "react-icons/fi";

import { getLeadsApi, Lead } from "@/features/workflows/api/workflows.api";

import {
  getInventoryItemsApi,
  getProductTypesApi,
  InventoryItem,
} from "@/features/inventory/api/inventory.api";

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
  name: string;
  revenue: number;
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

function getLeadUnits(lead: DashboardLead) {
  if (typeof lead.units === "number") {
    return lead.units;
  }

  if (!lead.quotation_items?.length) {
    return 0;
  }

  return lead.quotation_items.reduce(
    (total, item) => total + Number(item.qty || 0),
    0,
  );
}

function isWonLead(lead: DashboardLead) {
  const status = lead.status?.toLowerCase();
  const stage = lead.stage?.toLowerCase();

  return status === "won" || stage === "won";
}

function isQuotationLead(lead: DashboardLead) {
  return lead.stage?.toLowerCase() === "quotation";
}

function getLeadDate(lead: DashboardLead) {
  const date = new Date(lead.created_at);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getPercentageChange(current: number, previous: number) {
  if (!previous) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function getStageKey(lead: DashboardLead) {
  if (isWonLead(lead)) {
    return "won";
  }

  const stage = (lead.stage || "").toLowerCase();

  if (stage.includes("negotiat")) {
    return "negotiation";
  }

  if (stage.includes("quotation") || stage.includes("proposal")) {
    return "proposal";
  }

  if (stage.includes("qualif")) {
    return "qualified";
  }

  return "new";
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

function getCustomerName(lead: DashboardLead) {
  return lead.customer_name || lead.customer || lead.title || "Customer";
}

function getProductName(lead: DashboardLead) {
  const item = lead.quotation_items?.[0];

  return lead.product_category || item?.item || "Product";
}

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
};

function DashboardMenu({
  menu,
  openMenu,
  setOpenMenu,
  onExport,
  onDownloadChart,
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
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 dark:hover:bg-[#071929] dark:hover:text-slate-200"
      >
        <FiMoreVertical size={17} />
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

/* ============================================================
   COMPONENT
============================================================ */

export default function Dashboard() {
  const { addToast } = useUIStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dbLeads, setDbLeads] = useState<DashboardLead[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const [chartMode, setChartMode] = useState<ChartMode>("yearly");

  const [activeChartIndex, setActiveChartIndex] = useState(0);

  const [hoveredChartIndex, setHoveredChartIndex] = useState<number | null>(
    null,
  );

  const [openMenu, setOpenMenu] = useState<MenuType>(null);

  const [showAllOrders, setShowAllOrders] = useState(false);

  const [hoveredPipelineIndex, setHoveredPipelineIndex] = useState<number | null>(
  null, );


  const chartRef = useRef<SVGSVGElement | null>(null);

  /* ==========================================================
     FETCH DATA
  ========================================================== */

  const fetchData = useCallback(async () => {
    try {
      setRefreshing(true);

      const [leadsResult, inventoryResult] = await Promise.allSettled([
        getLeadsApi(),
        getInventoryItemsApi(),
      ]);

      if (leadsResult.status === "fulfilled") {
        setDbLeads((leadsResult.value || []) as DashboardLead[]);
      } else {
        console.error("Failed to load leads:", leadsResult.reason);

        setDbLeads([]);
      }

      if (inventoryResult.status === "fulfilled") {
        setInventoryItems(inventoryResult.value || []);
      } else {
        console.error("Failed to load inventory:", inventoryResult.reason);

        setInventoryItems([]);
      }

      try {
        await getProductTypesApi();
      } catch {
        // Optional dashboard dependency.
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

  const wonLeads = useMemo(() => dbLeads.filter(isWonLead), [dbLeads]);

  const wonRevenue = useMemo(
    () => wonLeads.reduce((total, lead) => total + getLeadValue(lead), 0),
    [wonLeads],
  );

  const unitsSold = useMemo(
    () => wonLeads.reduce((total, lead) => total + getLeadUnits(lead), 0),
    [wonLeads],
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

    dbLeads.forEach((lead) => {
      const date = getLeadDate(lead);

      if (!date) {
        return;
      }

      if (date.getFullYear() !== currentYear) {
        return;
      }

      const month = date.getMonth();

      months[month].revenue += getLeadValue(lead);

      months[month].units += getLeadUnits(lead);
    });

    return months;
  }, [dbLeads]);

  /* ==========================================================
     YEARLY DATA
  ========================================================== */

  const yearlyRevenue = useMemo<ChartPoint[]>(() => {
    const currentYear = new Date().getFullYear();

    const startYear = currentYear - 5;

    return Array.from({ length: 6 }, (_, index) => startYear + index).map(
      (year) => {
        const yearLeads = dbLeads.filter(
          (lead) => getLeadDate(lead)?.getFullYear() === year,
        );

        return {
          label: String(year),
          year,
          revenue: yearLeads.reduce(
            (total, lead) => total + getLeadValue(lead),
            0,
          ),
          units: yearLeads.reduce(
            (total, lead) => total + getLeadUnits(lead),
            0,
          ),
        };
      },
    );
  }, [dbLeads]);

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

    wonLeads.forEach((lead) => {
      const date = getLeadDate(lead);

      if (!date) {
        return;
      }

      const revenue = getLeadValue(lead);

      const units = getLeadUnits(lead);

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
  }, [wonLeads]);

  /* ==========================================================
     REGIONAL PERFORMANCE
  ========================================================== */

  const regionalPerformance = useMemo<RegionalData[]>(() => {
    const map = new Map<string, RegionalData>();

    dbLeads.forEach((lead) => {
      const rawRegion = lead.state || lead.region;

      if (!rawRegion) {
        return;
      }

      const region = getRegionLabel(rawRegion);

      const current = map.get(region) || {
        name: region,
        revenue: 0,
      };

      current.revenue += getLeadValue(lead);

      map.set(region, current);
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [dbLeads]);

  const maxRegionRevenue = Math.max(
    ...regionalPerformance.map((region) => region.revenue),
    1,
  );

  const topRegion = regionalPerformance[0];

  /* ==========================================================
     STATE PERFORMANCE
  ========================================================== */

  const activeStates = useMemo(() => {
    const states = new Set<string>();

    dbLeads.forEach((lead) => {
      const value = lead.state || lead.region;

      if (value) {
        states.add(getRegionLabel(value));
      }
    });

    return states.size;
  }, [dbLeads]);

  /* ==========================================================
     SALES TEAM
  ========================================================== */

  const salesTeam = useMemo<SalesPerson[]>(() => {
    const map = new Map<string, SalesPerson>();

    dbLeads.forEach((lead) => {
      const name = lead.assigned_to_name || lead.creator_name || "Sales Team";

      const current = map.get(name) || {
        name,
        revenue: 0,
        units: 0,
        deals: 0,
        conversion: 0,
      };

      current.revenue += getLeadValue(lead);

      current.units += getLeadUnits(lead);

      if (isWonLead(lead)) {
        current.deals += 1;
      }

      map.set(name, current);
    });

    const result = Array.from(map.values());

    result.forEach((person) => {
      const leadCount = dbLeads.filter(
        (lead) =>
          (lead.assigned_to_name || lead.creator_name || "Sales Team") ===
          person.name,
      ).length;

      person.conversion =
        leadCount > 0 ? Math.round((person.deals / leadCount) * 100) : 0;
    });

    return result.sort((a, b) => b.revenue - a.revenue).slice(0, 4);
  }, [dbLeads]);

  const topSalesPerson = salesTeam[0];

  /* ==========================================================
     PRODUCT DISTRIBUTION
  ========================================================== */

  const productDistribution = useMemo<ProductData[]>(() => {
    const distribution = new Map<string, number>();

    inventoryItems.forEach((item) => {
      const product = item.product_type_code || item.category || "Other";

      const quantity =
        Number(item.attributes?.quantity) ||
        Number(item.attributes?.stock) ||
        1;

      distribution.set(product, (distribution.get(product) || 0) + quantity);
    });

    if (distribution.size === 0) {
      wonLeads.forEach((lead) => {
        lead.quotation_items?.forEach((item) => {
          const name = item.item || "Product";

          const quantity = Number(item.qty || 0);

          distribution.set(name, (distribution.get(name) || 0) + quantity);
        });
      });
    }

    const entries = Array.from(distribution.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const maxUnits = Math.max(...entries.map(([, units]) => units), 1);

    return entries.map(([name, units]) => ({
      name,
      units,
      percentage: (units / maxUnits) * 100,
    }));
  }, [inventoryItems, wonLeads]);

  /* ==========================================================
     SALES PIPELINE
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
      const key = getStageKey(lead);

      const current = map.get(key);

      if (!current) {
        return;
      }

      current.count += 1;

      current.revenue += getLeadValue(lead);
    });

    return PIPELINE_STAGES.map((stage) => map.get(stage.key)!);
  }, [dbLeads]);

  /* ==========================================================
   ALL ORDERS
========================================================== */
  const allOrders = useMemo(() => {
    return [...dbLeads]
      .filter(
        (lead) =>
          getLeadValue(lead) > 0 || isWonLead(lead) || isQuotationLead(lead),
      )
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
  }, [dbLeads]);

  /* ==========================================================
   RECENT ORDERS
========================================================== */
  const recentOrders = useMemo(() => {
    return allOrders.slice(0, 5);
  }, [allOrders]);

  /* ==========================================================
   DISPLAYED ORDERS
========================================================== */
  const displayedOrders = showAllOrders ? allOrders : recentOrders;

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
      ["Activity", "Sales Person", "Customer", "Value"],

      ...recentOrders.map((lead) => [
        isWonLead(lead)
          ? "Deal Closed"
          : isQuotationLead(lead)
            ? "New Quotation Sent"
            : "New Lead",

        lead.creator_name || "Sales Team",

        lead.title || "",

        getLeadValue(lead),
      ]),
    ]);
  }, [exportRows, recentOrders]);

  const exportOrdersData = useCallback(() => {
    exportRows(`recent-orders-${new Date().toISOString().slice(0, 10)}.csv`, [
      ["Order ID", "Customer", "Product", "Region", "Value", "Status"],

      ...displayedOrders.map((lead) => {
        const date = getLeadDate(lead);

        const year = date?.getFullYear() || new Date().getFullYear();

        const shortId = String(lead.id).slice(-3);

        const status = isWonLead(lead)
          ? "Delivered"
          : isQuotationLead(lead)
            ? "In Transit"
            : "Processing";

        return [
          `#ORD-${year}-${shortId}`,
          getCustomerName(lead),
          getProductName(lead),
          getRegionLabel(lead.state || lead.region),
          getLeadValue(lead),
          status,
        ];
      }),
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
    const funnelWidth = 500;
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

    const height = 80 + Math.max(recentOrders.length, 1) * rowHeight;

    const rows = recentOrders
      .map((lead, index) => {
        const y = 55 + index * rowHeight;

        const activity = isWonLead(lead)
          ? "Deal Closed"
          : isQuotationLead(lead)
            ? "New Quotation Sent"
            : "New Lead";

        const date = getLeadDate(lead);

        const dateLabel = date ? date.toLocaleDateString("en-IN") : "—";

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
                  ${lead.creator_name || "Sales Team"}
                </text>

                <text
                  x="60"
                  y="${y + 48}"
                  font-size="12"
                  fill="#64748b"
                >
                  ${lead.title || "Sales activity"}
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
                  ${formatCurrency(getLeadValue(lead))}
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
  }, [displayedOrders, addToast]);

  /* ==========================================================
     RECENT ORDERS CHART DOWNLOAD
  ========================================================== */

  const downloadOrdersChart = useCallback(() => {
    const width = 1100;

    const rowHeight = 70;

    const height = 90 + Math.max(recentOrders.length, 1) * rowHeight;

    const rows = displayedOrders
      .map((lead, index) => {
        const y = 65 + index * rowHeight;

        const date = getLeadDate(lead);

        const year = date?.getFullYear() || new Date().getFullYear();

        const shortId = String(lead.id).slice(-3);

        const status = isWonLead(lead)
          ? "Delivered"
          : isQuotationLead(lead)
            ? "In Transit"
            : "Processing";

        const statusFill =
          status === "Delivered"
            ? "#20c66b"
            : status === "In Transit"
              ? "#d99b28"
              : "#5c6bc0";

        return `
                <rect
                  x="20"
                  y="${y}"
                  width="1060"
                  height="52"
                  rx="8"
                  fill="#f7f8fa"
                />

                <text
                  x="40"
                  y="${y + 22}"
                  font-size="12"
                  font-weight="700"
                  fill="#18294a"
                >
                  #ORD-${year}-${shortId}
                </text>

                <text
                  x="190"
                  y="${y + 22}"
                  font-size="12"
                  fill="#38588f"
                >
                  ${getCustomerName(lead)}
                </text>

                <text
                  x="410"
                  y="${y + 22}"
                  font-size="12"
                  fill="#64748b"
                >
                  ${getProductName(lead)}
                </text>

                <text
                  x="600"
                  y="${y + 22}"
                  font-size="12"
                  fill="#64748b"
                >
                  ${getRegionLabel(lead.state || lead.region)}
                </text>

                <text
                  x="760"
                  y="${y + 22}"
                  font-size="13"
                  font-weight="700"
                  fill="#233353"
                >
                  ${formatCurrency(getLeadValue(lead))}
                </text>

                <rect
                  x="930"
                  y="${y + 10}"
                  width="120"
                  height="28"
                  rx="14"
                  fill="${statusFill}"
                  opacity="0.14"
                />

                <text
                  x="990"
                  y="${y + 29}"
                  text-anchor="middle"
                  font-size="11"
                  font-weight="700"
                  fill="${statusFill}"
                >
                  ${status}
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
            y="32"
            font-size="20"
            font-weight="700"
            fill="#18294a"
          >
            Recent Orders
          </text>

          ${rows}
        </svg>
      `;

    downloadSvg(
      `recent-orders-${new Date().toISOString().slice(0, 10)}.svg`,
      svg,
    );

    addToast("Orders chart downloaded.", "success");
  }, [recentOrders, addToast]);

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
    <div className="min-h-full space-y-5 bg-[#f7f7f7] pb-8 dark:bg-[#020b12]">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-[#18294a] dark:text-white">
            Dashboard
          </h2>

          <button
            type="button"
            onClick={fetchData}
            title="Refresh dashboard"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-[#0d2336] dark:bg-[#051422]"
          >
            <FiRefreshCw
              className={refreshing ? "animate-spin" : ""}
              size={14}
            />
          </button>
        </div>

        <DashboardMenu
          menu="dashboard"
          openMenu={openMenu}
          setOpenMenu={setOpenMenu}
          onExport={exportDashboardData}
          onDownloadChart={downloadRevenueChart}
        />
      </div>

      {/* ======================================================
          KPI CARDS
      ====================================================== */}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">
                Revenue Performance
              </p>

              <h3 className="mt-2 text-3xl font-bold tracking-tight text-[#233353] dark:text-white">
                {formatCurrency(wonRevenue)}
              </h3>

              <p className="mt-1 text-[11px] font-medium text-emerald-500">
                vs last month
              </p>
            </div>

            <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-500 dark:bg-emerald-500/10">
              ↗ {Math.abs(currentMonthStats.revenueChange).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400">Units Sold</p>

              <h3 className="mt-2 text-3xl font-bold tracking-tight text-[#233353] dark:text-white">
                {unitsSold.toLocaleString("en-IN")} Units
              </h3>

              <p className="mt-1 text-[11px] font-medium text-emerald-500">
                vs last month
              </p>
            </div>

            <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-500 dark:bg-emerald-500/10">
              ↗ {Math.abs(currentMonthStats.unitsChange).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
          <p className="text-xs font-medium text-slate-400">
            State Performance
          </p>

          <h3 className="mt-2 text-3xl font-bold tracking-tight text-[#233353] dark:text-white">
            {activeStates} Active
          </h3>

          <p className="mt-1 text-[11px] text-slate-400">
            Top State:{" "}
            <span className="font-medium">{topRegion?.name || "—"}</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
          <p className="text-xs font-medium text-slate-400">
            Sales Team Performance
          </p>

          <h3 className="mt-2 text-3xl font-bold tracking-tight text-[#233353] dark:text-white">
            {salesTeam.length} Active
          </h3>

          <p className="mt-1 text-[11px] text-slate-400">
            Top Performer:{" "}
            <span className="font-medium">{topSalesPerson?.name || "—"}</span>
          </p>
        </div>
      </section>

      {/* ======================================================
          REVENUE TREND
      ====================================================== */}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-[#18294a] dark:text-white">
              Revenue Trend
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              Historical billing performance across regions
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-[#0d2336] dark:bg-[#071929]">
              <button
                type="button"
                onClick={() => {
                  setChartMode("monthly");

                  setActiveChartIndex(new Date().getMonth());
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  chartMode === "monthly"
                    ? "bg-white text-slate-700 shadow-sm dark:bg-[#051422] dark:text-white"
                    : "text-slate-500"
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
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                  chartMode === "yearly"
                    ? "bg-white text-slate-700 shadow-sm dark:bg-[#051422] dark:text-white"
                    : "text-slate-500"
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

        <div className="relative mt-5 h-[300px] w-full">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-8">
            {[0, 1, 2, 3, 4].map((line) => (
              <div
                key={line}
                className="border-t border-dashed border-slate-100 dark:border-slate-800"
              />
            ))}
          </div>

          <svg
            ref={chartRef}
            viewBox="0 0 1000 300"
            preserveAspectRatio="none"
            className="absolute inset-x-0 top-0 h-[260px] w-full overflow-visible"
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
                  (chartPoints[hoveredChartIndex].y / 260) * 100 - 12,
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
                className={`text-[10px] font-medium ${
                  activeChartIndex === index
                    ? "font-semibold text-[#233353] dark:text-white"
                    : "text-slate-400"
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

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* PRODUCT */}

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#0d2336] dark:bg-[#051422]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-[#18294a] dark:text-white">
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

          <div className="mt-6 space-y-5">
            {productDistribution.length > 0 ? (
              productDistribution.slice(0, 3).map((product) => (
                <div key={product.name}>
                  <div className="mb-2 flex justify-between gap-3 text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {product.name}
                    </span>

                    <span className="font-bold text-[#233353] dark:text-slate-200">
                      {product.units.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-[#38588f]"
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
    <h3 className="text-lg font-bold text-[#18294a] dark:text-white">
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
            <h3 className="text-lg font-bold text-[#18294a] dark:text-white">
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

          <div className="mt-7 space-y-4">
            {regionalPerformance.length > 0 ? (
              regionalPerformance.map((region) => (
                <div key={region.name} className="flex items-center gap-3">
                  <span className="w-10 shrink-0 text-xs font-semibold text-slate-500">
                    {region.name}
                  </span>

                  <div className="relative flex-1">
                    <div className="h-8 rounded bg-slate-100 dark:bg-slate-800">
                      <div
                        className="flex h-8 items-center justify-end rounded bg-[#38588f] pr-2 text-[10px] font-bold text-white"
                        style={{
                          width: `${Math.max(
                            8,
                            (region.revenue / maxRegionRevenue) * 100,
                          )}%`,
                        }}
                      >
                        {formatCompactCurrency(region.revenue)}
                      </div>
                    </div>
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

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* SALES TEAM */}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2 dark:border-[#0d2336] dark:bg-[#051422]">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 dark:border-[#0d2336]">
            <div>
              <h3 className="text-lg font-bold text-[#18294a] dark:text-white">
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
              <h3 className="text-lg font-bold text-[#18294a] dark:text-white">
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
            {recentOrders.length > 0 ? (
              recentOrders.slice(0, 4).map((lead) => (
                <div
                  key={lead.id}
                  className="relative border-l-2 border-slate-200 pl-5 dark:border-slate-700"
                >
                  <div className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-white bg-[#38588f] dark:border-[#051422]" />

                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {isWonLead(lead)
                      ? "Deal Closed"
                      : isQuotationLead(lead)
                        ? "New Quotation Sent"
                        : "New Lead"}
                  </h4>

                  <p className="mt-1 text-[10px] text-slate-400">
                    {lead.creator_name || "Sales Team"}
                  </p>

                  <div className="mt-2 rounded-lg bg-slate-50 p-3 text-[10px] text-slate-500 dark:bg-[#071929] dark:text-slate-400">
                    {lead.title}
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
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 dark:border-[#0d2336]">
          <div>
            <h3 className="text-lg font-bold text-[#18294a] dark:text-white">
              {showAllOrders ? "All Orders" : "Recent Orders"}
            </h3>

            {showAllOrders && (
              <p className="mt-1 text-xs text-slate-400">
                Showing all {allOrders.length} orders
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
              className="text-xs font-semibold text-[#38588f] transition-colors hover:text-[#233353] dark:text-[#6f8fc4] dark:hover:text-white"
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[950px] text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 dark:border-[#0d2336] dark:bg-[#071929] dark:text-slate-400">
                <th className="px-5 py-4 font-semibold">Order ID</th>

                <th className="px-5 py-4 font-semibold">Customer</th>

                <th className="px-5 py-4 font-semibold">Product Category</th>

                <th className="px-5 py-4 font-semibold">Region</th>

                <th className="px-5 py-4 font-semibold">Contract Value</th>

                <th className="px-5 py-4 font-semibold">Status</th>

                <th className="px-5 py-4 text-right font-semibold">Action</th>
              </tr>
            </thead>

            <tbody>
              {displayedOrders.length > 0 ? (
                displayedOrders.map((lead) => {
                  const date = getLeadDate(lead);

                  const year = date?.getFullYear() || new Date().getFullYear();

                  const shortId = String(lead.id).slice(-3);

                  const value = getLeadValue(lead);

                  const status = isWonLead(lead)
                    ? "Delivered"
                    : isQuotationLead(lead)
                      ? "In Transit"
                      : "Processing";

                  return (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-100 last:border-0 dark:border-[#0d2336]"
                    >
                      {/* ORDER ID */}
                      <td className="px-5 py-5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        #ORD-{year}-{shortId}
                      </td>

                      {/* CUSTOMER */}
                      <td className="px-5 py-5 text-xs font-medium text-[#38588f]">
                        {getCustomerName(lead)}
                      </td>

                      {/* PRODUCT */}
                      <td className="px-5 py-5 text-xs text-slate-500">
                        {getProductName(lead)}
                      </td>

                      {/* REGION */}
                      <td className="px-5 py-5 text-xs text-slate-500">
                        {getRegionLabel(lead.state || lead.region)}
                      </td>

                      {/* CONTRACT VALUE */}
                      <td className="px-5 py-5 text-xs font-bold text-slate-700 dark:text-slate-300">
                        {formatCurrency(value)}
                      </td>

                      {/* STATUS */}
                      <td className="px-5 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold ${
                            status === "Delivered"
                              ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
                              : status === "In Transit"
                                ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10"
                                : "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10"
                          }`}
                        >
                          {status}
                        </span>
                      </td>

                      {/* ACTION */}
                      <td className="px-5 py-5 text-right">
                        <button
                          type="button"
                          title="View order"
                          onClick={() =>
                            addToast(
                              "Order details can be connected to the order detail view.",
                              "info",
                            )
                          }
                          className="text-slate-400 transition hover:text-[#38588f]"
                        >
                          <FiEye size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-xs text-slate-400"
                  >
                    No recent orders or quotations available.
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
