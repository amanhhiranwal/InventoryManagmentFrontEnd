/* The pieces a desk's order drawer is built from, drawn the way the sales
   order page draws its own: a section with an icon, a title and a hairline
   under it, and "Label: value" rows. A desk reads like the order it is
   working on. */

import type { ReactNode } from "react";

export function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3 border-b border-[#f3f3f3] pb-2.5 dark:border-[#17304a]">
        <div className="flex items-center gap-2.5">
          {icon && (
            <span className="text-[15px] text-[#474747] dark:text-slate-300">
              {icon}
            </span>
          )}
          <h3 className="text-[14px] font-medium text-[#474747] dark:text-white">
            {title}
          </h3>
        </div>
        {action}
      </div>

      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="flex items-start">
      <span className="w-[150px] shrink-0 text-[11px] text-[#777777] dark:text-slate-400">
        {label}:
      </span>
      <span
        className={`text-[11px] font-medium [overflow-wrap:anywhere] ${
          tone === "good"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "warn"
              ? "text-amber-600 dark:text-amber-400"
              : "text-[#141414] dark:text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
