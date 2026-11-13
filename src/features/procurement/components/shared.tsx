"use client";

/* Pieces every procurement screen shares: the status pill, money, the
 * loading / error / empty states, a labelled value, the approval timeline,
 * the activity log and an attachments field. Built on the CRM kit so these
 * screens read like the rest of the product. */

import { ReactNode, useRef, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { FiPaperclip } from "react-icons/fi";

import { StatusPill, type PillTone } from "@/components/crm/Pill";
import { AttachmentList } from "@/features/attachments/AttachmentList";
import {
  ATTACHMENT_ACCEPT,
  uploadAttachments,
  type StoredAttachment,
} from "@/features/attachments/attachments.api";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { useUIStore } from "@/lib/store/ui.store";


/** Words that stay in capitals when a status is turned into a label. */
const ACRONYMS = new Set(["po", "pr", "gst", "rfq", "pan", "msme"]);

/** "AWAITING_PROCUREMENT" -> "Awaiting Procurement", "PO_GENERATED" -> "PO Generated". */
export const humanize = (value?: string | null) =>
  String(value || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ") || "—";

const TONE: Record<string, PillTone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "amber",
  RETURNED: "amber",
  APPROVED: "green",
  REJECTED: "rose",
  CANCELLED: "neutral",
  // Procurement desk
  AWAITING_PROCUREMENT: "blue",
  ASSIGNED: "blue",
  IN_PROGRESS: "blue",
  QUOTATION_COLLECTION: "indigo",
  QUOTATIONS_RECEIVED: "indigo",
  COMPARISON_IN_PROGRESS: "indigo",
  PO_APPROVAL_PENDING: "amber",
  PO_GENERATED: "green",
  COMPLETED: "green",
  ON_HOLD: "rose",
  // Vendors
  PENDING_VERIFICATION: "amber",
  VERIFIED: "blue",
  ACTIVE: "green",
  BLOCKED: "rose",
  INACTIVE: "neutral",
  // Quotations
  RECEIVED: "blue",
  UNDER_REVIEW: "amber",
  CLARIFICATION_REQUIRED: "amber",
  REVISED: "neutral",
  FINAL: "indigo",
  SELECTED: "green",
  EXPIRED: "neutral",
  // Purchase orders
  PENDING: "amber",
  PAID: "green",
  SENT: "indigo",
  ACKNOWLEDGED: "blue",
  CLOSED: "green",
  // Approval steps
  WAITING: "neutral",
  SKIPPED: "neutral",
};

export function ProcStatus({ status, label }: { status?: string | null; label?: string }) {
  const key = String(status || "").toUpperCase();
  return <StatusPill status={key} label={label || humanize(key)} tone={TONE[key] || "neutral"} />;
}

/** Where a PO instalment stands: procurement submit it, accounts approve
    it (or return it) and then mark it paid. */
const PAYMENT_STATUS: Record<string, { label: string; tone: PillTone }> = {
  PENDING: { label: "To submit", tone: "neutral" },
  RETURNED: { label: "Returned", tone: "rose" },
  SUBMITTED: { label: "With accounts", tone: "amber" },
  APPROVED: { label: "Approved", tone: "blue" },
  PAID: { label: "✓ Paid", tone: "green" },
};

export function PaymentStatusPill({ status, overdue }: { status: string; overdue?: boolean }) {
  const known = PAYMENT_STATUS[status] || { label: humanize(status), tone: "neutral" as PillTone };
  const late = overdue && status !== "PAID";
  return (
    <StatusPill
      status={status}
      label={late ? `${known.label} · Overdue` : known.label}
      tone={late && known.tone === "neutral" ? "rose" : known.tone}
    />
  );
}

export const money = (value?: number | null, currency = "INR") =>
  value === null || value === undefined || Number.isNaN(Number(value))
    ? "—"
    : `${currency === "INR" ? "₹" : `${currency} `}${Number(value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

export const day = (value?: string | null) => (value ? formatDate(value) : "—");
export const when = (value?: string | null) => (value ? formatDateTime(value) : "—");

/** "Priya Sharma" -> "PS", for an avatar. */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

export function Loading({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-400">
      <CgSpinner className="animate-spin text-3xl text-primary" />
      <span className="text-xs">{text}</span>
    </div>
  );
}

export function ErrorState({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-5 py-12 text-center">
      <p className="text-[13px] text-rose-600 dark:text-rose-400">{text}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <p className="px-5 py-12 text-center text-[13px] text-[#777777] dark:text-slate-400">{text}</p>
  );
}

/** A white panel with a heading, for detail pages. */
export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl bg-white p-5 dark:border dark:border-[#17304a] dark:bg-[#071929] ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#f3f3f3] pb-3 dark:border-[#17304a]">
        <h2 className="text-[15px] font-medium text-[#474747] dark:text-white">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A label over its value, for read-only detail grids. */
export function Field({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-[#777777] dark:text-slate-400">{label}</p>
      <div className="mt-0.5 break-words text-[13px] text-[#141414] dark:text-slate-200">
        {children === null || children === undefined || children === "" ? "—" : children}
      </div>
    </div>
  );
}

export const TH = "px-4 py-3 text-[12px] font-normal text-[#777777] dark:text-slate-400 whitespace-nowrap";
export const TD = "px-4 py-3 text-[13px] text-[#141414] dark:text-slate-200";
export const ROW =
  "align-top transition hover:bg-slate-50 dark:hover:bg-[#0b2034]";

/** Field classes for inputs outside a FormCard (modals, panels). */
export const INPUT =
  "w-full rounded-lg border border-[#d1d1d1] bg-white px-3 py-2 text-[13px] text-[#141414] outline-none focus:border-[#233353] dark:border-[#17304a] dark:bg-[#071929] dark:text-white";
export const LABEL = "mb-1 block text-[12px] text-[#777777] dark:text-slate-400";

/** Pick files, upload them, keep the list. */
export function AttachmentsField({
  value,
  onChange,
  label = "Attachments",
  hint,
}: {
  value: StoredAttachment[];
  onChange: (files: StoredAttachment[]) => void;
  label?: string;
  hint?: string;
}) {
  const { addToast } = useUIStore();
  const input = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(0);

  const pick = async (files: FileList | null) => {
    const list = Array.from(files || []);
    if (!list.length) return;

    setUploading(list.length);
    try {
      const stored = await uploadAttachments(list, (file, why) =>
        addToast(`${file.name}: ${why}`, "error"),
      );
      onChange([...value, ...stored]);
    } finally {
      setUploading(0);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={LABEL}>{label}</span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={uploading > 0}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
        >
          <FiPaperclip size={12} /> Attach
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={ATTACHMENT_ACCEPT}
          className="hidden"
          onChange={(event) => pick(event.target.files)}
        />
      </div>
      {hint && <p className="mb-2 text-[11px] text-[#999999]">{hint}</p>}
      <AttachmentList
        files={value}
        uploadingCount={uploading}
        onRemove={(index) => onChange(value.filter((_, i) => i !== index))}
        empty="Nothing attached."
      />
    </div>
  );
}

/** A small dialog asking for remarks before an action. */
export function RemarksPrompt({
  title,
  label = "Remarks",
  required,
  confirmLabel,
  danger,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  label?: string;
  required?: boolean;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (remarks: string) => void;
}) {
  const [text, setText] = useState("");
  const blocked = busy || (required && !text.trim());

  return (
    <div className="space-y-4">
      <div>
        <label className={LABEL} htmlFor="proc-remarks">
          {label}
          {required ? " *" : " (optional)"}
        </label>
        <textarea
          id="proc-remarks"
          autoFocus
          rows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className={INPUT}
        />
        <span className="sr-only">{title}</span>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-3.5 py-2 text-[13px] text-slate-700 hover:bg-slate-50 dark:border-[#17304a] dark:text-slate-200"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={blocked}
          onClick={() => onConfirm(text.trim())}
          className={`rounded-lg px-3.5 py-2 text-[13px] font-medium text-white disabled:opacity-50 ${
            danger ? "bg-rose-600 hover:bg-rose-700" : "bg-[#243454] hover:bg-[#18243a]"
          }`}
        >
          {busy ? "Working..." : confirmLabel}
        </button>
      </div>
    </div>
  );
}
