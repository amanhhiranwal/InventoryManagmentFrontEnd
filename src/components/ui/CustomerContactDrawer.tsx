"use client";

import { useState } from "react";
import {
  FiX,
  FiMoreVertical,
  FiMessageSquare,
  FiMail,
  FiPhone,
  FiMapPin,
  FiEdit2,
  FiSlash,
  FiActivity,
  FiChevronRight,
} from "react-icons/fi";

export interface ContactActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string;
}

export interface ContactDrawerCustomer {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  company: string;
  designation: string;
  location: string;
  status: "Active" | "Inactive";
  customerType: string;
  image?: string;
  activities?: ContactActivity[];
}

interface CustomerContactDrawerProps {
  isOpen: boolean;
  customer: ContactDrawerCustomer | null;
  onClose: () => void;
  onEdit?: (customer: ContactDrawerCustomer) => void;
  onMarkDead?: (customer: ContactDrawerCustomer) => void;
  onConvertToLead?: (customer: ContactDrawerCustomer) => void;
}

export default function CustomerContactDrawer({
  isOpen,
  customer,
  onClose,
  onEdit,
  onMarkDead,
  onConvertToLead,
}: CustomerContactDrawerProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (!isOpen || !customer) return null;

  const activities =
    customer.activities && customer.activities.length > 0
      ? customer.activities
      : [
          {
            id: "activity-1",
            type: "Outgoing Call",
            title: "Outgoing Call",
            description:
              "Discussed technical specs and power requirements. Lead seems very engaged.",
            date: "Yesterday",
          },
          {
            id: "activity-2",
            type: "Form Submission",
            title: "Form Submission",
            description: `Lead entered through "Synergy" landing page.`,
            date: "Aug 02, 2026",
          },
        ];

  const handleEdit = () => {
    setMenuOpen(false);
    onEdit?.(customer);
  };

  const handleMarkDead = () => {
    setMenuOpen(false);
    onMarkDead?.(customer);
  };

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close contact details"
        onClick={onClose}
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px] cursor-default"
      />

      {/* Drawer */}
      <aside className="relative ml-auto h-full w-full max-w-[620px] bg-white dark:bg-[#051422] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="h-[68px] flex items-center justify-between px-6 border-b border-slate-200 dark:border-[#0d2336] shrink-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-[#071929] transition-colors"
            >
              <FiX className="text-lg" />
            </button>

            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Contact Details
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onConvertToLead?.(customer)}
            className="rounded-xl bg-[#233353] hover:bg-[#101725] text-white px-5 py-2.5 text-xs font-bold transition-colors"
          >
            Convert To Lead
          </button>
        </div>

        {/* Pipeline stages */}
        <div className="h-[56px] border-b border-slate-200 dark:border-[#0d2336] flex items-center shrink-0">
          {["New", "Open", "In Progress", "Open Deal", "Closed"].map(
            (stage, index) => (
              <div
                key={stage}
                className={`flex-1 h-full flex items-center justify-center gap-2 text-[11px] ${
                  index === 0
                    ? "bg-[#fff5cf] text-slate-700"
                    : "text-slate-500"
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                    index === 0
                      ? "border-[#e8b900]"
                      : "border-slate-400"
                  }`}
                >
                  {index === 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#e8b900]" />
                  )}
                </span>

                <span>{stage}</span>
              </div>
            )
          )}
        </div>

        {/* Scroll content */}
        <div className="flex-1 overflow-y-auto">
          {/* Contact information */}
          <div className="px-8 py-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="relative">
                  {customer.image ? (
                    <img
                      src={customer.image}
                      alt=""
                      className="w-[92px] h-[92px] rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-[92px] h-[92px] rounded-full bg-slate-100 dark:bg-[#0b2032] flex items-center justify-center text-2xl font-bold text-[#233353] dark:text-white">
                      {customer.name
                        .split(" ")
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                  )}

                  <span
                    className={`absolute right-1 bottom-1 w-6 h-6 rounded-full border-[3px] border-white dark:border-[#051422] ${
                      customer.status === "Active"
                        ? "bg-emerald-500"
                        : "bg-slate-400"
                    }`}
                  />
                </div>

                <div>
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                    {customer.name}
                  </h3>

                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {customer.designation} @ {customer.company}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 mt-2">
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <FiMail />
                      {customer.email}
                    </span>

                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      <FiPhone />
                      {customer.phone}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-500">
                    <FiMapPin />
                    {customer.location || "India"}
                  </div>
                </div>
              </div>

              {/* Message + menu */}
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  className="w-11 h-11 rounded-xl border border-slate-200 dark:border-[#0d2336] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#071929]"
                  title="Message"
                >
                  <FiMessageSquare />
                </button>

                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="w-11 h-11 rounded-xl border border-slate-200 dark:border-[#0d2336] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#071929]"
                  title="More"
                >
                  <FiMoreVertical />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-12 z-20 w-44 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#071929] shadow-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={handleEdit}
                      className="w-full px-4 py-3 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#0b2032] flex items-center gap-3"
                    >
                      <FiEdit2 />
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={handleMarkDead}
                      className="w-full px-4 py-3 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center gap-3"
                    >
                      <FiSlash />
                      Mark as Dead
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Activity header */}
            <div className="mt-9 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800 dark:text-white">
                Activity History
              </h4>

              <button
                type="button"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-[#233353] flex items-center gap-1"
              >
                + Log Activity
              </button>
            </div>

            {/* Timeline */}
            <div className="relative mt-5 pl-6">
              <div className="absolute left-[7px] top-3 bottom-4 w-px bg-slate-200 dark:bg-[#0d2336]" />

              <div className="space-y-7">
                {activities.map((activity, index) => (
                  <div key={activity.id} className="relative">
                    <span
                      className={`absolute -left-[25px] top-2.5 w-3 h-3 rounded-full border-2 border-white dark:border-[#051422] ${
                        index === 0
                          ? "bg-[#233353]"
                          : "bg-slate-300 dark:bg-slate-600"
                      }`}
                    />

                    <div
                      className={`rounded-xl ${
                        index === 0
                          ? "border border-slate-200 dark:border-[#0d2336] shadow-sm"
                          : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <FiActivity
                              className={
                                index === 0
                                  ? "text-[#233353] dark:text-sky-400"
                                  : "text-slate-400"
                              }
                            />

                            <p className="text-sm font-bold text-slate-800 dark:text-white">
                              {activity.title}
                            </p>
                          </div>

                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                            {activity.description}
                          </p>
                        </div>

                        <span className="text-[10px] text-slate-500 whitespace-nowrap">
                          {activity.date}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Basic metadata */}
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 dark:bg-[#071929] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  Customer Type
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-white mt-1">
                  {customer.customerType}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-[#071929] p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                  Status
                </p>
                <p className="text-sm font-semibold text-slate-800 dark:text-white mt-1">
                  {customer.status}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}