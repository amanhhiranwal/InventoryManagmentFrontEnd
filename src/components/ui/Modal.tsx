import { ReactNode } from "react";
import { FiX } from "react-icons/fi";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg" | "xl";
  hasUnsavedChanges?: boolean;
}

export default function Modal({ isOpen, onClose, title, children, size = "md", hasUnsavedChanges = false }: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-5xl"
  };

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      const discard = window.confirm("You have unsaved changes. Are you sure you want to discard them?");
      if (!discard) return;
    }
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseAttempt();
    }
  };

  return (
    <div
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm transition-all duration-300 overflow-y-auto"
    >
      <div className={`w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-6 shadow-2xl space-y-4 transition-all duration-300 transform scale-100 flex flex-col`}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#0d2336] shrink-0">
          <h3 className="font-bold text-slate-800 dark:text-white text-base">
            {title}
          </h3>
          <button
            onClick={handleCloseAttempt}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#0d2336] transition-colors cursor-pointer"
          >
            <FiX className="text-base" />
          </button>
        </div>
        <div className="text-xs text-slate-600 dark:text-slate-300 overflow-y-auto flex-grow pr-1">{children}</div>
      </div>
    </div>
  );
}
