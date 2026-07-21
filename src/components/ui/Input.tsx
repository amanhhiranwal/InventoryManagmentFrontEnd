import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  containerClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, containerClassName = "", className = "", ...props }, ref) => {
    return (
      <div className={`flex flex-col gap-1.5 w-full ${containerClassName}`}>
        {label && (
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full rounded-lg border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#071929]/50 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10 transition-all ${
            error ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500/10" : ""
          } ${className}`}
          {...props}
        />
        {error && (
          <span className="text-[10px] text-rose-500 font-medium animate-pulse">
            {error}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
