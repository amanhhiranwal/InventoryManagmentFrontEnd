"use client";

import { ReactNode, useEffect } from "react";
import { FiDownload, FiUpload, FiX } from "react-icons/fi";

import { useUIStore } from "@/lib/store/ui.store";

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
  const setFormFocus = useUIStore((state) => state.setFormFocus);

  /* Form pages take the full width in the design: the sidebar hides while
     one is open and comes back when it closes. */
  useEffect(() => {
    setFormFocus(true);
    return () => setFormFocus(false);
  }, [setFormFocus]);

  return (
    <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-[18px] font-medium text-[#141414] dark:text-white">
            {title}
          </h1>

          {badge && (
            <span className="rounded bg-[#dae8f4] px-1.5 py-0.5 text-[11px] text-[#038aff] dark:bg-blue-950/30 dark:text-blue-400">
              {badge}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#777777]">
          <span>{parentLabel}</span>
          <span>›</span>
          <span className="text-[#141414] dark:text-slate-300">
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
      className="flex h-9 items-center gap-1.5 rounded-lg border border-[#f7969e] bg-white px-3.5 text-[13px] font-medium text-[#d00517] transition hover:bg-rose-50 dark:border-rose-900/40 dark:bg-transparent dark:text-rose-400 dark:hover:bg-rose-950/20"
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
      className="flex h-9 items-center gap-1.5 rounded-lg border border-white bg-white px-3.5 text-[13px] font-medium text-[#141414] transition hover:bg-slate-50 disabled:opacity-50 dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200 dark:hover:bg-[#0b2034]"
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
      className="flex h-9 items-center gap-1.5 rounded-lg bg-[#243454] px-3.5 text-[13px] font-medium text-white shadow-sm transition hover:bg-[#18243a] disabled:opacity-50"
    >
      {withIcon && <FiUpload size={13} />}
      {children}
    </button>
  );
}
