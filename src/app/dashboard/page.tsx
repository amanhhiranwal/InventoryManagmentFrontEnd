"use client";

import { useEffect, useState, useCallback } from "react";
import { getLeadsApi, Lead } from "@/features/workflows/api/workflows.api";
import { getInventoryItemsApi, InventoryItem, getProductTypesApi } from "@/features/inventory/api/inventory.api";
import { useUIStore } from "@/lib/store/ui.store";
import {
  FiCheckCircle,
  FiGrid,
  FiDownload,
  FiRefreshCw
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

const MONTH_NAMES = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export default function Dashboard() {
  const { addToast } = useUIStore();

  const [loading, setLoading] = useState(true);
  const [activeMonthIdx, setActiveMonthIdx] = useState<number>(new Date().getMonth());

  // Leads loaded from DB
  const [dbLeads, setDbLeads] = useState<Lead[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. Fetch leads for CRM & Sales Kanban Dashboard
      try {
        const leadsData = await getLeadsApi();
        setDbLeads(leadsData || []);
      } catch (err) {
        console.error("Failed to load CRM leads:", err);
        setDbLeads([]);
      }

      // 2. Fetch inventory items
      try {
        const items = await getInventoryItemsApi();
        setInventoryItems(items || []);
        await getProductTypesApi();
      } catch (err) {
        console.error("Failed to load inventory assets:", err);
      }

    } catch (err) {
      console.error(err);
      addToast("Failed to compile dashboard reports.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Dynamic Metrics Calculation from Real Data
  const totalLeadsCount = dbLeads.length;
  const activeOppsCount = dbLeads.filter(l => l.stage === "opportunity").length;
  const wonLeads = dbLeads.filter(l => l.stage === "quotation" || l.status === "won" || l.stage === "won");
  const wonDealsCount = wonLeads.length;

  let totalPipelineValue = 0;
  let totalWonRevenue = 0;
  let totalUnitsSold = 0;

  // Monthly Revenue breakdown based on real DB Leads created_at
  const monthlyData = MONTH_NAMES.map((name) => ({
    name,
    rev: 0,
    units: 0
  }));

  dbLeads.forEach((lead) => {
    let leadVal = 0;
    let leadQty = 0;

    if (lead.quotation_items && lead.quotation_items.length > 0) {
      lead.quotation_items.forEach((item) => {
        const q = item.qty || 1;
        const p = item.price || 0;
        leadVal += q * p;
        leadQty += q;
      });
    }

    totalPipelineValue += leadVal;

    if (lead.status === "won" || lead.stage === "won" || lead.stage === "quotation") {
      totalWonRevenue += leadVal;
      totalUnitsSold += leadQty;
    }

    if (lead.created_at) {
      const createdDate = new Date(lead.created_at);
      const mIdx = createdDate.getMonth();
      if (mIdx >= 0 && mIdx < 12) {
        monthlyData[mIdx].rev += leadVal / 10000000; // in Crores
        monthlyData[mIdx].units += leadQty;
      }
    }
  });

  // Calculate Product distribution from inventory items
  const productDistribution: Array<{ name: string; units: number; pct: number; color: string }> = [];
  const palette = ["bg-[#233353] dark:bg-sky-500", "bg-[#e27c26]", "bg-indigo-500", "bg-emerald-500", "bg-amber-500"];
  
  if (inventoryItems.length > 0) {
    const typeCounts: Record<string, number> = {};
    inventoryItems.forEach((item) => {
      const type = item.product_type_code || item.category || "General";
      const q = item.attributes?.quantity || item.attributes?.stock || 1;
      typeCounts[type] = (typeCounts[type] || 0) + q;
    });

    const totalStock = Object.values(typeCounts).reduce((a, b) => a + b, 0) || 1;
    Object.entries(typeCounts).forEach(([name, count], i) => {
      productDistribution.push({
        name,
        units: count,
        pct: Math.round((count / totalStock) * 100),
        color: palette[i % palette.length]
      });
    });
  }

  // Max value for revenue chart scale
  const maxMonthRev = Math.max(...monthlyData.map(m => m.rev), 1.0);

  const handleExportData = () => {
    addToast("Exporting revenue ledger data to CSV...", "info");
  };

  const handleDownloadChart = () => {
    addToast("Generating chart snapshot...", "info");
  };

  return (
    <div className="space-y-6 select-none">
      
      {/* Sub Navigation & Quick Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#051422] px-5 py-3.5 rounded-2xl border border-slate-200/80 dark:border-[#0d2336] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span className="text-[#233353] dark:text-white font-bold text-sm">Dashboard</span>
            <span>/</span>
            <span>Sales Analytics</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/70 dark:bg-[#071929] hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
          >
            <FiDownload className="text-xs" />
            <span>Export Data</span>
          </button>

          <button
            onClick={handleDownloadChart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/70 dark:bg-[#071929] hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
          >
            <FiGrid className="text-xs" />
            <span>Download Chart</span>
          </button>

          <button
            onClick={fetchData}
            title="Refresh Data"
            className="p-2 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/70 dark:bg-[#071929] hover:bg-slate-100 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
          >
            <FiRefreshCw className="text-xs" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-slate-400">
          <CgSpinner className="animate-spin text-4xl text-[#233353] dark:text-sky-400" />
          <span className="text-xs font-semibold">Compiling real-time dashboard ledger...</span>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* ==================== 1. TOP KPI METRICS ROW (Bento Style) ==================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Metric 1: Revenue Performance */}
            <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Revenue Realized
              </span>
              <div className="my-2">
                <h3 className="text-3xl font-extrabold text-[#233353] dark:text-white font-sans tracking-tight">
                  ₹{totalWonRevenue >= 10000000
                    ? `${(totalWonRevenue / 10000000).toFixed(2)} Cr`
                    : totalWonRevenue >= 100000
                    ? `${(totalWonRevenue / 100000).toFixed(2)} L`
                    : totalWonRevenue.toLocaleString("en-IN")}
                </h3>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
                <span className="text-slate-400">Won Orders</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[11px]">
                  {wonDealsCount} Closed
                </span>
              </div>
            </div>

            {/* Metric 2: Units Sold */}
            <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Units Deployed
              </span>
              <div className="my-2">
                <h3 className="text-3xl font-extrabold text-[#233353] dark:text-white font-sans tracking-tight">
                  {totalUnitsSold.toLocaleString("en-IN")} <span className="text-lg font-semibold text-slate-400">Units</span>
                </h3>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
                <span className="text-slate-400">Stock in Inventory</span>
                <span className="inline-flex items-center gap-1 font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full text-[11px]">
                  {inventoryItems.length} Products
                </span>
              </div>
            </div>

            {/* Metric 3: Won Deals */}
            <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Won Deals
              </span>
              <div className="my-2">
                <h3 className="text-3xl font-extrabold text-[#233353] dark:text-white font-sans tracking-tight">
                  {wonDealsCount} <span className="text-lg font-semibold text-slate-400">Deals</span>
                </h3>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
                <span className="text-slate-400">Conversion</span>
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[11px]">
                  <FiCheckCircle className="text-xs" /> {totalLeadsCount > 0 ? `${Math.round((wonDealsCount / totalLeadsCount) * 100)}%` : "0%"}
                </span>
              </div>
            </div>

            {/* Metric 4: Active Pipeline Value */}
            <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Active Pipeline Value
              </span>
              <div className="my-2">
                <h3 className="text-3xl font-extrabold text-[#233353] dark:text-white font-sans tracking-tight font-mono">
                  ₹{totalPipelineValue >= 10000000
                    ? `${(totalPipelineValue / 10000000).toFixed(2)} Cr`
                    : totalPipelineValue >= 100000
                    ? `${(totalPipelineValue / 100000).toFixed(2)} L`
                    : totalPipelineValue.toLocaleString("en-IN")}
                </h3>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
                <span className="text-slate-400">Total Leads:</span>
                <span className="font-bold text-[#233353] dark:text-sky-400">{totalLeadsCount} Records</span>
              </div>
            </div>

          </div>

          {/* ==================== 2. MAIN BENTO GRID (Annual Revenue Trend + Units By Product) ==================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* LARGE CHART: Annual Revenue Trend */}
            <div className="lg:col-span-2 bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-6 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#0d2336]">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white font-sans">
                    Annual Revenue Trend
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Monthly billing & collections overview across FY {new Date().getFullYear()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#233353] dark:text-sky-400 bg-slate-100 dark:bg-[#071929] px-2.5 py-1 rounded-lg">
                    Selected: {monthlyData[activeMonthIdx]?.name} (₹{(monthlyData[activeMonthIdx]?.rev || 0).toFixed(2)} Cr)
                  </span>
                </div>
              </div>

              {/* Interactive SVG Chart Container */}
              <div className="py-6 relative">
                <div className="h-56 w-full relative flex items-end">
                  
                  {/* Subtle Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-40">
                    <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full" />
                    <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full" />
                    <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full" />
                    <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full" />
                  </div>

                  {/* Interactive Month Columns */}
                  <div className="relative w-full h-full flex items-end justify-between z-10 px-2">
                    {monthlyData.map((m, idx) => {
                      const isHovered = activeMonthIdx === idx;
                      const barHeight = m.rev > 0 ? `${Math.max((m.rev / maxMonthRev) * 100, 8)}%` : "4px";

                      return (
                        <div
                          key={m.name}
                          onMouseEnter={() => setActiveMonthIdx(idx)}
                          className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative"
                        >
                          {/* Tooltip on active bar */}
                          {isHovered && (
                            <div className="absolute -top-12 bg-[#233353] text-white text-[11px] font-bold py-1 px-2.5 rounded-lg shadow-xl whitespace-nowrap z-20 pointer-events-none animate-fadeIn flex flex-col items-center">
                              <span>₹{m.rev.toFixed(2)} Cr</span>
                              <span className="text-[9px] font-normal text-slate-300">{m.units} Units</span>
                              <div className="w-2 h-2 bg-[#233353] rotate-45 -mb-1 mt-0.5" />
                            </div>
                          )}

                          {/* Bar Pill Indicator */}
                          <div
                            className={`w-3.5 rounded-t-lg transition-all duration-200 ${
                              isHovered
                                ? "bg-[#e27c26] shadow-md shadow-[#e27c26]/30"
                                : m.rev > 0
                                ? "bg-[#233353] dark:bg-sky-500 hover:bg-[#101725]"
                                : "bg-slate-200/60 dark:bg-slate-800"
                            }`}
                            style={{ height: barHeight }}
                          />
                        </div>
                      );
                    })}
                  </div>

                </div>

                {/* X-Axis Month Labels */}
                <div className="flex justify-between items-center pt-3 text-[10px] font-bold text-slate-400 px-2">
                  {monthlyData.map((m, idx) => (
                    <span
                      key={m.name}
                      className={activeMonthIdx === idx ? "text-[#233353] dark:text-sky-400 font-extrabold" : ""}
                    >
                      {m.name}
                    </span>
                  ))}
                </div>
              </div>

            </div>

            {/* RIGHT CARD: Units by Product */}
            <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-6 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-[#0d2336]">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Stock by Category
                  </h3>
                  <span className="text-xs font-bold text-[#e27c26] bg-[#e27c26]/10 px-2 py-0.5 rounded-full">
                    {inventoryItems.length} Products
                  </span>
                </div>

                {productDistribution.length > 0 ? (
                  <div className="space-y-4 pt-4">
                    {productDistribution.map((p) => (
                      <div key={p.name} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-800 dark:text-slate-200">{p.name}</span>
                          <span className="font-bold font-mono text-slate-500">{p.units} ({p.pct}%)</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 dark:bg-[#0d2336] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${p.color}`} style={{ width: `${p.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs italic">
                    No inventory catalog items registered yet.
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-[#0d2336] flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Deployment</span>
                <span className="font-extrabold text-[#233353] dark:text-white font-mono">{totalUnitsSold} Units Sold</span>
              </div>
            </div>

          </div>

          {/* ==================== 3. LOWER SECTION: Conversion Funnel & Pipeline Records ==================== */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            
            {/* Conversion Funnel */}
            <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Sales Conversion Funnel
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">Stage velocity & conversion ratios</p>
              </div>

              <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">1. Leads Received ({totalLeadsCount})</span>
                    <span className="text-slate-400">100%</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 dark:bg-[#0d2336] rounded-full overflow-hidden">
                    <div className="h-full bg-[#233353] rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">2. Qualified Opportunities ({activeOppsCount})</span>
                    <span className="text-slate-400">
                      {totalLeadsCount > 0 ? `${Math.round((activeOppsCount / totalLeadsCount) * 100)}%` : "0%"}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 dark:bg-[#0d2336] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${totalLeadsCount > 0 ? (activeOppsCount / totalLeadsCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">
                      3. Proposals & Quotations ({dbLeads.filter(l => l.stage === "quotation").length})
                    </span>
                    <span className="text-slate-400">
                      {totalLeadsCount > 0 ? `${Math.round((dbLeads.filter(l => l.stage === "quotation").length / totalLeadsCount) * 100)}%` : "0%"}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 dark:bg-[#0d2336] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${totalLeadsCount > 0 ? (dbLeads.filter(l => l.stage === "quotation").length / totalLeadsCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-emerald-600">
                    <span>4. Closed Won Deals ({wonDealsCount})</span>
                    <span>{totalLeadsCount > 0 ? `${Math.round((wonDealsCount / totalLeadsCount) * 100)}%` : "0%"}</span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 dark:bg-[#0d2336] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${totalLeadsCount > 0 ? (wonDealsCount / totalLeadsCount) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="text-right pt-2 border-t border-slate-100 dark:border-[#0d2336]">
                <span className="text-[10px] text-slate-400 font-semibold">
                  {wonDealsCount} Deals Won of {totalLeadsCount} Leads
                </span>
              </div>
            </div>

            {/* Upcoming Follow-ups & Recent Activities */}
            <div className="lg:col-span-2 bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-6 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#0d2336]">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Active Leads & Scheduled Activities
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">Real-time pipeline lead status</p>
                </div>
                <span className="text-xs font-bold text-[#233353] dark:text-sky-400 bg-slate-100 dark:bg-[#071929] px-2.5 py-1 rounded-lg">
                  {dbLeads.length} Total Leads
                </span>
              </div>

              {dbLeads.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-[#0d2336] my-2">
                  {dbLeads.slice(0, 4).map((lead, idx) => (
                    <div key={lead.id} className="flex items-center justify-between py-3 hover:bg-slate-50/50 dark:hover:bg-[#071929]/30 px-2 rounded-xl transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#233353]/10 text-[#233353] dark:text-sky-400 flex items-center justify-center font-bold text-xs font-mono">
                          {idx + 1}
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                            {lead.title}
                          </h5>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Created by: {lead.creator_name || "Sales Team"} • Stage: {lead.stage}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          lead.status === "won" || lead.stage === "won"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : lead.stage === "opportunity"
                            ? "bg-blue-500/10 text-blue-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}>
                          {lead.status?.toUpperCase() || lead.stage.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  No active leads or scheduled tasks found. Create a lead to view real-time pipeline updates.
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 dark:border-[#0d2336] flex justify-end">
                <a
                  href="/leads"
                  className="text-xs font-bold text-[#233353] dark:text-sky-400 hover:underline cursor-pointer"
                >
                  View All Leads Pipeline →
                </a>
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
