"use client";

import { useUIStore } from "@/lib/store/ui.store";
import { FiCheckCircle, FiAlertTriangle, FiAlertCircle, FiInfo, FiX } from "react-icons/fi";

export default function ToastContainer() {
  const { toasts, removeToast } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      {toasts.map((toast) => {
        let Icon = FiInfo;
        let bgStyle = "";
        let borderStyle = "";
        let textStyle = "";
        let iconColor = "";

        switch (toast.type) {
          case "success":
            Icon = FiCheckCircle;
            bgStyle = "bg-emerald-500/10 dark:bg-emerald-500/15";
            borderStyle = "border-emerald-500/35 dark:border-emerald-500/25";
            textStyle = "text-emerald-800 dark:text-emerald-200";
            iconColor = "text-emerald-500 dark:text-emerald-400";
            break;
          case "error":
            Icon = FiAlertCircle;
            bgStyle = "bg-rose-500/10 dark:bg-rose-500/15";
            borderStyle = "border-rose-500/35 dark:border-rose-500/25";
            textStyle = "text-rose-800 dark:text-rose-200";
            iconColor = "text-rose-500 dark:text-rose-400";
            break;
          case "warning":
            Icon = FiAlertTriangle;
            bgStyle = "bg-amber-500/10 dark:bg-amber-500/15";
            borderStyle = "border-amber-500/35 dark:border-amber-500/25";
            textStyle = "text-amber-800 dark:text-amber-200";
            iconColor = "text-amber-500 dark:text-amber-400";
            break;
          default:
            Icon = FiInfo;
            bgStyle = "bg-sky-500/10 dark:bg-sky-500/15";
            borderStyle = "border-sky-500/35 dark:border-sky-500/25";
            textStyle = "text-sky-800 dark:text-sky-200";
            iconColor = "text-sky-500 dark:text-sky-400";
        }

        return (
          <div
            key={toast.id}
            className={`
              pointer-events-auto
              flex items-start gap-3.5
              p-4 rounded-xl border
              backdrop-blur-xl shadow-xl
              ${bgStyle} ${borderStyle} ${textStyle}
              animate-slideIn
              transition-all duration-300
            `}
          >
            <Icon className={`text-xl shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-grow text-sm font-medium">
              {toast.message}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <FiX className="text-base" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
