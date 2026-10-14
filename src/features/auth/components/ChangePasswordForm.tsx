"use client";

/* Choosing your own password, the first time you sign in.
 *
 * The password that got somebody here arrived by email - it has been
 * through a mail server and sat in an inbox - so the server refuses
 * every other request until this is done. That makes the screen a gate
 * rather than a prompt: there is nowhere else to go from here.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiLock } from "react-icons/fi";

import AuthField from "@/features/auth/components/AuthField";
import PasswordRules from "@/features/auth/components/PasswordRules";
import { passwordProblem } from "@/features/auth/utils/passwordRules";
import api from "@/lib/axios";
import { useUIStore } from "@/lib/store/ui.store";

export default function ChangePasswordForm() {
  const router = useRouter();
  const { addToast } = useUIStore();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const problem = passwordProblem(next);

    if (problem) {
      setError(problem);
      return;
    }

    if (next !== again) {
      setError("Those two do not match.");
      return;
    }

    setSaving(true);

    try {
      await api.post("/api/v1/auth/change-password", {
        current_password: current,
        new_password: next,
      });

      addToast("Password changed. That is the one to use from now on.", "success");
      router.replace("/dashboard");
    } catch (caught) {
      setError(
        (caught as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "That password could not be changed.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      autoComplete="off"
      className="w-full space-y-5 rounded-xl border border-slate-200/70 bg-white p-8 shadow-sm sm:p-10 dark:border-[#0d2336] dark:bg-[#051422]"
    >
      <div className="space-y-1.5">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Choose your password
        </h1>
        <p className="text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
          The one you signed in with was emailed to you and is temporary.
          Pick your own to carry on.
        </p>
      </div>

      <AuthField
        id="current_password"
        label="Temporary password"
        type="password"
        icon={<FiLock size={15} />}
        autoComplete="current-password"
        value={current}
        onChange={setCurrent}
        placeholder="The one from the email"
      />

      <AuthField
        id="new_password"
        label="New password"
        type="password"
        icon={<FiLock size={15} />}
        autoComplete="new-password"
        value={next}
        onChange={setNext}
        placeholder="At least 8 characters"
      />

      {/* The rules, ticked off as they are met. Shown from the first
          keystroke here, because this screen is a gate: there is nothing
          else to do until a password gets past it. */}
      <PasswordRules password={next} className="-mt-2" />

      <AuthField
        id="confirm_password"
        label="New password again"
        type="password"
        icon={<FiLock size={15} />}
        autoComplete="new-password"
        value={again}
        onChange={setAgain}
        placeholder="The same one"
      />

      {error && (
        <p className="text-[13px] font-medium text-rose-500">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="h-11 w-full cursor-pointer rounded-lg bg-[#233353] text-[13px] font-semibold text-white transition hover:bg-[#18243a] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save and continue"}
      </button>
    </form>
  );
}
