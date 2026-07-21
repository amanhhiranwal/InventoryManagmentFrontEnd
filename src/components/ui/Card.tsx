import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  title?: ReactNode;
  headerAction?: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export default function Card({
  children,
  title,
  headerAction,
  className = "",
  bodyClassName = "",
}: CardProps) {
  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] shadow-sm overflow-hidden ${className}`}>
      {(title || headerAction) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#0d2336]">
          {typeof title === "string" ? (
            <h3 className="font-bold text-slate-800 dark:text-white text-base">
              {title}
            </h3>
          ) : (
            title
          )}
          {headerAction}
        </div>
      )}
      <div className={`p-5 ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}
