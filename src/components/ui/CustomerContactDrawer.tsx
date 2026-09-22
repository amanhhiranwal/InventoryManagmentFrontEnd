"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FiEdit2,
  FiMail,
  FiMapPin,
  FiMessageSquare,
  FiMoreVertical,
  FiPhone,
  FiRotateCcw,
  FiSlash,
  FiX,
} from "react-icons/fi";
import { CgSpinner } from "react-icons/cg";

import {
  CUSTOMER_ACTIVITY_TYPES,
  CUSTOMER_STAGES,
  CustomerActivity,
  CustomerActivityType,
  CustomerModel,
  CustomerStage,
} from "@/features/customers/api/customers.api";

/**
 * Contact Details panel from the design: the stage stepper, the contact's
 * profile, Activity History with Log Activity, and Edit Contact / Convert To
 * Lead. Every action is saved; the page passes the handlers.
 */
export default function CustomerContactDrawer({
  customer,
  activities,
  loading,
  busy,
  onClose,
  onEdit,
  onStageChange,
  onLogActivity,
  onMarkDead,
  onReactivate,
  onConvertToLead,
}: {
  customer: CustomerModel | null;
  activities: CustomerActivity[];
  loading?: boolean;
  /** Something is being saved; controls are disabled meanwhile. */
  busy?: boolean;
  onClose: () => void;
  onEdit: (customer: CustomerModel) => void;
  onStageChange: (customer: CustomerModel, stage: CustomerStage) => void;
  onLogActivity: (
    customer: CustomerModel,
    type: CustomerActivityType,
    description: string,
  ) => Promise<boolean>;
  onMarkDead: (customer: CustomerModel, reason: string) => Promise<boolean>;
  onReactivate: (customer: CustomerModel) => void;
  onConvertToLead: (customer: CustomerModel) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logType, setLogType] = useState<CustomerActivityType>("Call");
  const [logText, setLogText] = useState("");
  const [deadOpen, setDeadOpen] = useState(false);
  const [deadReason, setDeadReason] = useState("");

  /* A different customer starts with the forms closed. */
  useEffect(() => {
    setMenuOpen(false);
    setLogOpen(false);
    setLogText("");
    setDeadOpen(false);
    setDeadReason("");
  }, [customer?.id]);

  if (!customer) return null;

  const inactive = customer.status === "Inactive";
  const stageIndex = Math.max(
    0,
    CUSTOMER_STAGES.findIndex((stage) => stage.value === (customer.stage || "NEW")),
  );
  const displayName = customer.contact_name || customer.name;
  const location = [customer.city, customer.state].filter(Boolean).join(", ") || customer.country || "India";

  const saveLog = async () => {
    if (!logText.trim()) return;
    if (await onLogActivity(customer, logType, logText.trim())) {
      setLogText("");
      setLogOpen(false);
    }
  };

  const saveDead = async () => {
    if (!deadReason.trim()) return;
    if (await onMarkDead(customer, deadReason.trim())) {
      setDeadReason("");
      setDeadOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex">
      <button
        type="button"
        aria-label="Close contact details"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/40"
      />

      <aside className="relative ml-auto flex h-full w-full max-w-[660px] flex-col bg-white shadow-2xl dark:bg-[#051422]">
        {/* Header */}
        <div className="flex h-[62px] shrink-0 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#141414] transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#0b2034]"
            >
              <FiX size={16} />
            </button>

            <h2 className="text-[16px] font-medium text-[#141414] dark:text-white">
              Contact Details
            </h2>
          </div>

          {customer.converted_lead_id ? (
            <Link
              href={`/leads?open=${customer.converted_lead_id}`}
              className="flex h-[35px] items-center rounded-lg border border-[#d1d1d1] bg-white px-4 text-[12px] font-medium text-[#141414] transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
            >
              View Lead #{customer.converted_lead_id}
            </Link>
          ) : (
            <button
              type="button"
              disabled={busy || inactive}
              title={inactive ? "Reactivate the customer first" : undefined}
              onClick={() => onConvertToLead(customer)}
              className="h-[35px] rounded-lg bg-[#273756] px-4 text-[12px] font-medium text-white transition hover:bg-[#18243a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Convert To Lead
            </button>
          )}
        </div>

        {/* Stage stepper */}
        <div className="grid shrink-0 grid-cols-4 border-y border-[#f0f0f0] dark:border-[#17304a]">
          {CUSTOMER_STAGES.map((stage, index) => {
            const current = index === stageIndex;
            const passed = index < stageIndex;

            return (
              <button
                key={stage.value}
                type="button"
                disabled={busy || inactive || current}
                onClick={() => onStageChange(customer, stage.value)}
                title={inactive ? "Reactivate the customer to change its stage" : `Move to ${stage.label}`}
                className={`flex h-[34px] items-center justify-center gap-2 text-[11px] transition disabled:cursor-default ${
                  current
                    ? "bg-[#fdf3cf] text-[#141414] dark:bg-amber-950/30 dark:text-amber-200"
                    : "text-[#474747] hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-[#0b2034]"
                }`}
              >
                <span
                  className={`flex h-3 w-3 items-center justify-center rounded-full border ${
                    current
                      ? "border-[#d9a400]"
                      : passed
                        ? "border-[#273756] bg-[#273756]"
                        : "border-[#9a9a9a]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      current ? "bg-[#d9a400]" : passed ? "bg-white" : "bg-[#9a9a9a]"
                    }`}
                  />
                </span>
                {stage.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          {/* Profile */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative shrink-0">
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-slate-100 text-[20px] font-semibold text-[#273756] dark:bg-[#0b2034] dark:text-white">
                  {displayName
                    .split(" ")
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </div>

                <span
                  title={customer.status}
                  className={`absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-[3px] border-white dark:border-[#051422] ${
                    inactive ? "bg-rose-500" : "bg-emerald-500"
                  }`}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[16px] font-medium text-[#141414] dark:text-white">
                    {displayName}
                  </h3>
                  {inactive && (
                    <span className="rounded-full border border-rose-300 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-600 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400">
                      Dead
                    </span>
                  )}
                </div>

                <p className="text-[12px] text-[#474747] dark:text-slate-300">
                  {customer.designation || "Contact"} @ {customer.name}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#474747] dark:text-slate-400">
                  {customer.email && (
                    <a href={`mailto:${customer.email}`} className="flex items-center gap-1 hover:underline">
                      <FiMail size={11} />
                      {customer.email}
                    </a>
                  )}
                  {customer.phone && (
                    <a href={`tel:${customer.phone}`} className="flex items-center gap-1 hover:underline">
                      <FiPhone size={11} />
                      {customer.phone}
                    </a>
                  )}
                </div>

                <p className="mt-1 flex items-center gap-1 text-[11px] text-[#474747] dark:text-slate-400">
                  <FiMapPin size={11} />
                  {location}
                </p>
              </div>
            </div>

            <div className="relative flex shrink-0 items-center gap-2">
              <a
                href={
                  customer.phone
                    ? `https://wa.me/${customer.phone.replace(/[^0-9]/g, "")}`
                    : customer.email
                      ? `mailto:${customer.email}`
                      : undefined
                }
                target="_blank"
                rel="noreferrer"
                title="Message"
                aria-label="Message"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d1d1d1] text-[#141414] transition hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-300 dark:hover:bg-[#0b2034]"
              >
                <FiMessageSquare size={14} />
              </a>

              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-label="More"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d1d1d1] text-[#141414] transition hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-300 dark:hover:bg-[#0b2034]"
              >
                <FiMoreVertical size={14} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-10 z-20 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-[#17304a] dark:bg-[#071929]">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(customer);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[#141414] hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-[#0b2034]"
                  >
                    <FiEdit2 size={12} />
                    Edit
                  </button>

                  {inactive ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setMenuOpen(false);
                        onReactivate(customer);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    >
                      <FiRotateCcw size={12} />
                      Reactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setDeadOpen(true);
                        setLogOpen(false);
                      }}
                      className="flex w-full items-center gap-2 bg-rose-50 px-3 py-2 text-left text-[12px] text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40"
                    >
                      <FiSlash size={12} />
                      Mark as Dead
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mark as Dead reason */}
          {deadOpen && (
            <div className="mt-5 space-y-2 rounded-lg border border-rose-200 bg-rose-50/60 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
              <p className="text-[12px] font-medium text-rose-700 dark:text-rose-400">
                Why is this customer dead?
              </p>
              <textarea
                rows={2}
                value={deadReason}
                onChange={(event) => setDeadReason(event.target.value)}
                placeholder="e.g. Chose a competitor, no budget this year..."
                className="w-full resize-none rounded-lg border border-[#d1d1d1] bg-white p-2.5 text-[12px] text-[#141414] outline-none focus:border-rose-400 dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeadOpen(false)}
                  className="h-8 rounded-lg px-3 text-[12px] text-[#474747] hover:bg-white dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || !deadReason.trim()}
                  onClick={saveDead}
                  className="h-8 rounded-lg bg-rose-600 px-3 text-[12px] font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  Mark as Dead
                </button>
              </div>
            </div>
          )}

          {/* Activity History */}
          <div className="mt-8 flex items-center justify-between">
            <h4 className="text-[13px] font-medium text-[#141414] dark:text-white">
              Activity History
            </h4>

            <button
              type="button"
              onClick={() => {
                setLogOpen((open) => !open);
                setDeadOpen(false);
              }}
              className="text-[11px] text-[#474747] transition hover:text-[#273756] dark:text-slate-300 dark:hover:text-white"
            >
              {logOpen ? "Cancel" : "+ Log Activity"}
            </button>
          </div>

          {logOpen && (
            <div className="mt-3 space-y-3 rounded-lg border border-[#e2e2e2] p-3 dark:border-[#17304a]">
              <div className="flex flex-wrap gap-1.5">
                {CUSTOMER_ACTIVITY_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setLogType(type)}
                    className={`h-7 rounded-full border px-3 text-[11px] transition ${
                      logType === type
                        ? "border-[#273756] bg-[#273756] text-white"
                        : "border-[#d1d1d1] text-[#474747] hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-300 dark:hover:bg-[#0b2034]"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <textarea
                rows={3}
                value={logText}
                onChange={(event) => setLogText(event.target.value)}
                placeholder="What was discussed or agreed?"
                className="w-full resize-none rounded-lg border border-[#d1d1d1] bg-[#f3f3f3] p-2.5 text-[12px] text-[#141414] outline-none placeholder:text-[#a9a9a9] focus:border-[#273756] dark:border-[#17304a] dark:bg-[#071929] dark:text-white"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={busy || !logText.trim()}
                  onClick={saveLog}
                  className="h-8 rounded-lg bg-[#273756] px-4 text-[12px] font-medium text-white transition hover:bg-[#18243a] disabled:opacity-50"
                >
                  Save Activity
                </button>
              </div>
            </div>
          )}

          <div className="relative mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-slate-400">
                <CgSpinner className="animate-spin text-xl" />
              </div>
            ) : activities.length === 0 ? (
              <p className="py-8 text-center text-[12px] text-[#777777]">
                No activity yet. Use + Log Activity to record a call, email or meeting.
              </p>
            ) : (
              <>
                <span className="absolute bottom-3 left-[3.5px] top-3 w-px bg-[#e2e2e2] dark:bg-[#17304a]" />

                <ol className="space-y-5">
                  {activities.map((activity, index) => (
                    <li key={activity.id} className="relative pl-5">
                      <span
                        className={`absolute left-0 top-3 h-2 w-2 rounded-full ${
                          index === 0 ? "bg-[#273756] dark:bg-sky-400" : "bg-[#c4c4c4] dark:bg-slate-600"
                        }`}
                      />

                      <div
                        className={`rounded-lg px-3 py-2.5 ${
                          index === 0
                            ? "border border-[#e8e8e8] shadow-[0_2px_8px_rgba(15,23,42,0.06)] dark:border-[#17304a]"
                            : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-[12px] font-medium text-[#141414] dark:text-white">
                            {activity.action}
                          </p>
                          <span className="shrink-0 text-[10px] text-[#474747] dark:text-slate-400">
                            {formatActivityDate(activity.created_at)}
                          </span>
                        </div>

                        {activity.description && (
                          <p className="mt-1 max-w-[380px] whitespace-pre-line text-[11px] leading-relaxed text-[#474747] dark:text-slate-300">
                            {activity.description}
                          </p>
                        )}

                        {activity.created_by_name && (
                          <p className="mt-1 text-[10px] text-[#9a9a9a]">
                            by {activity.created_by_name}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 bg-[#f7f7f7] px-5 py-3 dark:bg-[#071929]">
          <button
            type="button"
            onClick={() => onEdit(customer)}
            className="flex h-[39px] w-full items-center justify-center gap-2 rounded-lg border border-[#e2e2e2] bg-white text-[12px] font-medium text-[#141414] transition hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#051422] dark:text-slate-200 dark:hover:bg-[#0b2034]"
          >
            <FiEdit2 size={13} />
            Edit Contact
          </button>
        </div>
      </aside>
    </div>
  );
}

/** "Today", "Yesterday", or "Aug 02, 2026", as the design dates entries. */
function formatActivityDate(value: string) {
  const date = new Date(value.endsWith("Z") || value.includes("+") ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return value;

  const today = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(today) - startOf(date)) / 86_400_000);

  if (days === 0) {
    return `Today, ${date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (days === 1) return "Yesterday";

  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
