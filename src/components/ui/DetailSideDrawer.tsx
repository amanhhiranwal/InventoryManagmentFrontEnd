"use client";

import { useEffect, useState } from "react";
import {
  FiX,
  FiMail,
  FiPhone,
  FiMessageSquare,
  FiPlus,
  FiArrowRight,
  FiTrendingUp,
  FiEdit,
  FiTrash2
} from "react-icons/fi";

export interface DrawerCustomerData {
  id: string;
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  company?: string;
  designation?: string;
  category?: string;
  leadValue?: number;
  stage?: "New" | "Open" | "In Progress" | "Open Deal" | "Closed";
  productInterest?: string;
  status?: string;
  activities?: Array<{
    id: string;
    title: string;
    date: string;
    note: string;
    type?: "demo" | "call" | "form" | "email";
  }>;
}

interface DetailSideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  customer: DrawerCustomerData | null;
  onConvertToLead?: (customer: DrawerCustomerData) => void;
  onEdit?: (customer: DrawerCustomerData) => void;
  onMarkDead?: (customer: DrawerCustomerData) => void;
  onStageChange?: (newStage: "New" | "Open" | "In Progress" | "Open Deal" | "Closed") => void;
}

const STAGES: Array<"New" | "Open" | "In Progress" | "Open Deal" | "Closed"> = [
  "New",
  "Open",
  "In Progress",
  "Open Deal",
  "Closed"
];

export default function DetailSideDrawer({
  isOpen,
  onClose,
  customer,
  onConvertToLead,
  onEdit,
  onMarkDead,
  onStageChange
}: DetailSideDrawerProps) {
  const [currentStage, setCurrentStage] = useState<"New" | "Open" | "In Progress" | "Open Deal" | "Closed">("New");
  const [newLogNote, setNewLogNote] = useState("");
  const [showLogInput, setShowLogInput] = useState(false);
  const [activitiesList, setActivitiesList] = useState<Array<{ id: string; title: string; date: string; note: string }>>([]);

  useEffect(() => {
    if (customer) {
      setCurrentStage(customer.stage || "New");
      setActivitiesList(customer.activities && customer.activities.length > 0 ? customer.activities : []);
    }
  }, [customer]);

  if (!isOpen || !customer) return null;

  const handleStageClick = (stage: "New" | "Open" | "In Progress" | "Open Deal" | "Closed") => {
    setCurrentStage(stage);
    if (onStageChange) {
      onStageChange(stage);
    }
  };

  const handleAddLog = () => {
    if (!newLogNote.trim()) return;
    const newEntry = {
      id: Date.now().toString(),
      title: "Note Added",
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      note: newLogNote.trim()
    };
    setActivitiesList([newEntry, ...activitiesList]);
    setNewLogNote("");
    setShowLogInput(false);
  };

  const stageIndex = STAGES.indexOf(currentStage);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-[440px] bg-white dark:bg-[#051422] shadow-2xl flex flex-col justify-between border-l border-slate-200 dark:border-[#0d2336] animate-fadeIn">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-[#0d2336] shrink-0 bg-white dark:bg-[#051422]">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#071929] cursor-pointer"
              >
                <FiX className="text-xl" />
              </button>
              <h3 className="text-base font-bold text-[#172839] dark:text-white">
                Contact Details
              </h3>
            </div>

            {onConvertToLead && (
              <button
                onClick={() => onConvertToLead(customer)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#233353] hover:bg-[#101725] text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <FiPlus className="text-xs" />
                <span>Convert To Lead</span>
                <FiArrowRight className="text-xs" />
              </button>
            )}
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-thin">
            
            {/* 1. Profile Section */}
            <div className="flex flex-col items-center text-center space-y-3 bg-slate-50/70 dark:bg-[#071929]/40 p-5 rounded-2xl border border-slate-150 dark:border-[#0d2336]/60">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#233353] to-[#395388] text-white flex items-center justify-center text-2xl font-black shadow-md">
                {customer.name ? customer.name.slice(0, 2).toUpperCase() : "CU"}
              </div>
              <div>
                <h4 className="text-lg font-bold text-[#131313] dark:text-white">
                  {customer.contactName || customer.name}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {customer.designation || "Contact Person"} @ <span className="font-semibold text-slate-700 dark:text-slate-300">{customer.company || customer.name}</span>
                </p>
              </div>

              {/* Quick Contact Buttons */}
              <div className="flex items-center gap-3 pt-2">
                {customer.contactEmail && (
                  <a
                    href={`mailto:${customer.contactEmail}`}
                    title="Send Email"
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] text-slate-700 dark:text-slate-200 hover:bg-[#233353] hover:text-white hover:border-[#233353] transition-all shadow-sm cursor-pointer"
                  >
                    <FiMail className="text-sm" />
                  </a>
                )}
                {customer.contactPhone && (
                  <>
                    <a
                      href={`tel:${customer.contactPhone}`}
                      title="Call Customer"
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] text-slate-700 dark:text-slate-200 hover:bg-[#233353] hover:text-white hover:border-[#233353] transition-all shadow-sm cursor-pointer"
                    >
                      <FiPhone className="text-sm" />
                    </a>
                    <a
                      href={`https://wa.me/${customer.contactPhone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      title="WhatsApp Message"
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] text-slate-700 dark:text-slate-200 hover:bg-[#233353] hover:text-white hover:border-[#233353] transition-all shadow-sm cursor-pointer"
                    >
                      <FiMessageSquare className="text-sm" />
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* 2. Chevron Pipeline Stage Progression Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                  PIPELINE STAGE PROGRESSION
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  {currentStage}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1 bg-slate-100 dark:bg-[#071929] p-1.5 rounded-xl border border-slate-200/60 dark:border-[#0d2336]">
                {STAGES.map((st, idx) => {
                  const isActive = idx === stageIndex;
                  const isPassed = idx < stageIndex;

                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStageClick(st)}
                      className={`py-2 px-1 text-center rounded-lg text-[10px] font-bold transition-all cursor-pointer truncate ${
                        isActive
                          ? "bg-[#233353] text-white shadow-sm ring-2 ring-[#233353]/20"
                          : isPassed
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25"
                          : "text-slate-500 hover:bg-slate-200/60 dark:hover:bg-slate-800"
                      }`}
                    >
                      {isPassed ? "✓ " : ""}{st}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Product Interest & Lead Value Metrics */}
            <div className="grid grid-cols-2 gap-3">
              {/* Product Interest Card */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#071929]/50 border border-slate-200/70 dark:border-[#0d2336] flex flex-col justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  PRODUCT INTEREST
                </span>
                <h5 className="text-sm font-extrabold text-[#233353] dark:text-white mt-1 leading-tight line-clamp-2">
                  {customer.productInterest || customer.category || "Not specified"}
                </h5>
                <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-emerald-600">
                  <FiTrendingUp className="text-xs" />
                  <span>{customer.category || "General"}</span>
                </div>
              </div>

              {/* Lead Value Card */}
              <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#071929]/50 border border-slate-200/70 dark:border-[#0d2336] flex flex-col justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  LEAD VALUE
                </span>
                <h5 className="text-sm font-black text-[#233353] dark:text-white font-mono mt-1">
                  ₹{(customer.leadValue || 0).toLocaleString("en-IN")}
                </h5>
                <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-slate-500">
                  <span>Status:</span>
                  <span className="text-emerald-600">{customer.status || "Active"}</span>
                </div>
              </div>
            </div>

            {/* 4. Activity History Timeline */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-white">
                  Activity History
                </h4>
                <button
                  type="button"
                  onClick={() => setShowLogInput(!showLogInput)}
                  className="flex items-center gap-1 text-xs font-bold text-[#233353] dark:text-sky-400 hover:underline cursor-pointer"
                >
                  <FiPlus className="text-xs" />
                  <span>Log Activity</span>
                </button>
              </div>

              {/* Add Note Input Box */}
              {showLogInput && (
                <div className="p-3 bg-white dark:bg-[#051422] rounded-xl border border-slate-200 dark:border-[#0d2336] space-y-2 animate-fadeIn">
                  <textarea
                    rows={2}
                    placeholder="Enter call notes, scheduled meetings, or requirement updates..."
                    value={newLogNote}
                    onChange={(e) => setNewLogNote(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#071929] outline-none text-slate-800 dark:text-white placeholder:text-slate-400"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLogInput(false)}
                      className="px-2.5 py-1 rounded text-xs text-slate-500 hover:bg-slate-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddLog}
                      className="px-3 py-1 rounded bg-[#233353] text-white text-xs font-bold hover:bg-[#101725] cursor-pointer shadow-sm"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              )}

              {/* Activity Timeline List */}
              {activitiesList.length > 0 ? (
                <div className="space-y-3 relative pl-3">
                  <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-800" />
                  {activitiesList.map((act) => (
                    <div key={act.id} className="flex gap-3 items-start relative">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#233353] dark:bg-sky-400 mt-1 shrink-0 ring-4 ring-white dark:ring-[#051422] z-10" />
                      <div className="bg-slate-50/70 dark:bg-[#071929]/40 p-3 rounded-xl border border-slate-150 dark:border-[#0d2336]/60 flex-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-slate-800 dark:text-white">
                            {act.title}
                          </span>
                          <span className="text-[9px] font-semibold text-slate-400">
                            {act.date}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-350 mt-1 leading-relaxed">
                          {act.note}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 text-xs italic bg-slate-50/50 dark:bg-[#071929]/20 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  No activity logs recorded for this contact yet. Click &quot;Log Activity&quot; to add notes.
                </div>
              )}
            </div>

          </div>

          {/* Footer Action Buttons */}
          <div className="p-4 px-6 border-t border-slate-100 dark:border-[#0d2336] bg-slate-50/50 dark:bg-[#071929]/20 flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                if (onEdit) onEdit(customer);
              }}
              className="flex-1 py-2.5 rounded-xl bg-[#233353] hover:bg-[#101725] text-white text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FiEdit className="text-xs" />
              <span>Edit Details</span>
            </button>
            <button
              onClick={() => {
                if (onMarkDead) onMarkDead(customer);
              }}
              className="flex-1 py-2.5 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FiTrash2 className="text-xs" />
              <span>Mark Inactive</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
