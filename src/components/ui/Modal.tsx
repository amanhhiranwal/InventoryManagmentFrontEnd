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

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  hasUnsavedChanges = false,
}: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    md: "max-w-md",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  };

  const handleCloseAttempt = () => {
    if (hasUnsavedChanges) {
      const discard = window.confirm(
        "You have unsaved changes. Are you sure you want to discard them?",
      );
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
      className="
      fixed
      inset-0
      z-50
      flex
      items-center
      justify-center
      overflow-y-auto
      bg-slate-900/60
      p-4
      backdrop-blur-sm
      transition-all
      duration-300
      dark:bg-black/80
    "
    >
      <div
        className={`
        w-full
        ${sizeClasses[size]}
        max-h-[90vh]
        overflow-y-auto
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-6
        shadow-2xl
        transition-all
        duration-300
        dark:border-[#0d2336]
        dark:bg-[#051422]
      `}
      >
        {/* Header */}
        <div
          className="
          flex
          shrink-0
          items-center
          justify-between
          border-b
          border-slate-100
          pb-3
          dark:border-[#0d2336]
        "
        >
          <h3
            className="
            text-base
            font-bold
            text-slate-800
            dark:text-white
          "
          >
            {title}
          </h3>

          <button
            type="button"
            onClick={handleCloseAttempt}
            className="
            rounded-lg
            p-1
            text-slate-400
            transition-colors
            hover:bg-slate-100
            hover:text-slate-600
            dark:hover:bg-[#0d2336]
            dark:hover:text-slate-200
          "
          >
            <FiX className="text-base" />
          </button>
        </div>

        {/* Content */}
        <div
          className="
          pt-4
          text-xs
          text-slate-600
          dark:text-slate-300
        "
        >
          {children}
        </div>
      </div>
    </div>
  );
}