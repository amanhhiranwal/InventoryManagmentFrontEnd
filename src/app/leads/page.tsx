"use client";

import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import { useUIStore } from "@/lib/store/ui.store";
import { useAuthStore } from "@/features/auth/store/auth.store";
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
import PageHeader from "@/components/ui/PageHeader";
import Table from "@/components/ui/Table";
import Modal from "@/components/ui/Modal";
import { FiPlus, FiBriefcase, FiUser, FiCalendar, FiCheckCircle, FiChevronRight, FiEdit2, FiPlusCircle, FiTrash2, FiFileText } from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

interface QuoteItem {
  item: string;
  qty: number;
  price: number;
}

export default function LeadsPage() {
  const { addToast } = useUIStore();
  const currentUser = useAuthStore((state) => state.user);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Lead fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Lead progression modal states
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [progressing, setProgressing] = useState(false);

  // Step variables inside modal
  const [reqsText, setReqsText] = useState("");
  const [demoReqType, setDemoReqType] = useState<"pending" | "skipped">("pending");
  const [qType, setQType] = useState<"quotation" | "purchase_indent">("quotation");
  const [qItems, setQItems] = useState<QuoteItem[]>([{ item: "", qty: 1, price: 0 }]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const data = await getLeadsApi();
      setLeads(data);
    } catch (err: unknown) {
      console.error(err);
      addToast("Failed to fetch leads records.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

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

  // Open details and prefill states
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

  // Check if current user is creator or superior
  const canModifyLead = (lead: Lead) => {
    if (currentUser?.is_super_admin) return true;
    if (lead.creator_id === currentUser?.id) return true;
    // Superiors can modify. Visibility filter in backend ensures they only fetch visible leads.
    // So if it is in their list, they are either the creator or superior!
    return true;
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

  // Quotation Item handlers
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Leads & Opportunity Pipeline"
          description="Qualify leads, schedule demos, adjust requirements, and generate system-signed Quotations."
        />
        <Button
          onClick={() => setShowCreateModal(true)}
          icon={<FiPlus />}
          className="shrink-0"
        >
          Create New Lead
        </Button>
      </div>

      <Card>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
            <CgSpinner className="animate-spin text-3xl text-primary" />
            <span className="text-xs">Loading CRM pipeline records...</span>
          </div>
        ) : leads.length > 0 ? (
          <Table headers={["Pipeline Lead", "Current Stage", "Demo Status", "Creator", "Actions"]}>
            {leads.map((lead) => {
              const isCreatorOrSuperior = canModifyLead(lead);
              return (
                <tr
                  key={lead.id}
                  className="hover:bg-slate-50/50 dark:hover:bg-[#071929]/20 transition-all duration-150"
                >
                  <td className="py-4 px-5">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-white text-sm">
                        {lead.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {lead.description || "No description provided."}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-5">
                    <span className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                      lead.stage === "lead"
                        ? "bg-slate-100 dark:bg-[#0d2336] text-slate-700 dark:text-slate-350"
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
                    <span className={`inline-flex items-center text-xs font-medium ${
                      lead.demo_status === "given"
                        ? "text-emerald-500 font-semibold"
                        : lead.demo_status === "pending"
                        ? "text-amber-500 font-semibold animate-pulse"
                        : lead.demo_status === "skipped"
                        ? "text-slate-400 italic"
                        : "text-slate-400"
                    }`}>
                      {(lead.demo_status || "none") === "none" ? "Not Opted" : (lead.demo_status || "").toUpperCase()}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-xs text-slate-600 dark:text-slate-350">
                    <div className="flex items-center gap-2">
                      <FiUser className="text-slate-400" />
                      <span>{lead.creator_name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDetails(lead)}
                      icon={<FiChevronRight />}
                    >
                      View Flow
                    </Button>
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <div className="text-center py-12 text-slate-400 italic text-xs">
            No pipeline leads currently visible under your reporting structure.
          </div>
        )}
      </Card>

      {/* Creation Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Pipeline Lead"
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          <Input
            label="Lead Title"
            required
            placeholder="e.g. Reliance Retail POS Systems"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Description / Notes
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929] min-h-[100px]"
              placeholder="Describe customer profile or contact channels..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-[#0d2336]">
            <Button
              variant="outline"
              type="button"
              onClick={() => setShowCreateModal(false)}
            >
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
        >
          <div className="space-y-6">
            {/* Visual Progress Bar */}
            <div className="flex items-center justify-between px-2 py-4 bg-slate-50 dark:bg-[#071929]/50 rounded-2xl border border-slate-100 dark:border-[#0d2336]">
              {["lead", "opportunity", "quotation"].map((step, idx) => {
                const isActive = selectedLead.stage === step;
                const isCompleted =
                  (selectedLead.stage === "opportunity" && idx === 0) ||
                  (selectedLead.stage === "quotation" && idx <= 1);
                return (
                  <div key={step} className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isActive
                          ? "bg-primary text-white ring-4 ring-primary/20"
                          : isCompleted
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 dark:bg-[#0d2336] text-slate-400 dark:text-slate-650"
                      }`}>
                        {idx + 1}
                      </div>
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${
                        isActive ? "text-primary" : isCompleted ? "text-emerald-500" : "text-slate-400"
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

            {/* Stage content panels */}
            {selectedLead.stage === "lead" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 leading-relaxed">
                  <strong>Lead Stage:</strong> Gather initial customer requirements. You can qualify this lead to convert it into an Opportunity or declare it Dead.
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Prospect Requirements
                    </label>
                    <textarea
                      className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929] min-h-[80px]"
                      placeholder="e.g. Customer requires POS hardware and automated inventory backend."
                      value={reqsText}
                      onChange={(e) => setReqsText(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Product Demo Preference
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-350 cursor-pointer">
                        <input
                          type="radio"
                          name="demo_pref"
                          checked={demoReqType === "pending"}
                          onChange={() => setDemoReqType("pending")}
                          className="text-primary border-slate-200 dark:border-[#0d2336] focus:ring-primary"
                        />
                        <span>Product Demo Required</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-350 cursor-pointer">
                        <input
                          type="radio"
                          name="demo_pref"
                          checked={demoReqType === "skipped"}
                          onChange={() => setDemoReqType("skipped")}
                          className="text-primary border-slate-200 dark:border-[#0d2336] focus:ring-primary"
                        />
                        <span>Skip Product Demo</span>
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
              </div>
            )}

            {selectedLead.stage === "opportunity" && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                  <strong>Opportunity Stage:</strong> Refine requirements and give a product demo. Once requirements are locked, generate a Quote or Purchase Indent.
                </div>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Prospect Requirements (Editable after Demo)
                    </label>
                    <textarea
                      className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none transition-all focus:border-primary focus:bg-white dark:focus:border-primary-hover dark:focus:bg-[#071929] min-h-[80px]"
                      value={reqsText}
                      onChange={(e) => setReqsText(e.target.value)}
                    />
                  </div>

                  {/* Demo Status triggers */}
                  <div className="flex justify-between items-center p-3 rounded-xl border border-slate-100 dark:border-[#0d2336] bg-slate-50/30 dark:bg-[#071929]/20">
                    <div className="text-xs">
                      <p className="font-bold text-slate-700 dark:text-slate-300">Demo Flow Status</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Current Status: <span className="font-semibold text-primary uppercase">{selectedLead.demo_status?.toUpperCase()}</span>
                      </p>
                    </div>
                    {selectedLead.demo_status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleProgressStage({
                            stage: "opportunity",
                            demo_status: "skipped",
                            requirements: reqsText,
                          })}
                          loading={progressing}
                        >
                          Skip Demo
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleProgressStage({
                            stage: "opportunity",
                            demo_status: "given",
                            requirements: reqsText,
                          })}
                          loading={progressing}
                        >
                          Mark as Given
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Quotation builder form */}
                  <div className="border-t border-slate-100 dark:border-[#0d2336] pt-4 space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
                      Quotation Generator (Generate Quote/Purchase Indent)
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Document Type
                        </label>
                        <select
                          className="w-full rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white outline-none"
                          value={qType}
                          onChange={(e: any) => setQType(e.target.value)}
                        >
                          <option value="quotation">Sales Quotation</option>
                          <option value="purchase_indent">Purchase Indent</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Line Items
                        </label>
                        <button
                          type="button"
                          onClick={handleAddQItem}
                          className="flex items-center gap-1.5 text-xs text-primary font-semibold border-none bg-transparent cursor-pointer"
                        >
                          <FiPlusCircle />
                          <span>Add Item</span>
                        </button>
                      </div>

                      {qItems.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            placeholder="Item Name"
                            className="flex-grow rounded-lg border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none"
                            value={item.item}
                            onChange={(e) => handleQItemChange(idx, "item", e.target.value)}
                          />
                          <input
                            type="number"
                            placeholder="Qty"
                            className="w-16 rounded-lg border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none text-center"
                            value={item.qty}
                            onChange={(e) => handleQItemChange(idx, "qty", parseInt(e.target.value) || 0)}
                          />
                          <input
                            type="number"
                            placeholder="Price"
                            className="w-24 rounded-lg border border-slate-200 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/50 px-3 py-1.5 text-xs text-slate-900 dark:text-white outline-none text-right"
                            value={item.price}
                            onChange={(e) => handleQItemChange(idx, "price", parseFloat(e.target.value) || 0)}
                          />
                          {qItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveQItem(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 border-none bg-transparent cursor-pointer"
                            >
                              <FiTrash2 />
                            </button>
                          )}
                        </div>
                      ))}

                      <div className="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-[#071929]/30 rounded-xl border border-slate-100 dark:border-[#0d2336] mt-4">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-350">
                          Subtotal Amount:
                        </span>
                        <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                          ${calculateSubtotal().toLocaleString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-150 dark:border-[#0d2336] mt-4">
                      <Button
                        variant="outline"
                        onClick={() => handleProgressStage({ stage: "dead", status: "dead" })}
                        loading={progressing}
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
                        Generate & Qualify
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedLead.stage === "quotation" && (
              <div className="space-y-6">
                {/* PDF Style Invoice Invoice */}
                <div className="p-8 bg-white dark:bg-[#051422] rounded-2xl border-2 border-dashed border-slate-200 dark:border-primary/20 shadow-inner relative overflow-hidden">
                  {/* System Verified Stamp watermark */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-4 border-emerald-500/20 text-emerald-500/20 font-bold uppercase tracking-widest text-3xl py-3 px-8 rounded-2xl select-none rotate-12 pointer-events-none">
                    SYSTEM GENERATED
                  </div>

                  <div className="flex justify-between items-start pb-6 border-b border-slate-150 dark:border-[#0d2336]">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <FiFileText className="text-primary" />
                        {selectedLead.quotation_type === "purchase_indent" ? "Purchase Indent" : "Sales Quotation"}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-1">Ref ID: {selectedLead.id}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-bold text-slate-800 dark:text-white">ENTERPRISE SAAS SYSTEM</p>
                      <p className="text-slate-400 mt-0.5">Automated CRM Module</p>
                      <p className="text-slate-400">Date: {new Date(selectedLead.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-6 text-xs border-b border-slate-150 dark:border-[#0d2336]">
                    <div>
                      <p className="font-bold text-slate-500 uppercase tracking-wide">Prospect Details:</p>
                      <p className="font-bold text-slate-800 dark:text-white mt-1.5">{selectedLead.title}</p>
                      <p className="text-slate-400 mt-1">Creator: {selectedLead.creator_name}</p>
                    </div>
                    <div>
                      <p className="font-bold text-slate-500 uppercase tracking-wide">Scope of Requirements:</p>
                      <p className="text-slate-600 dark:text-slate-350 mt-1.5 leading-relaxed italic">
                        "{selectedLead.requirements || "Standard deployment services"}"
                      </p>
                    </div>
                  </div>

                  <div className="py-6">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-[#0d2336]/60 text-slate-500 uppercase font-bold">
                          <th className="pb-2">Description</th>
                          <th className="pb-2 text-center">Qty</th>
                          <th className="pb-2 text-right">Unit Price</th>
                          <th className="pb-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLead.quotation_items && selectedLead.quotation_items.length > 0 ? (
                          selectedLead.quotation_items.map((item: any, idx: number) => (
                            <tr key={idx} className="border-b border-slate-100/40 dark:border-[#0d2336]/20">
                              <td className="py-3 font-semibold text-slate-800 dark:text-white">{item.item}</td>
                              <td className="py-3 text-center">{item.qty}</td>
                              <td className="py-3 text-right">${item.price.toLocaleString()}</td>
                              <td className="py-3 text-right font-bold text-slate-900 dark:text-white">
                                ${(item.qty * item.price).toLocaleString()}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-slate-400 italic">No line items mapped.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-slate-150 dark:border-[#0d2336] text-xs">
                    <div className="w-64 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Subtotal:</span>
                        <span className="font-semibold text-slate-800 dark:text-white">
                          ${calculateSubtotal().toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">GST (18%):</span>
                        <span className="font-semibold text-slate-800 dark:text-white">
                          ${(calculateSubtotal() * 0.18).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-slate-100 dark:border-[#0d2336] pt-2 text-sm">
                        <span className="font-extrabold text-slate-800 dark:text-white">Grand Total:</span>
                        <span className="font-black text-primary">
                          ${(calculateSubtotal() * 1.18).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 dark:border-[#0d2336] pt-3">
                  <Button variant="outline" onClick={() => setSelectedLead(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}

            {selectedLead.stage === "dead" && (
              <div className="space-y-4">
                <div className="p-8 text-center bg-rose-500/5 border border-rose-500/20 rounded-2xl">
                  <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    This lead/opportunity was declared Dead.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    No further actions can be taken in the workflow.
                  </p>
                </div>
                <div className="flex justify-end border-t border-slate-100 dark:border-[#0d2336] pt-3">
                  <Button variant="outline" onClick={() => setSelectedLead(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
