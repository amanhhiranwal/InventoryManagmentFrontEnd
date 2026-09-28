import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/**
 * Title row for the Masters, Users and Reports screens.
 *
 * Deliberately the same type scale and spacing as ListPageHeader, which
 * the CRM lists use: these were an 24px extra-bold title under a full
 * rule while Leads next door was an 18px semibold one with no rule, and
 * moving between the two read like moving between two products. The rule
 * is gone too - the page already separates its header from its content
 * with white space.
 */
export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="space-y-1">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-[18px] font-semibold text-slate-900 dark:text-white">
          {title}
        </h1>

        {action && <div className="flex items-center gap-2">{action}</div>}
      </div>

      {description && (
        <p className="text-[13px] text-[#777777] dark:text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
}
