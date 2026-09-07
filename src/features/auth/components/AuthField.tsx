"use client";

import { ReactNode, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

interface AuthFieldProps {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon: ReactNode;
  autoComplete?: string;
  required?: boolean;
  readOnly?: boolean;
}

/**
 * Labelled input used across the auth screens. Password fields get a
 * show/hide toggle on the right edge.
 */
export default function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  icon,
  autoComplete,
  required = true,
  readOnly = false,
}: AuthFieldProps) {
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === "password";
  const inputType = isPassword && revealed ? "text" : type;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[13px] text-slate-600 dark:text-slate-300"
      >
        {label}
      </label>

      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
          {icon}
        </span>

        <input
          id={id}
          name={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          readOnly={readOnly}
          className={`
            w-full
            rounded-lg
            border
            border-slate-200
            bg-white
            py-2.5
            pl-10
            ${isPassword ? "pr-11" : "pr-4"}
            text-sm
            text-slate-900
            outline-none
            transition-all
            placeholder:text-slate-400
            focus:border-primary
            focus:ring-2
            focus:ring-primary/10
            read-only:bg-slate-50
            dark:border-[#0d2336]
            dark:bg-[#071929]
            dark:text-white
            dark:focus:border-primary-hover
            dark:focus:ring-primary/20
            dark:read-only:bg-[#051422]
          `}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((prev) => !prev)}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3.5 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
          >
            {revealed ? <FiEye /> : <FiEyeOff />}
          </button>
        )}
      </div>
    </div>
  );
}
