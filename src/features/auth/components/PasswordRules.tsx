"use client";

import { FiCheck, FiX } from "react-icons/fi";
import { passwordRules } from "@/features/auth/utils/passwordRules";

/** The checklist beside a password field: every rule, ticked as it is met.
 *
 * Shown rather than only enforced, because "that password was refused" on
 * its own sends somebody guessing - and the one rule people never guess
 * is the one about spaces.
 */
export default function PasswordRules({
  password,
  className = "",
}: {
  password: string;
  className?: string;
}) {
  const rules = passwordRules(password);

  return (
    <ul className={`grid gap-1 sm:grid-cols-2 ${className}`}>
      {rules.map((rule) => (
        <li
          key={rule.label}
          className={`flex items-center gap-1.5 text-[11px] transition-colors ${
            rule.met
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-slate-400 dark:text-slate-500"
          }`}
        >
          {rule.met ? (
            <FiCheck size={11} className="shrink-0" />
          ) : (
            <FiX size={11} className="shrink-0" />
          )}
          {rule.label}
        </li>
      ))}
    </ul>
  );
}
