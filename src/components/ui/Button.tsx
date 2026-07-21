import { ButtonHTMLAttributes, ReactNode } from "react";
import { CgSpinner } from "react-icons/cg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "success" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const baseStyle = "flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover shadow-sm hover:shadow active:scale-[0.98]",
    secondary: "bg-slate-100 dark:bg-[#0d2336] text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#0d2336]/80 active:scale-[0.98]",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm active:scale-[0.98]",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm active:scale-[0.98]",
    outline: "border border-slate-200 dark:border-[#0d2336] bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#071929]/20 active:scale-[0.98]",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <CgSpinner className="animate-spin text-lg shrink-0" />
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
