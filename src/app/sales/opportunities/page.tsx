"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useUIStore } from "@/lib/store/ui.store";
import api from "@/lib/axios";
import {
  FiPlus,
  FiSearch,
  FiGrid,
  FiList,
  FiDownload,
  FiArrowRight
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

interface Opportunity {
  id: string;
  name: string;
  account: string;
  stage: "Discovery" | "Qualified" | "Proposal" | "Negotiation" | "Closed won";
  value: number;
  probability: number;
  owner: string;
  dueDate: string;
}

const STAGES: Array<Opportunity["stage"]> = [
  "Discovery",
  "Qualified",
  "Proposal",
  "Negotiation",
  "Closed won"
];

export default function OpportunitiesPage() {
  const { addToast } = useUIStore();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("All");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [value, setValue] = useState("");

  const fetchOpportunities = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/v1/leads/");
      if (res.data?.success) {
        const list = res.data.data || [];
        
        // Map real leads to opportunities
        const mapped: Opportunity[] = list.map((l: any) => {
          const val = l.quotation_items && l.quotation_items.length > 0
            ? l.quotation_items.reduce((sum: number, item: any) => sum + ((item.qty || 1) * (item.price || 0)), 0)
            : 0;
          
          let st: Opportunity["stage"] = "Discovery";
          let prob = 25;

          if (l.status === "won" || l.stage === "won") {
            st = "Closed won";
            prob = 100;
          } else if (l.stage === "quotation") {
            st = "Proposal";
            prob = 75;
          } else if (l.stage === "opportunity") {
            st = l.demo_status === "given" ? "Negotiation" : "Qualified";
            prob = l.demo_status === "given" ? 85 : 50;
          }

          const createdDate = l.created_at
            ? new Date(l.created_at).toLocaleDateString("en-IN", { month: "short", day: "2-digit", year: "numeric" })
            : "Recent";

          return {
            id: l.id,
            name: l.title,
            account: l.description || "Corporate Client",
            stage: st,
            value: val,
            probability: prob,
            owner: l.creator_name || "Sales Lead",
            dueDate: createdDate
          };
        });

        setOpps(mapped);
      }
    } catch (err) {
      console.error(err);
      setOpps([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !account.trim() || !value.trim()) {
      addToast("Deal name, client account, and estimated value are required.", "warning");
      return;
    }

    try {
      setLoading(true);
      const numericVal = parseFloat(value) || 0;

      // 1. Create lead record
      const createRes = await api.post("/api/v1/leads/", {
        title: name.trim(),
        description: account.trim(),
        status: "active"
      });

      if (createRes.data?.success) {
        const newLead = createRes.data.data;
        // 2. Advance to opportunity stage
        await api.put(`/api/v1/leads/${newLead.id}/progress`, {
          stage: "opportunity",
          status: "active",
          demo_status: "skipped",
          requirements: `Registered from Opportunities Board (${account})`,
          quotation_type: "quotation",
          quotation_items: [{ item: name.trim(), qty: 1, price: numericVal }]
        });

        addToast(`Opportunity '${name}' saved and added to pipeline!`, "success");
        setName("");
        setAccount("");
        setValue("");
        setShowAddModal(false);
        fetchOpportunities();
      }
    } catch (err: any) {
      console.error(err);
      addToast(err.response?.data?.detail || "Failed to save deal opportunity.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceStage = async (opp: Opportunity, nextStage: Opportunity["stage"]) => {
    try {
      setOpps(opps.map(o => o.id === opp.id ? { ...o, stage: nextStage } : o));
      addToast(`Opportunity moved to ${nextStage}!`, "success");
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = opps.filter((o) => {
    const matchesSearch =
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.account.toLowerCase().includes(search.toLowerCase()) ||
      o.owner.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === "All" || o.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const proposalCount = opps.filter(o => o.stage === "Proposal").length;
  const negotiationCount = opps.filter(o => o.stage === "Negotiation").length;
  const wonCount = opps.filter(o => o.stage === "Closed won").length;

  return (
    <div className="space-y-6 select-none">
      
      {/* Sub Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#051422] px-5 py-4 rounded-2xl border border-slate-200/80 dark:border-[#0d2336] shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-sans">
            Sales Opportunities & Deals Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive Kanban deal board, probability tracking, and revenue forecasting
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 dark:bg-[#071929] p-1 rounded-xl items-center">
            <button
              onClick={() => setViewMode("board")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "board"
                  ? "bg-[#233353] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FiGrid />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-[#233353] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FiList />
              <span>List</span>
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#233353] hover:bg-[#101725] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <FiPlus className="text-xs" />
            <span>Add Opportunity</span>
          </button>
        </div>
      </div>

      {/* Dynamic KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        {/* KPI 1: Total Proposal */}
        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Proposals Sent</span>
          <div className="my-2">
            <h3 className="text-3xl font-black text-[#233353] dark:text-white font-mono">
              {proposalCount}
            </h3>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
            <span className="text-slate-400">In proposal stage</span>
            <span className="font-bold text-[#233353] dark:text-sky-400 text-[10px]">{opps.length > 0 ? `${Math.round((proposalCount / opps.length) * 100)}%` : "0%"}</span>
          </div>
        </div>

        {/* KPI 2: Total Negotiation */}
        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Negotiations</span>
          <div className="my-2">
            <h3 className="text-3xl font-black text-[#233353] dark:text-white font-mono">
              {negotiationCount}
            </h3>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
            <span className="text-slate-400">In negotiation stage</span>
            <span className="font-bold text-blue-600 text-[10px]">{opps.length > 0 ? `${Math.round((negotiationCount / opps.length) * 100)}%` : "0%"}</span>
          </div>
        </div>

        {/* KPI 3: Closed Won */}
        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Closed Won Deals</span>
          <div className="my-2">
            <h3 className="text-3xl font-black text-[#233353] dark:text-white font-mono">
              {wonCount}
            </h3>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
            <span className="text-slate-400">Win Rate</span>
            <span className="font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[10px]">
              {opps.length > 0 ? `${Math.round((wonCount / opps.length) * 100)}%` : "0%"}
            </span>
          </div>
        </div>

      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#051422] p-4 rounded-2xl border border-slate-200/80 dark:border-[#0d2336] shadow-sm">
        
        <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-[#071929] rounded-xl border border-slate-200 dark:border-[#0d2336] px-3.5 py-1.5 w-full sm:w-72">
          <FiSearch className="text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Search Opportunities..."
            className="w-full text-xs bg-transparent outline-none text-slate-800 dark:text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
          >
            <option value="All">All Pipeline Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <button
            onClick={() => addToast("Exporting opportunities dataset...", "info")}
            className="p-2 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] text-slate-700 dark:text-slate-300 hover:bg-slate-100 transition-all cursor-pointer"
          >
            <FiDownload className="text-xs" />
          </button>
        </div>

      </div>

      {/* VIEW RENDERING */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <CgSpinner className="animate-spin text-3xl text-[#233353] dark:text-sky-400" />
          <span className="text-xs font-semibold">Loading deals pipeline...</span>
        </div>
      ) : viewMode === "board" ? (

        /* 5-COLUMN KANBAN PIPELINE BOARD */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start overflow-x-auto pb-4 scrollbar-thin">
          {STAGES.map((colStage) => {
            const stageDeals = filtered.filter((o) => o.stage === colStage);
            const totalStageValue = stageDeals.reduce((sum, d) => sum + d.value, 0);

            return (
              <div
                key={colStage}
                className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-3.5 space-y-3 shadow-sm min-h-[480px]"
              >
                {/* Column Header */}
                <div className="pb-2 border-b border-slate-100 dark:border-[#0d2336]">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      {colStage}
                    </h4>
                    <span className="text-[10px] bg-slate-100 dark:bg-[#0d2336] text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full">
                      {stageDeals.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    ₹{(totalStageValue / 1000).toFixed(0)}k total
                  </p>
                </div>

                {/* Deal Cards */}
                <div className="space-y-3">
                  {stageDeals.map((opp) => (
                    <div
                      key={opp.id}
                      className="p-3.5 bg-slate-50/80 dark:bg-[#071929]/50 rounded-xl border border-slate-200/70 dark:border-[#0d2336]/60 shadow-sm hover:shadow-md transition-all space-y-2.5"
                    >
                      <div>
                        <h5 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                          {opp.name}
                        </h5>
                        <p className="text-[10px] text-slate-500 font-semibold mt-0.5 truncate">
                          {opp.account}
                        </p>
                      </div>

                      <div className="flex justify-between items-center pt-1">
                        <span className="text-xs font-black font-mono text-[#233353] dark:text-sky-400">
                          ₹{opp.value.toLocaleString("en-IN")}
                        </span>
                        <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded">
                          {opp.probability}% Win
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#e27c26] rounded-full"
                          style={{ width: `${opp.probability}%` }}
                        />
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-[#0d2336]/30 text-[9px] text-slate-400">
                        <span>{opp.owner}</span>
                        {colStage !== "Closed won" && (
                          <button
                            onClick={() => {
                              const currIdx = STAGES.indexOf(colStage);
                              if (currIdx < STAGES.length - 1) {
                                handleAdvanceStage(opp, STAGES[currIdx + 1]);
                              }
                            }}
                            className="font-bold text-[#233353] dark:text-sky-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <span>Advance</span>
                            <FiArrowRight className="text-[8px]" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {stageDeals.length === 0 && (
                    <div className="py-8 text-center text-slate-400 italic text-[11px]">
                      No deals in {colStage}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      ) : (

        /* LIST / TABLE VIEW */
        <Card>
          {filtered.length > 0 ? (
            <Table headers={["Deal Name", "Client / Account", "Pipeline Stage", "Estimated Value", "Probability", "Owner", "Actions"]}>
              {filtered.map((opp) => (
                <tr
                  key={opp.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-[#071929]/30 transition-all border-b border-slate-100 dark:border-[#0d2336]/40"
                >
                  <td className="py-4 px-5">
                    <p className="font-bold text-slate-900 dark:text-white text-xs">
                      {opp.name}
                    </p>
                  </td>

                  <td className="py-4 px-5 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                    {opp.account}
                  </td>

                  <td className="py-4 px-5">
                    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase ${
                      opp.stage === "Closed won"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : opp.stage === "Negotiation"
                        ? "bg-teal-500/10 text-teal-600"
                        : opp.stage === "Proposal"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-blue-500/10 text-blue-600"
                    }`}>
                      {opp.stage}
                    </span>
                  </td>

                  <td className="py-4 px-5 font-mono font-black text-xs text-slate-900 dark:text-white">
                    ₹{opp.value.toLocaleString("en-IN")}
                  </td>

                  <td className="py-4 px-5">
                    <span className="text-xs font-bold text-emerald-600">
                      {opp.probability}%
                    </span>
                  </td>

                  <td className="py-4 px-5 text-xs text-slate-500">
                    {opp.owner}
                  </td>

                  <td className="py-4 px-5 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const currIdx = STAGES.indexOf(opp.stage);
                        if (currIdx < STAGES.length - 1) {
                          handleAdvanceStage(opp, STAGES[currIdx + 1]);
                        } else {
                          addToast("Deal is already Closed Won!", "info");
                        }
                      }}
                    >
                      Advance Stage
                    </Button>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <div className="text-center py-16 text-slate-400 italic text-xs">
              No opportunities found in pipeline. Click &quot;Add Opportunity&quot; to create one.
            </div>
          )}
        </Card>

      )}

      {/* Add Opportunity Modal */}
      {showAddModal && (
        <Modal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          title="Add New Sales Opportunity"
        >
          <form onSubmit={handleAdd} className="space-y-4">
            <Input
              label="Deal / Opportunity Name *"
              required
              placeholder='e.g. Smart Classroom Displays'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Input
              label="Account / Client Name *"
              required
              placeholder="e.g. Client Enterprise"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            />

            <Input
              label="Estimated Value (₹) *"
              required
              type="number"
              placeholder="e.g. 150000"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
              <Button variant="outline" type="button" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Create Opportunity
              </Button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
