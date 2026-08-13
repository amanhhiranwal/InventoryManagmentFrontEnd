"use client";

import { useEffect, useState, useCallback } from "react";
import { AxiosError } from "axios";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";
import {
  getLeadsApi,
  createLeadApi,
  progressLeadApi,
  Lead,
  ProgressLeadPayload,
} from "@/features/workflows/api/workflows.api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import DocumentPrintPreview from "@/components/documents/DocumentPrintPreview";
import {
  FiPlus,
  FiUser,
  FiCheckCircle,
  FiChevronRight,
  FiPlusCircle,
  FiTrash2,
  FiPrinter,
  FiSearch,
  FiGrid,
  FiList
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

interface QuoteItem {
  item: string;
  qty: number;
  price: number;
}

export default function LeadsPage() {
  const { addToast } = useUIStore();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewDocLead, setPreviewDocLead] = useState<Lead | null>(null);

  // New Lead fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Lead progression modal states
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [progressing, setProgressing] = useState(false);

  // Step variables inside modal
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

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get("/api/v1/inventory/items");
      if (res.data?.success) {
        setProducts(res.data.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchProducts();
  }, [fetchLeads, fetchProducts]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      addToast("Lead Title is required.", "warning");
      return;
    }

    try {
      setSubmitting(true);
      await createLeadApi({ title, description });
      addToast("Lead created successfully!", "success");
      setTitle("");
      setDescription("");
      setShowCreateModal(false);
      fetchLeads();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to create lead.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDetails = (lead: Lead) => {
    setSelectedLead(lead);
    setReqsText(lead.requirements || "");
    setDemoReqType(lead.demo_status === "skipped" ? "skipped" : "pending");
    setQType(lead.quotation_type === "purchase_indent" ? "purchase_indent" : "quotation");
    if (lead.quotation_items && lead.quotation_items.length > 0) {
      setQItems(lead.quotation_items);
    } else {
      setQItems([{ item: "", qty: 1, price: 0 }]);
    }
  };

  const handleProgressStage = async (payload: ProgressLeadPayload) => {
    if (!selectedLead) return;
    try {
      setProgressing(true);
      await progressLeadApi(selectedLead.id, payload);
      addToast(`Lead stage updated to ${payload.stage}!`, "success");
      setSelectedLead(null);
      fetchLeads();
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      addToast(axiosError.response?.data?.message || "Failed to progress lead stage.", "error");
    } finally {
      setProgressing(false);
    }
  };

  const handleAddQItem = () => {
    setQItems([...qItems, { item: "", qty: 1, price: 0 }]);
  };

  const handleRemoveQItem = (index: number) => {
    setQItems(qItems.filter((_, idx) => idx !== index));
  };

  const handleQItemChange = (index: number, field: keyof QuoteItem, value: any) => {
    const updated = qItems.map((item, idx) => {
      if (idx === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setQItems(updated);
  };

  const calculateSubtotal = () => {
    return qItems.reduce((sum, item) => sum + (item.qty * item.price), 0);
  };

  // Filtered Leads
  const filteredLeads = leads.filter((l) => {
    const matchesSearch =
      l.title.toLowerCase().includes(search.toLowerCase()) ||
      (l.description || "").toLowerCase().includes(search.toLowerCase()) ||
      (l.creator_name || "").toLowerCase().includes(search.toLowerCase());
    
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "new") return matchesSearch && (l.stage === "lead" || l.status === "new");
    if (activeTab === "opportunity") return matchesSearch && l.stage === "opportunity";
    if (activeTab === "quotation") return matchesSearch && l.stage === "quotation";
    if (activeTab === "won") return matchesSearch && (l.status === "won" || l.stage === "won");
    if (activeTab === "dead") return matchesSearch && (l.status === "dead" || l.stage === "dead");
    return matchesSearch;
  });

  // Kanban Columns
  const kanbanColumns = {
    lead: leads.filter(l => l.stage === "lead" || l.status === "new"),
    opportunity: leads.filter(l => l.stage === "opportunity"),
    quotation: leads.filter(l => l.stage === "quotation"),
    won: leads.filter(l => l.status === "won" || l.stage === "won"),
  };

  const totalLeadsCount = leads.length;
  const newLeadsCount = kanbanColumns.lead.length;
  const oppsCount = kanbanColumns.opportunity.length;
  const wonCount = kanbanColumns.won.length + kanbanColumns.quotation.length;

  return (
    <div className="space-y-6 select-none">
      
      {/* Sub Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-[#051422] px-5 py-4 rounded-2xl border border-slate-200/80 dark:border-[#0d2336] shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-sans">
            Leads & Prospect Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Qualify incoming prospects, schedule live demos, build custom line-item quotes
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 dark:bg-[#071929] p-1 rounded-xl items-center">
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-[#233353] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FiList />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-[#233353] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FiGrid />
              <span>Kanban</span>
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#233353] hover:bg-[#101725] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
          >
            <FiPlus className="text-xs" />
            <span>Add New Lead</span>
          </button>
        </div>
      </div>

      {/* Dynamic KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Leads</span>
          <div className="my-2">
            <h3 className="text-2xl font-black text-[#233353] dark:text-white font-mono">
              {totalLeadsCount.toLocaleString("en-IN")}
            </h3>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
            <span className="text-slate-400">Total Records</span>
            <span className="font-bold text-[#233353] dark:text-sky-400 text-[10px]">{totalLeadsCount} Leads</span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">New / Inbound</span>
          <div className="my-2">
            <h3 className="text-2xl font-black text-[#233353] dark:text-white font-mono">
              {newLeadsCount}
            </h3>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
            <span className="text-slate-400">Awaiting Qualification</span>
            <span className="font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full text-[10px]">
              {totalLeadsCount > 0 ? `${Math.round((newLeadsCount / totalLeadsCount) * 100)}%` : "0%"}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">In Discussion / Demo</span>
          <div className="my-2">
            <h3 className="text-2xl font-black text-[#233353] dark:text-white font-mono">
              {oppsCount}
            </h3>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
            <span className="text-slate-400">Demo Scheduled</span>
            <span className="font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full text-[10px]">
              {totalLeadsCount > 0 ? `${Math.round((oppsCount / totalLeadsCount) * 100)}%` : "0%"}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-5 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Converted to Deals</span>
          <div className="my-2">
            <h3 className="text-2xl font-black text-[#233353] dark:text-white font-mono">
              {wonCount}
            </h3>
          </div>
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-[#0d2336]/60">
            <span className="text-slate-400">Conversion rate</span>
            <span className="font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[10px]">
              {totalLeadsCount > 0 ? `${Math.round((wonCount / totalLeadsCount) * 100)}%` : "0%"}
            </span>
          </div>
        </div>

      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-[#051422] p-4 rounded-2xl border border-slate-200/80 dark:border-[#0d2336] shadow-sm">
        
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All Leads" },
            { id: "new", label: "New" },
            { id: "opportunity", label: "Demo / Qualified" },
            { id: "quotation", label: "Quotations" },
            { id: "won", label: "Won" },
            { id: "dead", label: "Dead" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[#233353] text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-[#071929] rounded-xl border border-slate-200 dark:border-[#0d2336] px-3.5 py-1.5 w-full sm:w-64">
          <FiSearch className="text-slate-400 text-xs" />
          <input
            type="text"
            placeholder="Search leads, creator..."
            className="w-full text-xs bg-transparent outline-none text-slate-800 dark:text-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

      </div>

      {/* DUAL VIEW RENDER */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
          <CgSpinner className="animate-spin text-3xl text-[#233353] dark:text-sky-400" />
          <span className="text-xs font-semibold">Loading CRM pipeline records...</span>
        </div>
      ) : viewMode === "table" ? (
        
        /* TABLE VIEW */
        <Card>
          {filteredLeads.length > 0 ? (
            <Table headers={["Lead ID", "Prospect / Customer Name", "Stage", "Demo Status", "Creator", "Actions"]}>
              {filteredLeads.map((lead, idx) => {
                const leadId = `LEAD-${(2001 + idx)}`;
                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-[#071929]/30 transition-all border-b border-slate-100 dark:border-[#0d2336]/40"
                  >
                    <td className="py-4 px-5 text-xs font-mono font-bold text-slate-400">
                      {leadId}
                    </td>

                    <td className="py-4 px-5">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-xs">
                          {lead.title}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                          {lead.description || "No description provided."}
                        </p>
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                        lead.stage === "lead"
                          ? "bg-slate-100 dark:bg-[#0d2336] text-slate-700 dark:text-slate-300"
                          : lead.stage === "opportunity"
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          : lead.stage === "quotation"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      }`}>
                        {lead.stage}
                      </span>
                    </td>

                    <td className="py-4 px-5">
                      <span className={`text-xs font-semibold ${
                        lead.demo_status === "given"
                          ? "text-emerald-600"
                          : lead.demo_status === "pending"
                          ? "text-amber-600"
                          : "text-slate-400"
                      }`}>
                        {lead.demo_status ? lead.demo_status.toUpperCase() : "NONE"}
                      </span>
                    </td>

                    <td className="py-4 px-5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <FiUser className="text-slate-400 text-xs" />
                        <span>{lead.creator_name || "Agent"}</span>
                      </div>
                    </td>

                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPreviewDocLead(lead)}
                          icon={<FiPrinter />}
                        >
                          PI Doc
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOpenDetails(lead)}
                          icon={<FiChevronRight />}
                        >
                          View Flow
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          ) : (
            <div className="text-center py-16 text-slate-400 italic text-xs">
              No leads match your filter criteria.
            </div>
          )}
        </Card>

      ) : (

        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          
          {/* Column 1: Leads In */}
          <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-4 space-y-3 shadow-sm min-h-[400px]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-[#0d2336]">
              <span className="text-xs font-bold text-slate-900 dark:text-white">New Leads</span>
              <span className="text-[10px] bg-slate-100 dark:bg-[#0d2336] text-slate-600 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full">
                {kanbanColumns.lead.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {kanbanColumns.lead.map((l) => (
                <div
                  key={l.id}
                  onClick={() => handleOpenDetails(l)}
                  className="p-3.5 bg-slate-50/80 dark:bg-[#071929]/50 rounded-xl border border-slate-200/60 dark:border-[#0d2336]/60 hover:shadow-md transition-all cursor-pointer space-y-2"
                >
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white leading-tight">{l.title}</h4>
                  <p className="text-[10px] text-slate-400 line-clamp-2">{l.description}</p>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-[#0d2336]/30 text-[9px] text-slate-400">
                    <span>{l.creator_name || "Agent"}</span>
                    <span className="font-bold text-[#233353] dark:text-sky-400">Advance →</span>
                  </div>
                </div>
              ))}
              {kanbanColumns.lead.length === 0 && (
                <div className="py-8 text-center text-slate-400 italic text-xs">No new leads</div>
              )}
            </div>
          </div>

          {/* Column 2: Demo / Qualified */}
          <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-4 space-y-3 shadow-sm min-h-[400px]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-[#0d2336]">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Qualified / Demo</span>
              <span className="text-[10px] bg-blue-500/10 text-blue-600 font-bold px-2 py-0.5 rounded-full">
                {kanbanColumns.opportunity.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {kanbanColumns.opportunity.map((l) => (
                <div
                  key={l.id}
                  onClick={() => handleOpenDetails(l)}
                  className="p-3.5 bg-slate-50/80 dark:bg-[#071929]/50 rounded-xl border-l-4 border-l-blue-500 border-y border-r border-slate-200/60 dark:border-[#0d2336]/60 hover:shadow-md transition-all cursor-pointer space-y-2"
                >
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white leading-tight">{l.title}</h4>
                  <p className="text-[10px] text-slate-400 line-clamp-2">{l.requirements || l.description}</p>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-[#0d2336]/30 text-[9px]">
                    <span className="text-amber-600 font-bold">Demo: {l.demo_status?.toUpperCase() || "PENDING"}</span>
                    <span className="font-bold text-blue-600">Quote →</span>
                  </div>
                </div>
              ))}
              {kanbanColumns.opportunity.length === 0 && (
                <div className="py-8 text-center text-slate-400 italic text-xs">No active qualified leads</div>
              )}
            </div>
          </div>

          {/* Column 3: Quotation */}
          <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-4 space-y-3 shadow-sm min-h-[400px]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-[#0d2336]">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Quotations</span>
              <span className="text-[10px] bg-amber-500/10 text-amber-600 font-bold px-2 py-0.5 rounded-full">
                {kanbanColumns.quotation.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {kanbanColumns.quotation.map((l) => (
                <div
                  key={l.id}
                  onClick={() => handleOpenDetails(l)}
                  className="p-3.5 bg-white dark:bg-[#051422] rounded-xl border border-slate-200/60 dark:border-[#0d2336]/60 hover:shadow-md transition-all cursor-pointer space-y-2"
                >
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white leading-tight">{l.title}</h4>
                  <p className="text-[10px] text-emerald-600 font-bold">
                    Quote Issued: ₹{l.quotation_items ? l.quotation_items.reduce((s, i) => s + (i.qty * i.price), 0).toLocaleString("en-IN") : "0"}
                  </p>
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-[#0d2336]/30 text-[9px] text-slate-400">
                    <span>{l.quotation_type === "purchase_indent" ? "Purchase Indent" : "Sales Quote"}</span>
                    <span className="font-bold text-emerald-600">Close Deal →</span>
                  </div>
                </div>
              ))}
              {kanbanColumns.quotation.length === 0 && (
                <div className="py-8 text-center text-slate-400 italic text-xs">No pending quotations</div>
              )}
            </div>
          </div>

          {/* Column 4: Closed Won */}
          <div className="bg-white dark:bg-[#051422] rounded-2xl border border-slate-200/80 dark:border-[#0d2336] p-4 space-y-3 shadow-sm min-h-[400px]">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-[#0d2336]">
              <span className="text-xs font-bold text-slate-900 dark:text-white">Closed Won</span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full">
                {kanbanColumns.won.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {kanbanColumns.won.map((l) => (
                <div
                  key={l.id}
                  onClick={() => handleOpenDetails(l)}
                  className="p-3.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-500/20 hover:shadow-md transition-all cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold">
                    <FiCheckCircle />
                    <span>{l.title}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Won Deal Verified
                  </p>
                </div>
              ))}
              {kanbanColumns.won.length === 0 && (
                <div className="py-8 text-center text-slate-400 italic text-xs">No closed won leads yet</div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Create Lead Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Pipeline Lead"
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          <Input
            label="Lead Title *"
            required
            placeholder="e.g. Smart Classroom Displays"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Description / Notes
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] p-3 text-xs text-slate-800 dark:text-white outline-none min-h-[90px]"
              placeholder="Describe prospect requirements, contact details, or initial deal context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
            <Button variant="outline" type="button" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Create Lead
            </Button>
          </div>
        </form>
      </Modal>

      {/* CRM Progression Details Modal */}
      {selectedLead && (
        <Modal
          isOpen={!!selectedLead}
          onClose={() => setSelectedLead(null)}
          title={`CRM Lifecycle: ${selectedLead.title}`}
          size="xl"
        >
          <div className="space-y-6">
            {/* Visual Step Progress Bar */}
            <div className="flex items-center justify-between px-3 py-4 bg-slate-50 dark:bg-[#071929]/50 rounded-2xl border border-slate-100 dark:border-[#0d2336]">
              {["lead", "opportunity", "quotation"].map((step, idx) => {
                const isActive = selectedLead.stage === step;
                const isCompleted =
                  (selectedLead.stage === "opportunity" && idx === 0) ||
                  (selectedLead.stage === "quotation" && idx <= 1);
                return (
                  <div key={step} className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isActive
                          ? "bg-[#233353] text-white ring-4 ring-[#233353]/20"
                          : isCompleted
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 dark:bg-[#0d2336] text-slate-400"
                      }`}>
                        {isCompleted ? "✓" : idx + 1}
                      </div>
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${
                        isActive ? "text-[#233353] dark:text-sky-400" : isCompleted ? "text-emerald-500" : "text-slate-400"
                      }`}>
                        {step}
                      </span>
                    </div>
                    {idx < 2 && (
                      <div className={`flex-1 h-0.5 mx-2 ${
                        isCompleted ? "bg-emerald-500" : "bg-slate-200 dark:bg-[#0d2336]"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Stage: Lead */}
            {selectedLead.stage === "lead" && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Prospect Requirements
                  </label>
                  <textarea
                    className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] p-3 text-xs text-slate-800 dark:text-white outline-none min-h-[80px]"
                    placeholder="Enter prospect product requirements and scope..."
                    value={reqsText}
                    onChange={(e) => setReqsText(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    Product Demo Requirement
                  </label>
                  <div className="flex gap-4 text-xs font-semibold">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="demo_pref"
                        checked={demoReqType === "pending"}
                        onChange={() => setDemoReqType("pending")}
                      />
                      <span>Demo Required</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="demo_pref"
                        checked={demoReqType === "skipped"}
                        onChange={() => setDemoReqType("skipped")}
                      />
                      <span>Skip Demo</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-[#0d2336]">
                  <Button
                    variant="outline"
                    onClick={() => handleProgressStage({ stage: "dead", status: "dead" })}
                    loading={progressing}
                  >
                    Declare Dead
                  </Button>
                  <Button
                    onClick={() => handleProgressStage({
                      stage: "opportunity",
                      status: "active",
                      demo_status: demoReqType,
                      requirements: reqsText,
                    })}
                    loading={progressing}
                  >
                    Qualify to Opportunity
                  </Button>
                </div>
              </div>
            )}

            {/* Stage: Opportunity */}
            {selectedLead.stage === "opportunity" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3.5 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929]">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-white">Demo Execution Status</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Status: <span className="font-bold text-[#233353] dark:text-sky-400">{selectedLead.demo_status?.toUpperCase()}</span>
                    </p>
                  </div>
                  {selectedLead.demo_status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleProgressStage({ stage: "opportunity", demo_status: "skipped", requirements: reqsText })}
                      >
                        Skip
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleProgressStage({ stage: "opportunity", demo_status: "given", requirements: reqsText })}
                      >
                        Mark Given
                      </Button>
                    </div>
                  )}
                </div>

                {/* Quotation Item Builder */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Quotation Line Items</label>
                    <button
                      type="button"
                      onClick={handleAddQItem}
                      className="text-xs font-bold text-[#233353] dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <FiPlusCircle /> Add Line Item
                    </button>
                  </div>

                  {qItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select
                        className="flex-grow rounded-lg border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none"
                        value={item.item}
                        onChange={(e) => {
                          const pName = e.target.value;
                          const prod = products.find((p) => p.name === pName);
                          const rate = prod?.attributes?.rate || prod?.attributes?.rate_per_unit || 50000;
                          handleQItemChange(idx, "item", pName);
                          handleQItemChange(idx, "price", rate);
                        }}
                      >
                        <option value="">Select Product from Catalog...</option>
                        {products.map((p: any) => (
                          <option key={p._id} value={p.name}>
                            {p.name} (₹{p.attributes?.rate || 0})
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Qty"
                        className="w-16 rounded-lg border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-2.5 py-1.5 text-xs text-center outline-none"
                        value={item.qty}
                        onChange={(e) => handleQItemChange(idx, "qty", parseInt(e.target.value) || 0)}
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        className="w-24 rounded-lg border border-slate-200 dark:border-[#0d2336] bg-slate-50 dark:bg-[#071929] px-2.5 py-1.5 text-xs text-right outline-none font-mono"
                        value={item.price}
                        onChange={(e) => handleQItemChange(idx, "price", parseFloat(e.target.value) || 0)}
                      />
                      {qItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQItem(idx)}
                          className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        >
                          <FiTrash2 />
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-[#071929] rounded-xl font-bold text-xs">
                    <span>Subtotal:</span>
                    <span className="font-mono text-sm">₹{calculateSubtotal().toLocaleString("en-IN")}</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
                  <Button
                    variant="outline"
                    onClick={() => handleProgressStage({ stage: "dead", status: "dead" })}
                  >
                    Declare Dead
                  </Button>
                  <Button
                    onClick={() => handleProgressStage({
                      stage: "quotation",
                      status: "won",
                      requirements: reqsText,
                      quotation_type: qType,
                      quotation_items: qItems.filter((it) => it.item.trim() !== ""),
                    })}
                    loading={progressing}
                  >
                    Generate Quotation & Qualify
                  </Button>
                </div>
              </div>
            )}

            {/* Stage: Quotation */}
            {selectedLead.stage === "quotation" && (
              <div className="space-y-4">
                <div className="p-6 bg-slate-50/70 dark:bg-[#071929]/40 rounded-2xl border border-slate-200 dark:border-[#0d2336] space-y-4">
                  <div className="flex justify-between items-center border-b pb-3">
                    <span className="text-xs font-bold text-slate-800 dark:text-white uppercase">
                      {selectedLead.quotation_type === "purchase_indent" ? "Purchase Indent" : "Sales Quotation"}
                    </span>
                    <span className="text-xs font-mono font-bold text-emerald-600">Status: Won</span>
                  </div>

                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b text-slate-400 uppercase font-bold">
                        <th className="pb-1.5">Item</th>
                        <th className="pb-1.5 text-center">Qty</th>
                        <th className="pb-1.5 text-right">Price</th>
                        <th className="pb-1.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedLead.quotation_items?.map((it, i) => (
                        <tr key={i} className="border-b">
                          <td className="py-2 font-medium">{it.item}</td>
                          <td className="py-2 text-center">{it.qty}</td>
                          <td className="py-2 text-right font-mono">₹{it.price.toLocaleString("en-IN")}</td>
                          <td className="py-2 text-right font-mono font-bold">₹{(it.qty * it.price).toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t">
                  <Button variant="outline" onClick={() => setSelectedLead(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}

          </div>
        </Modal>
      )}

      {/* PI Print Preview Modal */}
      {previewDocLead && (
        <DocumentPrintPreview
          isOpen={!!previewDocLead}
          onClose={() => setPreviewDocLead(null)}
          documentType={
            previewDocLead.quotation_type === "purchase_indent"
              ? "PURCHASE INDENT"
              : "PROFORMA INVOICE (PI)"
          }
          documentNumber={previewDocLead.id.slice(0, 8).toUpperCase()}
          dateStr={previewDocLead.created_at ? new Date(previewDocLead.created_at).toLocaleDateString("en-IN") : "Today"}
          vendorName={previewDocLead.title}
          items={
            previewDocLead.quotation_items && previewDocLead.quotation_items.length > 0
              ? previewDocLead.quotation_items
              : [{ item: previewDocLead.title, qty: 1, price: 50000 }]
          }
        />
      )}

    </div>
  );
}
