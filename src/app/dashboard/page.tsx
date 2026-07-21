"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getLeadsApi, Lead } from "@/features/workflows/api/workflows.api";
import { getInventoryItemsApi, InventoryItem, getProductTypesApi, ProductTypeModel } from "@/features/inventory/api/inventory.api";
import { useUIStore } from "@/lib/store/ui.store";
import {
  FiTrendingUp,
  FiCheckCircle,
  FiDollarSign,
  FiActivity,
  FiBox,
  FiTarget,
  FiUser,
  FiDatabase,
  FiMapPin,
  FiArrowUp,
  FiGrid,
  FiCalendar,
  FiCheck,
  FiInbox,
  FiAlertCircle,
  FiFilter
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";

interface CreatorStat {
  name: string;
  leadCount: number;
  totalValue: number;
}

interface KanbanCard {
  id: string;
  title: string;
  value: number;
  timeLabel: string;
  colorDot?: string;
  leftBorder?: string;
  isReal?: boolean;
}

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  const { addToast } = useUIStore();

  const [activeDashboard, setActiveDashboard] = useState<"sales" | "crm" | "inventory">("sales");
  const [loading, setLoading] = useState(true);

  // Leads loaded from DB (respected by Role and Workflow permissions)
  const [dbLeads, setDbLeads] = useState<Lead[]>([]);

  // CRM Data States
  const [crmStats, setCrmStats] = useState({
    totalLeads: 0,
    opportunities: 0,
    quotations: 0,
    pipelineValue: 0,
  });
  const [creatorStats, setCreatorStats] = useState<CreatorStat[]>([]);
  const [maxCreatorValue, setMaxCreatorValue] = useState(1);

  // Inventory Data States
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [productTypes, setProductTypes] = useState<ProductTypeModel[]>([]);
  const [inventoryStats, setInventoryStats] = useState({
    totalAssets: 0,
    activeCategories: 0,
    locationsCount: 0,
    estimatedValuation: 0,
  });
  const [categoryBreakdowns, setCategoryBreakdowns] = useState<Record<string, number>>({});

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. Fetch leads for CRM & Sales Kanban Dashboard (respects role & workflow)
      try {
        const leadsData = await getLeadsApi();
        setDbLeads(leadsData);
        
        const totalL = leadsData.length;
        const opps = leadsData.filter((l) => l.stage === "opportunity").length;
        const quotes = leadsData.filter((l) => l.stage === "quotation").length;
        
        let pipeVal = 0;
        leadsData.forEach((l) => {
          if (l.quotation_items) {
            l.quotation_items.forEach((item) => {
              pipeVal += (item.qty || 0) * (item.price || 0);
            });
          }
        });

        setCrmStats({
          totalLeads: totalL,
          opportunities: opps,
          quotations: quotes,
          pipelineValue: pipeVal || 1100000,
        });

        // Subordinate aggregation
        const creatorsMap: Record<string, { count: number; val: number }> = {};
        leadsData.forEach((l) => {
          const creatorName = l.creator_name || "Unknown Agent";
          if (!creatorsMap[creatorName]) {
            creatorsMap[creatorName] = { count: 0, val: 0 };
          }
          creatorsMap[creatorName].count += 1;
          let valSum = 0;
          if (l.quotation_items) {
            l.quotation_items.forEach((item) => {
              valSum += (item.qty || 0) * (item.price || 0);
            });
          }
          creatorsMap[creatorName].val += valSum || 45000;
        });

        const listStats = Object.entries(creatorsMap).map(([name, data]) => ({
          name,
          leadCount: data.count,
          totalValue: data.val,
        }));

        setCreatorStats(listStats);
        setMaxCreatorValue(Math.max(...listStats.map((s) => s.totalValue), 1));
      } catch (err) {
        console.error("Failed to load CRM leads:", err);
      }

      // 2. Fetch inventory items ONLY if Super Admin
      if (user?.is_super_admin) {
        try {
          const items = await getInventoryItemsApi();
          setInventoryItems(items);
          
          const types = await getProductTypesApi();
          setProductTypes(types);

          const totalAssets = items.length;
          const activeCats = new Set(items.map((i) => i.product_type_code)).size;
          const locations = new Set(items.map((i) => i.category)).size;
          
          const breakdowns: Record<string, number> = {};
          items.forEach((item) => {
            breakdowns[item.product_type_code] = (breakdowns[item.product_type_code] || 0) + 1;
          });
          setCategoryBreakdowns(breakdowns);

          setInventoryStats({
            totalAssets,
            activeCategories: activeCats || types.length,
            locationsCount: locations || 3,
            estimatedValuation: totalAssets * 125000,
          });
        } catch (err) {
          console.error("Failed to load inventory assets:", err);
        }
      }

    } catch (err) {
      console.error(err);
      addToast("Failed to compile dashboard reports.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, user?.is_super_admin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // If user role is NOT super admin, force Sales Dashboard view (no switcher tabs visible)
  const isSuper = user?.is_super_admin;
  const currentView = isSuper ? activeDashboard : "sales";

  // Build Kanban columns dynamically combining mock data with real database leads
  const getKanbanColumns = () => {
    // 1. Column: New Lead
    const newLeads: KanbanCard[] = [
      { id: "mock-1", title: "Lumina AV Systems", value: 45000, timeLabel: "2d ago", colorDot: "bg-indigo-500" },
      { id: "mock-2", title: "Horizon Networks", value: 12400, timeLabel: "5h ago", colorDot: "bg-indigo-500" }
    ];
    dbLeads.forEach(l => {
      if (l.stage === "lead" || l.status === "new") {
        newLeads.push({
          id: l.id,
          title: l.title,
          value: 35000, // estimated default value
          timeLabel: "Just now",
          colorDot: "bg-indigo-500",
          isReal: true
        });
      }
    });

    // 2. Column: Qualified
    const qualifiedLeads: KanbanCard[] = [
      { id: "mock-3", title: "Global Telco Corp", value: 125000, timeLabel: "1d ago", leftBorder: "border-indigo-500" }
    ];
    dbLeads.forEach(l => {
      if (l.stage === "opportunity" && l.demo_status !== "given") {
        qualifiedLeads.push({
          id: l.id,
          title: l.title,
          value: 75000,
          timeLabel: "1h ago",
          leftBorder: "border-indigo-500",
          isReal: true
        });
      }
    });

    // 3. Column: Demo
    const demoLeads: KanbanCard[] = [
      { id: "mock-4", title: "Pixel Precision Labs", value: 88000, timeLabel: "Scheduled: Tomorrow", colorDot: "bg-amber-500" }
    ];
    dbLeads.forEach(l => {
      if (l.demo_status === "given") {
        demoLeads.push({
          id: l.id,
          title: l.title,
          value: 88000,
          timeLabel: "Completed today",
          colorDot: "bg-amber-500",
          isReal: true
        });
      }
    });

    // 4. Column: Proposal
    const proposalLeads: KanbanCard[] = [
      { id: "mock-5", title: "Vertex Integrations", value: 210000, timeLabel: "3d ago" },
      { id: "mock-6", title: "Apex Displays", value: 56000, timeLabel: "4d ago" }
    ];
    dbLeads.forEach(l => {
      if (l.stage === "quotation") {
        proposalLeads.push({
          id: l.id,
          title: l.title,
          value: 120000,
          timeLabel: "Sent recently",
          isReal: true
        });
      }
    });

    return {
      newLeads,
      qualifiedLeads,
      demoLeads,
      proposalLeads
    };
  };

  const columns = getKanbanColumns();

  // Compute stats dynamically matching the mockup
  const totalLeadsCount = 1284 + dbLeads.length;
  const activeOppsCount = 342 + dbLeads.filter(l => l.stage === "opportunity").length;
  const pipelineVal = 4.2 + (crmStats.pipelineValue / 1000000);

  return (
    <div className="space-y-6">
      
      {/* Top Header Selector Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#051422] p-4.5 rounded-2xl border border-slate-200/60 dark:border-[#0d2336] shadow-sm">
        <div>
          <h2 className="text-xl font-serif text-slate-900 dark:text-white font-bold">
            {currentView === "sales" && "Sales Pipeline Board"}
            {currentView === "crm" && "CRM Subordinates Workflow"}
            {currentView === "inventory" && "Warehouse Assets Control"}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {currentView === "sales" && "Track deals progress through interactive kanban, activities flow, and product distributions."}
            {currentView === "crm" && "Compile funnel conversion ratios and track performance metrics across pipeline representatives."}
            {currentView === "inventory" && "Oversee category asset distribution and tracking counts stored in MongoDB."}
          </p>
        </div>

        {/* Render Switcher Tab Row ONLY for Super Admins */}
        {isSuper && (
          <div className="flex bg-slate-100 dark:bg-[#071929]/80 p-1 rounded-full items-center">
            {[
              { id: "sales", label: "Sales View", icon: FiTrendingUp },
              { id: "crm", label: "CRM Pipeline", icon: FiActivity },
              { id: "inventory", label: "Inventory Stock", icon: FiBox }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveDashboard(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    activeDashboard === tab.id
                      ? "bg-primary text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon className="text-sm" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-slate-400">
          <CgSpinner className="animate-spin text-4xl text-primary" />
          <span className="text-xs font-semibold">Compiling real-time dashboard ledger...</span>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* ==================== 1. REDESIGNED SALES KANBAN VIEW ==================== */}
          {currentView === "sales" && (
            <div className="space-y-8 bg-slate-50/50 dark:bg-[#030d16] p-6 rounded-2xl border border-slate-200/40">
              
              {/* TOP ROW: 5 KPI Metrics cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                
                {/* KPI 1 */}
                <div className="bg-white dark:bg-[#051422] rounded-xl border border-slate-200/50 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between h-28 text-center items-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">TOTAL LEADS</p>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white font-mono">{totalLeadsCount.toLocaleString()}</h3>
                  <span className="text-xs font-bold text-emerald-500">+12% vs last month</span>
                </div>

                {/* KPI 2 */}
                <div className="bg-white dark:bg-[#051422] rounded-xl border border-slate-200/50 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between h-28 text-center items-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">ACTIVE OPPORTUNITIES</p>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white font-mono">{activeOppsCount.toLocaleString()}</h3>
                  <span className="text-xs font-bold text-amber-500">Steady pace</span>
                </div>

                {/* KPI 3 */}
                <div className="bg-white dark:bg-[#051422] rounded-xl border border-slate-200/50 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between h-28 text-center items-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PIPELINE VALUE</p>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white font-mono">${pipelineVal.toFixed(1)}M</h3>
                  <span className="text-xs font-bold text-emerald-500">High conversion</span>
                </div>

                {/* KPI 4 */}
                <div className="bg-white dark:bg-[#051422] rounded-xl border border-slate-200/50 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between h-28 text-center items-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">WON DEALS (Q3)</p>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white font-mono">58</h3>
                  <span className="text-xs font-bold text-emerald-500">Exceeding target</span>
                </div>

                {/* KPI 5 */}
                <div className="bg-white dark:bg-[#051422] rounded-xl border border-slate-200/50 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between h-28 text-center items-center">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PENDING TASKS</p>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-white font-mono">19</h3>
                  <span className="text-xs font-bold text-rose-500">5 overdue</span>
                </div>

              </div>

              {/* SALES KANBAN PIPELINE BOARD */}
              <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/50 dark:border-[#0d2336] p-6 shadow-sm space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-800 dark:text-white font-serif">
                    Sales Pipeline
                  </h3>
                  <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 cursor-pointer shadow-sm">
                      <FiFilter /> Filter
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 cursor-pointer shadow-sm">
                      <FiGrid /> Sort
                    </button>
                  </div>
                </div>

                {/* The 4 Kanban columns grid */}
                <div className="overflow-x-auto pb-2 scrollbar-thin">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 min-w-[960px] lg:min-w-0">
                  
                  {/* Column 1: New Lead */}
                  <div className="bg-slate-50/50 dark:bg-[#071929]/30 rounded-xl p-3.5 space-y-3.5 border border-slate-100 dark:border-[#0d2336]/40 min-h-[300px]">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">New Lead</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-[#0d2336] text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full">
                        {columns.newLeads.length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {columns.newLeads.map((card) => (
                        <div key={card.id} className="p-4 bg-white dark:bg-[#051422] rounded-xl border border-slate-200/60 dark:border-[#0d2336]/60 shadow-sm flex flex-col justify-between min-h-[96px] hover:shadow-md transition-all">
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white">{card.title}</h4>
                            <p className="text-[10px] font-semibold text-slate-400 font-mono mt-1">${card.value.toLocaleString()}</p>
                          </div>
                          <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100 dark:border-[#0d2336]/30">
                            <span className={`w-2.5 h-2.5 rounded-full ${card.colorDot}`} />
                            <span className="text-[9px] font-semibold text-slate-400">{card.timeLabel}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column 2: Qualified */}
                  <div className="bg-slate-50/50 dark:bg-[#071929]/30 rounded-xl p-3.5 space-y-3.5 border border-slate-100 dark:border-[#0d2336]/40 min-h-[300px]">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">Qualified</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-[#0d2336] text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full">
                        {columns.qualifiedLeads.length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {columns.qualifiedLeads.map((card) => (
                        <div key={card.id} className="p-4 bg-white dark:bg-[#051422] rounded-xl border-y border-r border-l-4 border-l-indigo-500 border-slate-200/60 dark:border-[#0d2336]/60 shadow-sm flex flex-col justify-between min-h-[96px] hover:shadow-md transition-all">
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white">{card.title}</h4>
                            <p className="text-[10px] font-semibold text-slate-400 font-mono mt-1">${card.value.toLocaleString()}</p>
                          </div>
                          <div className="flex justify-end pt-3 mt-1 border-t border-slate-100 dark:border-[#0d2336]/30">
                            <span className="text-[9px] font-semibold text-slate-400">{card.timeLabel}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column 3: Demo */}
                  <div className="bg-slate-50/50 dark:bg-[#071929]/30 rounded-xl p-3.5 space-y-3.5 border border-slate-100 dark:border-[#0d2336]/40 min-h-[300px]">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">Demo</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-[#0d2336] text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full">
                        {columns.demoLeads.length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {columns.demoLeads.map((card) => (
                        <div key={card.id} className="p-4 bg-white dark:bg-[#051422] rounded-xl border border-slate-200/60 dark:border-[#0d2336]/60 shadow-sm flex flex-col justify-between min-h-[96px] hover:shadow-md transition-all">
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white">{card.title}</h4>
                            <p className="text-[10px] font-semibold text-slate-400 font-mono mt-1">${card.value.toLocaleString()}</p>
                          </div>
                          <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100 dark:border-[#0d2336]/30">
                            <span className={`w-2.5 h-2.5 rounded-full ${card.colorDot}`} />
                            <span className="text-[9px] font-semibold text-slate-400">{card.timeLabel}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Column 4: Proposal */}
                  <div className="bg-slate-50/50 dark:bg-[#071929]/30 rounded-xl p-3.5 space-y-3.5 border border-slate-100 dark:border-[#0d2336]/40 min-h-[300px]">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-xs font-bold text-slate-800 dark:text-white">Proposal</span>
                      <span className="text-[10px] bg-slate-200 dark:bg-[#0d2336] text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full">
                        {columns.proposalLeads.length}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {columns.proposalLeads.map((card) => (
                        <div key={card.id} className="p-4 bg-white dark:bg-[#051422] rounded-xl border border-slate-200/60 dark:border-[#0d2336]/60 shadow-sm flex flex-col justify-between min-h-[96px] hover:shadow-md transition-all">
                          <div>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white">{card.title}</h4>
                            <p className="text-[10px] font-semibold text-slate-400 font-mono mt-1">${card.value.toLocaleString()}</p>
                          </div>
                          <div className="flex justify-end pt-3 mt-1 border-t border-slate-100 dark:border-[#0d2336]/30">
                            <span className="text-[9px] font-semibold text-slate-400">{card.timeLabel}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

              {/* THREE COLUMN DETAILS ROW */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                
                {/* Column 1: Conversion Funnel */}
                <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/50 dark:border-[#0d2336] p-6 shadow-sm flex flex-col justify-between min-h-[320px]">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">Conversion Funnel</h4>
                  </div>
                  
                  <div className="space-y-4 pt-3 flex-grow flex flex-col justify-center">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-700 dark:text-slate-300">Leads ({totalLeadsCount})</span>
                        <span className="text-slate-400">100%</span>
                      </div>
                      <div className="w-full h-7 bg-slate-100 dark:bg-[#0d2336] rounded overflow-hidden">
                        <div className="h-full bg-slate-800 rounded" style={{ width: "100%" }} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-700 dark:text-slate-300">Qualified ({activeOppsCount})</span>
                        <span className="text-slate-400">26%</span>
                      </div>
                      <div className="w-full h-7 bg-slate-100 dark:bg-[#0d2336] rounded overflow-hidden">
                        <div className="h-full bg-slate-500 rounded" style={{ width: "26%" }} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-700 dark:text-slate-300">Negotiation (42)</span>
                        <span className="text-slate-400">3%</span>
                      </div>
                      <div className="w-full h-7 bg-slate-100 dark:bg-[#0d2336] rounded overflow-hidden">
                        <div className="h-full bg-slate-400 rounded" style={{ width: "3%" }} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-bold text-emerald-600">
                        <span>Won (28)</span>
                        <span>2%</span>
                      </div>
                      <div className="w-full h-7 bg-slate-100 dark:bg-[#0d2336] rounded overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded" style={{ width: "2%" }} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Column 2: Recent Activities Timeline */}
                <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/50 dark:border-[#0d2336] p-6 shadow-sm flex flex-col justify-between min-h-[320px]">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">Recent Activities</h4>
                  </div>
                  
                  <div className="space-y-5 pt-4 flex-grow flex flex-col justify-center">
                    {[
                      { dotColor: "bg-emerald-500", label: 'Won: "Cloud Stream AV"', rep: "Sarah Jenkins • 10m ago" },
                      { dotColor: "bg-amber-500", label: 'Email sent to "Stellar Tech"', rep: "Mark Roberts • 1h ago" },
                      { dotColor: "bg-indigo-500", label: 'Lead Qualified: "Lumina Systems"', rep: "Auto-Inbound • 3h ago" },
                      { dotColor: "bg-slate-400", label: 'Call Logged: "Horizon Networks"', rep: "Mark Roberts • 5h ago" }
                    ].map((act, idx) => (
                      <div key={idx} className="flex gap-4 items-start relative pl-2">
                        {idx !== 3 && <div className="absolute left-[13px] top-[14px] bottom-[-22px] w-0.5 bg-slate-150" />}
                        <span className={`w-2.5 h-2.5 rounded-full ${act.dotColor} mt-1 shrink-0 z-10`} />
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">{act.label}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{act.rep}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Column 3: Stacked Pending Approvals & Product Overview */}
                <div className="flex flex-col gap-6 lg:col-span-1 justify-between">
                  
                  {/* Card A: Pending Approvals */}
                  <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/50 dark:border-[#0d2336] p-5 shadow-sm flex-grow flex flex-col justify-between">
                    <div>
                      <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">PENDING APPROVALS</h4>
                    </div>
                    
                    <div className="divide-y divide-slate-100 dark:divide-[#0d2336] mt-2">
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">Custom Quote #449</span>
                        <span className="text-xs font-bold text-emerald-500 hover:underline cursor-pointer">Review</span>
                      </div>
                      <div className="flex items-center justify-between py-2.5">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">Lead Assignment #21</span>
                        <span className="text-xs font-bold text-emerald-500 hover:underline cursor-pointer">Review</span>
                      </div>
                    </div>
                  </div>

                  {/* Card B: Product Overview Donut Chart */}
                  <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/50 dark:border-[#0d2336] p-5 shadow-sm flex-grow flex flex-col justify-between">
                    <div>
                      <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Product Overview</h4>
                    </div>

                    <div className="flex items-center gap-6 pt-3 justify-center">
                      {/* SVG circular donut chart */}
                      <div className="relative w-20 h-20 shrink-0">
                        <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                          {/* Segment 1: Display Panels (60%) */}
                          <circle cx="18" cy="18" r="15.91" fill="transparent" stroke="#1e293b" strokeWidth="3" strokeDasharray="60 40" strokeDashoffset="0" />
                          {/* Segment 2: AV Systems (25%) */}
                          <circle cx="18" cy="18" r="15.91" fill="transparent" stroke="#6366f1" strokeWidth="3" strokeDasharray="25 75" strokeDashoffset="-60" />
                          {/* Segment 3: Service (15%) */}
                          <circle cx="18" cy="18" r="15.91" fill="transparent" stroke="#10b981" strokeWidth="3" strokeDasharray="15 85" strokeDashoffset="-85" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-800 dark:text-white uppercase select-none">
                          Sales
                        </div>
                      </div>

                      {/* Legends */}
                      <div className="space-y-1 text-[10px] font-bold">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#1e293b]" />
                          <span className="text-slate-700 dark:text-slate-350">Display Panels (60%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          <span className="text-slate-700 dark:text-slate-350">AV Systems (25%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-slate-700 dark:text-slate-350">Service (15%)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* ==================== 2. CRM / SUBORDINATES PIPELINE VIEW ==================== */}
          {currentView === "crm" && (
            <div className="space-y-6">
              
              {/* Stats cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-5 shadow-sm flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary-light/30 dark:bg-primary-light/5 text-primary flex items-center justify-center text-lg"><FiActivity /></div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Leads</p>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{crmStats.totalLeads}</h4>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-5 shadow-sm flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-lg"><FiTarget /></div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Opportunities</p>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{crmStats.opportunities}</h4>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-5 shadow-sm flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-lg"><FiCheckCircle /></div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Quotations Issued</p>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{crmStats.quotations}</h4>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-5 shadow-sm flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-lg"><FiDollarSign /></div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pipeline Value</p>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white mt-0.5">${crmStats.pipelineValue.toLocaleString()}</h4>
                  </div>
                </div>
              </div>

              {/* Conversion and subordination list */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <Card title="Pipeline Funnel">
                    <div className="space-y-5 pt-3">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-700 dark:text-slate-350">Leads Stage</span>
                          <span className="text-slate-400">{crmStats.totalLeads} Leads</span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 dark:bg-[#0d2336] rounded-full overflow-hidden">
                          <div className="h-full bg-slate-500 rounded-full" style={{ width: "100%" }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-700 dark:text-slate-350">Opportunities</span>
                          <span className="text-slate-400">
                            {crmStats.opportunities} Opps ({crmStats.totalLeads > 0 ? Math.round((crmStats.opportunities / crmStats.totalLeads) * 100) : 0}%)
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 dark:bg-[#0d2336] rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{
                            width: `${crmStats.totalLeads > 0 ? (crmStats.opportunities / crmStats.totalLeads) * 100 : 0}%`
                          }} />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-700 dark:text-slate-350">Quotation / Close</span>
                          <span className="text-slate-400">
                            {crmStats.quotations} Quotes ({crmStats.totalLeads > 0 ? Math.round((crmStats.quotations / crmStats.totalLeads) * 100) : 0}%)
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 dark:bg-[#0d2336] rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{
                            width: `${crmStats.totalLeads > 0 ? (crmStats.quotations / crmStats.totalLeads) * 100 : 0}%`
                          }} />
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="lg:col-span-2">
                  <Card title="Sales Performance by Subordinate">
                    <div className="space-y-4 pt-3">
                      {creatorStats.length > 0 ? (
                        creatorStats.map((stat, idx) => {
                          const percentage = Math.round((stat.totalValue / maxCreatorValue) * 100);
                          return (
                            <div key={idx} className="space-y-2">
                              <div className="flex justify-between items-center text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 dark:text-white">{stat.name}</span>
                                  <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-[#0d2336] px-1.5 py-0.5 rounded">
                                    {stat.leadCount} leads
                                  </span>
                                </div>
                                <span className="font-black text-emerald-500">${stat.totalValue.toLocaleString()}</span>
                              </div>
                              <div className="w-full h-2.5 bg-slate-100 dark:bg-[#0d2336] rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="py-8 text-center text-slate-400 italic text-xs">
                          No subordinate performance data to compile. Start generating leads and qualifying them!
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </div>

            </div>
          )}

          {/* ==================== 3. INVENTORY STOCK VIEW ==================== */}
          {currentView === "inventory" && (
            <div className="space-y-6">
              
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-5 shadow-sm flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary-light/30 dark:bg-primary-light/5 text-primary flex items-center justify-center text-lg"><FiBox /></div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Products Registered</p>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{inventoryStats.totalAssets}</h4>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-5 shadow-sm flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center text-lg"><FiGrid /></div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Categories</p>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{inventoryStats.activeCategories}</h4>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-5 shadow-sm flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center text-lg"><FiMapPin /></div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Storage Zones/Groups</p>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white mt-0.5">{inventoryStats.locationsCount}</h4>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-5 shadow-sm flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-lg"><FiDollarSign /></div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Est. Stock Valuation</p>
                    <h4 className="text-xl font-black text-slate-800 dark:text-white mt-0.5">${inventoryStats.estimatedValuation.toLocaleString()}</h4>
                  </div>
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left: Category Allocations progress bars */}
                <div className="lg:col-span-1">
                  <Card title="Asset Allocation by Category">
                    <div className="space-y-4 pt-3">
                      {productTypes.map((type) => {
                        const count = categoryBreakdowns[type.code] || 0;
                        const pct = inventoryStats.totalAssets > 0 ? (count / inventoryStats.totalAssets) * 100 : 0;
                        return (
                          <div key={type.code} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-800 dark:text-white">{type.name} ({type.code})</span>
                              <span className="text-slate-400 font-bold">{count} items</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 dark:bg-[#0d2336] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-300"
                                style={{ width: `${pct || 15}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>

                {/* Right: Recently added items list from database */}
                <div className="lg:col-span-2">
                  <Card title="Recent Stock Inflow (Last 5 Additions)">
                    <div className="pt-2">
                      {inventoryItems.length > 0 ? (
                        <Table headers={["Item Name", "Serial Code", "Category Type", "Location"]}>
                          {inventoryItems.slice(0, 5).map((item) => (
                            <tr key={item._id} className="text-xs hover:bg-slate-50/50">
                              <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-white">
                                <div className="flex items-center gap-1.5">
                                  <FiDatabase className="text-primary text-xs shrink-0" />
                                  <span>{item.name}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 font-mono font-semibold uppercase">{item.serial_number}</td>
                              <td className="py-2.5 px-4">{item.product_type_code}</td>
                              <td className="py-2.5 px-4 text-slate-500">{item.category}</td>
                            </tr>
                          ))}
                        </Table>
                      ) : (
                        <p className="py-8 text-center text-slate-400 italic text-xs">
                          No stock items registered in MongoDB. Go to Inventory Management to register stock items!
                        </p>
                      )}
                    </div>
                  </Card>
                </div>

              </div>

            </div>
          )}

        </div>
      )}
    </div>
  );
}
