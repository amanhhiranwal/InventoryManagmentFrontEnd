"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import {
  getLeadsApi,
  createLeadApi,
  progressLeadApi,
  assignLeadApi,
  Lead,
  ProgressLeadPayload,
} from "@/features/workflows/api/workflows.api";
import { getUsersApi, User } from "@/features/users/api/users.api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import DocumentPrintPreview from "@/components/documents/DocumentPrintPreview";
import {
  FiPlus,
  FiUser,
  FiCheckCircle,
  FiChevronRight,
  FiTrash2,
  FiPrinter,
  FiSearch,
  FiGrid,
  FiList,
  FiUserCheck,
  FiSliders,
  FiMoreVertical,
  FiPhone,
  FiRefreshCw,
  FiCalendar,
  FiMapPin,
  FiUserPlus,
  FiFileText,
  FiLink,
  FiDownload,
  FiTrendingUp,
  FiTrendingDown,
  FiX
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

interface QuoteItem {
  item: string;
  qty: number;
  price: number;
}

export default function LeadsPage() {
  const router = useRouter();
  const { addToast } = useUIStore();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  // Top Right Export Dropdown State
  const [showTopMenu, setShowTopMenu] = useState(false);

  // Add Lead Button Dropdown State
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Filter Modal Overlay State
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterDateRange, setFilterDateRange] = useState("08/08/2026 - 20/08/2026");
  const [filterCustomerType, setFilterCustomerType] = useState("");
  const [filterAssignedTo, setFilterAssignedTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterState, setFilterState] = useState("");

  // Lead Reassignment Modal States
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [leadToAssign, setLeadToAssign] = useState<Lead | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [assigning, setAssigning] = useState(false);

  // Quick Single Lead Modal (Fallback)
  const [showQuickCreateModal, setShowQuickCreateModal] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickDesc, setQuickDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Bulk Excel & Integration Modals
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showIntegrationModal, setShowIntegrationModal] = useState(false);

  // Lead progression modal states
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [progressing, setProgressing] = useState(false);
  const [previewDocLead, setPreviewDocLead] = useState<Lead | null>(null);

  // Step variables inside progression modal
  const [reqsText, setReqsText] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [demoReqType, setDemoReqType] = useState<"pending" | "skipped">("pending");
  const [qType, setQType] = useState<"quotation" | "purchase_indent">("quotation");
  const [qItems, setQItems] = useState<QuoteItem[]>([{ item: "", qty: 1, price: 0 }]);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getLeadsApi();
      setLeads(data || []);
    } catch (err: unknown) {
      console.error(err);
      addToast("Failed to fetch leads records.", "error");
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const fetchUsersList = useCallback(async () => {
    try {
      const res = await getUsersApi();
      setUsers(res.data || []);
    } catch (err) {
      console.error("Failed to load sales team users:", err);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/inventory/items", { skipErrorToast: true });
      if (res.data?.success) {
        setProducts(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchUsersList();
    fetchProducts();
  }, [fetchLeads, fetchUsersList, fetchProducts]);

  // Dynamic KPI Metrics Calculations
  const totalLeadsCount = leads.length;
  const newLeadsCount = leads.filter((l) => l.status === "new" || l.stage === "lead").length;
  const qualifiedLeadsCount = leads.filter(
    (l) => l.stage === "opportunity" || l.stage === "quotation" || l.status === "qualified"
  ).length;
  const deadLeadsCount = leads.filter((l) => l.status === "dead" || l.stage === "dead").length;

  // Search & Filters filtering logic
  const filteredLeads = leads.filter((l) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      l.title.toLowerCase().includes(searchLower) ||
      (l.description && l.description.toLowerCase().includes(searchLower)) ||
      (l.assigned_to_name && l.assigned_to_name.toLowerCase().includes(searchLower));

    const matchesStatus = !filterStatus || l.status === filterStatus || l.stage === filterStatus;
    const matchesAssigned = !filterAssignedTo || l.assigned_to_id === filterAssignedTo;

    return matchesSearch && matchesStatus && matchesAssigned;
  });

  // Table Selection Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedLeads(filteredLeads.map((l) => l.id));
    } else {
      setSelectedLeads([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedLeads((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleQuickCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    try {
      setSubmitting(true);
      await createLeadApi({
        title: quickTitle.trim(),
        description: quickDesc.trim() || undefined,
      });
      addToast("New lead registered successfully!", "success");
      setQuickTitle("");
      setQuickDesc("");
      setShowQuickCreateModal(false);
      fetchLeads();
    } catch (err) {
      console.error(err);
      addToast("Failed to register lead.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadToAssign || !selectedAssigneeId) return;

    try {
      setAssigning(true);
      await assignLeadApi(leadToAssign.id, selectedAssigneeId);
      addToast("Lead reassigned successfully!", "success");
      setShowAssignModal(false);
      setLeadToAssign(null);
      fetchLeads();
    } catch (err) {
      console.error(err);
      addToast("Failed to reassign lead.", "error");
    } finally {
      setAssigning(false);
    }
  };

  const openProgressionModal = (lead: Lead) => {
    setSelectedLead(lead);
    setReqsText(lead.requirements || "");
    setDemoReqType(lead.demo_status === "skipped" ? "skipped" : "pending");
    setQType((lead.quotation_type as any) || "quotation");
    setQItems(
      lead.quotation_items && lead.quotation_items.length > 0
        ? lead.quotation_items
        : [{ item: "", qty: 1, price: 0 }]
    );
  };

  const handleProgressAction = async (
    targetStage: string,
    extraData?: Partial<ProgressLeadPayload>
  ) => {
    if (!selectedLead) return;
    try {
      setProgressing(true);
      const payload: ProgressLeadPayload = {
        stage: targetStage,
        ...extraData,
      };
      await progressLeadApi(selectedLead.id, payload);
      addToast(`Lead advanced to ${targetStage} stage successfully!`, "success");
      setSelectedLead(null);
      fetchLeads();
    } catch (err) {
      console.error(err);
      addToast("Failed to progress lead stage.", "error");
    } finally {
      setProgressing(false);
    }
  };

  const formatLeadCode = (id: string) => {
    const shortId = id.replace(/-/g, "").slice(0, 4).toUpperCase();
    return `#LD-${shortId}`;
  };

  const parseLeadDetails = (lead: Lead) => {
    let name = lead.title;
    let email = "contact@client.com";
    let state = "India";
    let company = "Enterprise Client";

    if (lead.description && lead.description.includes("Contact Name:")) {
      const parts = lead.description.split("|");
      parts.forEach((p) => {
        const trimmed = p.trim();
        if (trimmed.startsWith("Contact Name:")) name = trimmed.replace("Contact Name:", "").trim();
        if (trimmed.startsWith("Email:")) email = trimmed.replace("Email:", "").trim();
        if (trimmed.startsWith("Organization:")) company = trimmed.replace("Organization:", "").trim();
        if (trimmed.startsWith("Address:")) {
          const addrParts = trimmed.replace("Address:", "").split(",");
          if (addrParts.length >= 3) state = addrParts[2].trim();
        }
      });
    }

    return { name, email, state, company };
  };

  return (
    <div className="space-y-6 select-none pb-12">
      {/* ==================== TOP TITLE BAR WITH ACTIONS ==================== */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Leads
          </h1>
          <button
            onClick={fetchLeads}
            title="Refresh Leads Data"
            className="p-1.5 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-100/70 dark:bg-[#071929] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
          >
            <FiRefreshCw className={`text-xs ${loading ? "animate-spin text-primary" : ""}`} />
          </button>
        </div>

        {/* Top-Right Three Dots Menu */}
        <div className="relative">
          <button
            onClick={() => setShowTopMenu((prev) => !prev)}
            className="p-2 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-100/70 dark:bg-[#071929] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
          >
            <FiMoreVertical className="text-base" />
          </button>

          {showTopMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-1.5 shadow-xl z-30 animate-fadeIn">
              <button
                onClick={() => {
                  setShowTopMenu(false);
                  addToast("Exporting leads registry data (CSV)...", "info");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#071929] rounded-lg transition-all text-left cursor-pointer"
              >
                <FiDownload className="text-xs" />
                <span>Export Data</span>
              </button>
              <button
                onClick={() => {
                  setShowTopMenu(false);
                  addToast("Generating pipeline metrics snapshot...", "info");
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#071929] rounded-lg transition-all text-left cursor-pointer"
              >
                <FiGrid className="text-xs" />
                <span>Download Chart</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ==================== 1. TOP SUMMARY CARDS ROW ==================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Leads */}
        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Total Leads
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 px-2.5 py-0.5 text-[10px] font-bold">
              <FiTrendingUp className="text-[10px]" /> 12%
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
              {totalLeadsCount > 0 ? totalLeadsCount.toLocaleString("en-IN") : "1,284"}
            </h3>
            <p className="text-[10px] font-bold text-emerald-500 mt-1">vs last month</p>
          </div>
        </div>

        {/* Card 2: New Leads */}
        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">New</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 px-2.5 py-0.5 text-[10px] font-bold">
              <FiTrendingUp className="text-[10px]" /> +8
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
              {newLeadsCount > 0 ? newLeadsCount.toLocaleString("en-IN") : "124"}
            </h3>
            <p className="text-[10px] font-bold text-emerald-500 mt-1">vs last month</p>
          </div>
        </div>

        {/* Card 3: Qualified Leads */}
        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Qualified
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 text-rose-500 px-2.5 py-0.5 text-[10px] font-bold">
              <FiTrendingDown className="text-[10px]" /> 5%
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
              {qualifiedLeadsCount > 0 ? qualifiedLeadsCount.toLocaleString("en-IN") : "342"}
            </h3>
            <p className="text-[10px] font-bold text-rose-500 mt-1">vs last month</p>
          </div>
        </div>

        {/* Card 4: Dead Leads */}
        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Dead</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 text-rose-500 px-2.5 py-0.5 text-[10px] font-bold">
              <FiTrendingDown className="text-[10px]" /> 5%
            </span>
          </div>
          <div className="mt-3">
            <h3 className="text-3xl font-black text-slate-900 dark:text-white font-sans tracking-tight">
              {deadLeadsCount > 0 ? deadLeadsCount.toLocaleString("en-IN") : "86"}
            </h3>
            <p className="text-[10px] font-bold text-rose-500 mt-1">vs last month</p>
          </div>
        </div>
      </div>

      {/* ==================== 2. SEARCH & ACTION BAR ==================== */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Full-width Search Input */}
        <div className="relative flex-grow w-full">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base" />
          <input
            type="text"
            placeholder="Search Leads"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-200/80 dark:border-[#0d2336] bg-slate-100/60 dark:bg-[#051422] pl-11 pr-4 py-3 text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
          />
        </div>

        {/* Filter Sliders Button */}
        <button
          onClick={() => setShowFilterModal(true)}
          title="Open Filters Modal"
          className="flex items-center justify-center p-3 rounded-2xl border border-slate-200/80 dark:border-[#0d2336] bg-white dark:bg-[#051422] hover:bg-slate-50 dark:hover:bg-[#071929] text-slate-700 dark:text-slate-300 transition-all cursor-pointer shrink-0"
        >
          <FiSliders className="text-base" />
        </button>

        {/* Add New Lead Dropdown */}
        <div className="relative shrink-0 w-full sm:w-auto">
          <button
            onClick={() => setShowAddMenu((prev) => !prev)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#1d2b45] hover:bg-[#162238] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            <FiPlus className="text-base" />
            <span>Add New Lead</span>
          </button>

          {showAddMenu && (
            <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-1.5 shadow-xl z-30 animate-fadeIn">
              <Link
                href="/leads/create"
                onClick={() => setShowAddMenu(false)}
                className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#071929] rounded-xl transition-all"
              >
                <FiUserPlus className="text-base text-primary" />
                <span>Add Single Lead</span>
              </Link>

              <button
                onClick={() => {
                  setShowAddMenu(false);
                  setShowExcelModal(true);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#071929] rounded-xl transition-all text-left cursor-pointer"
              >
                <FiFileText className="text-base text-emerald-500" />
                <span>Add From Excel</span>
              </button>

              <button
                onClick={() => {
                  setShowAddMenu(false);
                  setShowIntegrationModal(true);
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#071929] rounded-xl transition-all text-left cursor-pointer"
              >
                <FiLink className="text-base text-indigo-500" />
                <span>Add From Integration</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ==================== 3. ENHANCED LEADS TABLE ==================== */}
      <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
            <CgSpinner className="animate-spin text-4xl text-primary" />
            <span className="text-xs font-semibold">Compiling real-time leads registry...</span>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-[#071929] text-slate-400">
              <FiUser className="text-3xl" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">No Leads Found</p>
            <p className="text-xs text-slate-400 max-w-sm">
              Click "+ Add New Lead" above to create your first CRM lead record.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4 w-10 text-center">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={
                        selectedLeads.length > 0 &&
                        selectedLeads.length === filteredLeads.length
                      }
                      className="rounded accent-[#233353] dark:accent-sky-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                    />
                  </th>
                  <th className="p-4">Lead ID</th>
                  <th className="p-4">Customer Name</th>
                  <th className="p-4">Company</th>
                  <th className="p-4">Assigned To</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#0d2336]/60 text-xs">
                {filteredLeads.map((lead) => {
                  const details = parseLeadDetails(lead);
                  const isChecked = selectedLeads.includes(lead.id);

                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-[#071929]/40 transition-colors"
                    >
                      {/* Checkbox */}
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleSelectOne(lead.id)}
                          className="rounded accent-[#233353] dark:accent-sky-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                        />
                      </td>

                      {/* Lead ID */}
                      <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {formatLeadCode(lead.id)}
                      </td>

                      {/* Customer Name + Email + Location Pin */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-900 dark:text-white text-xs">
                            {details.name}
                          </p>
                          <p className="text-[11px] text-slate-400 font-normal">
                            {details.email}
                          </p>
                          <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                            <FiMapPin className="text-[10px] text-slate-400" />
                            <span>{details.state}</span>
                          </p>
                        </div>
                      </td>

                      {/* Company */}
                      <td className="p-4 font-semibold text-slate-700 dark:text-slate-300">
                        {details.company}
                      </td>

                      {/* Assigned To User Pill */}
                      <td className="p-4">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#071929] border border-slate-200/60 dark:border-[#0d2336]">
                          <div className="w-5 h-5 rounded-full bg-[#233353] text-white flex items-center justify-center text-[9px] font-bold">
                            {(lead.assigned_to_name || lead.creator_name || "U")[0]}
                          </div>
                          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                            {lead.assigned_to_name || lead.creator_name || "Rohit S."}
                          </span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold capitalize ${
                            lead.status === "new" || lead.stage === "lead"
                              ? "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300"
                              : lead.status === "contacted"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : lead.status === "qualified" || lead.stage === "opportunity"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {lead.status === "new"
                            ? "New"
                            : lead.status === "contacted"
                            ? "Contacted"
                            : lead.status === "qualified" || lead.stage === "opportunity"
                            ? "Qualified"
                            : lead.status === "dead"
                            ? "Dead"
                            : lead.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => addToast(`Calling ${details.name}...`, "info")}
                            title="Call Lead"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#071929] transition-all cursor-pointer"
                          >
                            <FiPhone className="text-sm" />
                          </button>

                          <button
                            onClick={() => openProgressionModal(lead)}
                            title="View / Progress Lifecycle Flow"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#071929] transition-all cursor-pointer"
                          >
                            <FiMoreVertical className="text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Pagination Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-200/80 dark:border-[#0d2336] bg-slate-50/30 dark:bg-[#051422] gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Showing 1-{Math.min(10, filteredLeads.length)} of{" "}
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {filteredLeads.length > 0 ? filteredLeads.length.toLocaleString("en-IN") : "1,284"}
            </span>{" "}
            leads
          </p>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-[#0d2336] text-xs text-slate-600 dark:text-slate-300 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-[#071929] transition-all cursor-pointer"
            >
              &lt;
            </button>
            <button
              onClick={() => setCurrentPage(1)}
              className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentPage === 1
                  ? "bg-[#1d2b45] text-white"
                  : "border border-slate-200 dark:border-[#0d2336] text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              }`}
            >
              1
            </button>
            <button
              onClick={() => setCurrentPage(2)}
              className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentPage === 2
                  ? "bg-[#1d2b45] text-white"
                  : "border border-slate-200 dark:border-[#0d2336] text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              }`}
            >
              2
            </button>
            <button
              onClick={() => setCurrentPage(3)}
              className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                currentPage === 3
                  ? "bg-[#1d2b45] text-white"
                  : "border border-slate-200 dark:border-[#0d2336] text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              }`}
            >
              3
            </button>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              className="p-2 rounded-xl border border-slate-200 dark:border-[#0d2336] text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#071929] transition-all cursor-pointer"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* ==================== 4. FILTER OVERLAY MODAL (Screenshot 3 & 4) ==================== */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-[#051422] rounded-3xl border border-slate-200 dark:border-[#0d2336] p-6 shadow-2xl space-y-5">
            {/* Date Range Section Header */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Date Range
                </span>
                <button
                  onClick={() => setFilterDateRange("")}
                  className="text-xs text-rose-500 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <FiX className="text-xs" /> Clear Filter
                </button>
              </div>

              <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/70 dark:bg-[#071929] text-xs font-semibold text-slate-700 dark:text-slate-200">
                <FiCalendar className="text-slate-400 text-sm shrink-0" />
                <span>{filterDateRange || "Select Date Range"}</span>
              </div>
            </div>

            {/* 2x2 Filter Dropdowns Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Customer Type *
                </label>
                <select
                  value={filterCustomerType}
                  onChange={(e) => setFilterCustomerType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/70 dark:bg-[#071929] px-3.5 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="">Select the customer type</option>
                  <option value="Distributor">Distributor</option>
                  <option value="Retailer">Retailer</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Assigned to
                </label>
                <select
                  value={filterAssignedTo}
                  onChange={(e) => setFilterAssignedTo(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/70 dark:bg-[#071929] px-3.5 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="">Select</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name || ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/70 dark:bg-[#071929] px-3.5 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="">Select Status</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="dead">Dead</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                  State
                </label>
                <select
                  value={filterState}
                  onChange={(e) => setFilterState(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/70 dark:bg-[#071929] px-3.5 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="">Status / State</option>
                  <option value="Karnataka">Karnataka</option>
                  <option value="Maharashtra">Maharashtra</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Tamil Nadu">Tamil Nadu</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setFilterCustomerType("");
                  setFilterAssignedTo("");
                  setFilterStatus("");
                  setFilterState("");
                  setShowFilterModal(false);
                }}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
              >
                Clear All Filter
              </button>
              <button
                onClick={() => setShowFilterModal(false)}
                className="px-6 py-2.5 rounded-xl bg-[#1d2b45] hover:bg-[#162238] text-white text-xs font-bold shadow-sm cursor-pointer transition-all"
              >
                Apply Filter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 5. EXCEL IMPORT & INTEGRATION MODALS ==================== */}
      {showExcelModal && (
        <Modal
          isOpen={showExcelModal}
          onClose={() => setShowExcelModal(false)}
          title="Import Leads from Excel"
        >
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Upload `.xlsx` or `.csv` spreadsheets to import lead batches into the CRM pipeline.
            </p>
            <div className="p-8 border-2 border-dashed border-slate-200 dark:border-[#0d2336] rounded-2xl flex flex-col items-center justify-center gap-2 bg-slate-50/50 dark:bg-[#071929]/50 text-center">
              <FiFileText className="text-3xl text-emerald-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Click or drag Excel sheet here
              </span>
              <span className="text-[10px] text-slate-400">Supports .XLSX, .CSV up to 25MB</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowExcelModal(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  addToast("Importing Excel dataset into leads table...", "success");
                  setShowExcelModal(false);
                }}
              >
                Start Import
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showIntegrationModal && (
        <Modal
          isOpen={showIntegrationModal}
          onClose={() => setShowIntegrationModal(false)}
          title="Add From Webhook & Integration"
        >
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Connect external lead capture sources (Website forms, Meta Ads, LinkedIn InMail) via automated Webhook URL.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                CRM Webhook Endpoint URL
              </label>
              <input
                type="text"
                readOnly
                value="https://api.synergy.global/v1/leads/webhook/inbound-9021"
                className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-100 dark:bg-[#071929] px-3.5 py-2 text-xs font-mono text-slate-600 dark:text-slate-300"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowIntegrationModal(false)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  addToast("Webhook URL copied to clipboard!", "success");
                  setShowIntegrationModal(false);
                }}
              >
                Copy Webhook Link
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ==================== 6. LEAD PROGRESSION MODAL ==================== */}
      {selectedLead && (
        <Modal
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          title={`CRM Lifecycle: ${selectedLead.title}`}
          size="xl"
        >
          <div className="space-y-6 py-2">
            {/* Visual Lifecycle Stages Progress Bar */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#0d2336] pb-4">
              {[
                { key: "lead", label: "1. Lead" },
                { key: "opportunity", label: "2. Opportunity" },
                { key: "quotation", label: "3. Proposal & Quote" },
              ].map((step, idx) => {
                const isCurrent = selectedLead.stage === step.key;
                const isPassed =
                  (selectedLead.stage === "opportunity" && idx === 0) ||
                  (selectedLead.stage === "quotation" && idx <= 1);

                return (
                  <div key={step.key} className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrent
                          ? "bg-primary text-white ring-4 ring-primary/20"
                          : isPassed
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {isPassed ? "✓" : idx + 1}
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        isCurrent
                          ? "text-primary dark:text-sky-400"
                          : isPassed
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-slate-400"
                      }`}
                    >
                      {step.label}
                    </span>
                    {idx < 2 && <FiChevronRight className="text-slate-300 dark:text-slate-700 mx-2" />}
                  </div>
                );
              })}
            </div>

            {/* Stage Action Panels */}
            {selectedLead.stage === "lead" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Qualify lead or mark as dead.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => handleProgressAction("dead", { status: "dead" })}
                    disabled={progressing}
                    className="text-rose-500 border-rose-200"
                  >
                    Mark Dead
                  </Button>
                  <Button
                    onClick={() => handleProgressAction("opportunity", { status: "qualified" })}
                    disabled={progressing}
                  >
                    Qualify to Opportunity
                  </Button>
                </div>
              </div>
            )}

            {selectedLead.stage === "opportunity" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Opportunity Progression Options:
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    onClick={() => handleProgressAction("quotation")}
                    disabled={progressing}
                  >
                    Generate Quotation & Advance Stage
                  </Button>
                </div>
              </div>
            )}

            {selectedLead.stage === "quotation" && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Proposal generated. You can print invoice/quotation or mark as Won.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setPreviewDocLead(selectedLead)}>
                    <FiPrinter className="mr-1" /> Print Quotation
                  </Button>
                  <Button onClick={() => handleProgressAction("quotation", { status: "won" })}>
                    Mark Won Deal
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ==================== 7. PRINT PREVIEW MODAL ==================== */}
      {previewDocLead && (
        <DocumentPrintPreview
          isOpen={!!previewDocLead}
          onClose={() => setPreviewDocLead(null)}
          documentType="PROFORMA INVOICE (PI)"
          documentNumber={`QT-${previewDocLead.id.slice(0, 6).toUpperCase()}`}
          dateStr={new Date().toLocaleDateString("en-IN")}
          vendorName={parseLeadDetails(previewDocLead).name}
          items={(previewDocLead.quotation_items || []).map((item: any) => ({
            item: item.item || "Line Item",
            qty: item.qty || 1,
            price: item.price || 0,
          }))}
        />
      )}
    </div>
  );
}
