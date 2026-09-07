"use client";

import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CgSpinner } from "react-icons/cg";
import { FiCheck, FiLock, FiMail } from "react-icons/fi";
import { resetPasswordApi } from "../api/auth.api";
import AuthField from "./AuthField";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordForm() {
  const searchParams = useSearchParams();

  const token = searchParams.get("token") || "";
  const emailFromLink = searchParams.get("email") || "";

  const [email, setEmail] = useState(emailFromLink);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [done, setDone] = useState(false);

  // The email arrives in the reset link, so keep it in sync once mounted.
  useEffect(() => {
    if (emailFromLink) {
      setEmail(emailFromLink);
    }
  }, [emailFromLink]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!token) {
      setErrorMsg(
        "This reset link is invalid or incomplete. Please request a new one."
      );
      return;
    }

    if (!password || !confirmPassword) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMsg(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await resetPasswordApi(token, password, email.trim() || undefined);

      setDone(true);
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ detail?: string; message?: string }>;

      if (axiosError.message === "Network Error" || !axiosError.response) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";
        setErrorMsg(
          `Connection failed. Please verify that the backend server is running at ${apiUrl}.`
        );
      } else {
        setErrorMsg(
          axiosError.response?.data?.detail ||
            axiosError.response?.data?.message ||
            "Could not reset your password. Please request a new link."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="w-full space-y-6 rounded-xl border border-slate-200/70 bg-white p-8 text-center shadow-sm sm:p-10 dark:border-[#0d2336] dark:bg-[#051422]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#22c55e]">
          <FiCheck className="text-4xl text-white" strokeWidth={3} />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-primary dark:text-white">
            Password Reset Successful
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your password has been updated. You can now sign in with your new
            password.
          </p>
        </div>

        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-primary-hover"
        >
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="w-full space-y-6 rounded-xl border border-slate-200/70 bg-white p-8 shadow-sm sm:p-10 dark:border-[#0d2336] dark:bg-[#051422]"
    >
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-primary dark:text-white">
          Reset Your Password
        </h1>

        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Enter a new password for your account.
        </p>
      </div>

      {!token && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-400">
          This page needs a valid reset link.{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            Request a new one
          </Link>
          .
        </div>
      )}

      {errorMsg && (
        <div className="animate-shake rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {errorMsg}
        </div>
      )}

      <div className="space-y-4">
        <AuthField
          id="email"
          label="Work Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="name@company.com"
          icon={<FiMail />}
          autoComplete="username"
          readOnly={!!emailFromLink}
        />

        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          icon={<FiLock />}
          autoComplete="new-password"
        />

        <AuthField
          id="confirmPassword"
          label="Confirm Password"
          type="password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="••••••••"
          icon={<FiLock />}
          autoComplete="new-password"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !token}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <CgSpinner className="animate-spin text-xl" />
            <span>Resetting...</span>
          </>
        ) : (
          "Reset Password"
        )}
      </button>
    </form>
  );
}
