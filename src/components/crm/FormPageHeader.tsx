"use client";

import { ReactNode } from "react";
import { FiDownload, FiUpload, FiX } from "react-icons/fi";

/**
 * Header shared by the New Lead / New Opportunity / New Sales Order pages:
 * title with a Draft badge, breadcrumb underneath, and the action buttons
 * aligned to the right.
 */
export default function FormPageHeader({
  title,
  parentLabel,
  currentLabel = "New",
  badge = "Draft",
  actions,
}: {
  title: string;
  /** First breadcrumb crumb, e.g. "Sales Order". */
  parentLabel: string;
  currentLabel?: string;
  /** Pass an empty string to hide the badge. */
  badge?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>

          {badge && (
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
              {badge}
            </span>
          )}
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
          <span>{parentLabel}</span>
          <span>›</span>
          <span className="text-slate-500 dark:text-slate-300">
            {currentLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

/** Outlined cancel button with the leading × from the design. */
export function CancelButton({
  onClick,
  children = "Cancel",
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-4 text-xs font-semibold text-rose-500 transition hover:bg-rose-50 dark:border-rose-900/40 dark:bg-transparent dark:hover:bg-rose-950/20"
    >
      <FiX size={13} />
      {children}
    </button>
  );
}

/** Neutral outlined button, used for "Save as Draft". */
export function DraftButton({
  onClick,
  disabled,
  withIcon = false,
  children = "Save as Draft",
}: {
  onClick: () => void;
  disabled?: boolean;
  withIcon?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200 dark:hover:bg-[#0b2034]"
    >
      {withIcon && <FiDownload size={13} />}
      {children}
    </button>
  );
}

/** Filled navy button that commits the form. */
export function SubmitButton({
  onClick,
  disabled,
  withIcon = false,
  formId,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  withIcon?: boolean;
  /** Submits the form with this id, for headers rendered outside the form. */
  formId?: string;
  children: ReactNode;
}) {
  return (
    <button
      type={formId ? "submit" : "button"}
      form={formId}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 items-center gap-1.5 rounded-lg bg-[#233353] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#18243a] disabled:opacity-50"
    >
      {withIcon && <FiUpload size={13} />}
      {children}
    </button>
  );
}
