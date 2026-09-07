"use client";

import { useState } from "react";
import { AxiosError } from "axios";
import Link from "next/link";
import { CgSpinner } from "react-icons/cg";
import { FiMail } from "react-icons/fi";
import { forgotPasswordApi } from "../api/auth.api";
import AuthField from "./AuthField";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [sent, setSent] = useState(false);
  const [devResetLink, setDevResetLink] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email) {
      setErrorMsg("Please enter your work email.");
      return;
    }

    try {
      setLoading(true);

      const response = await forgotPasswordApi(email.trim());

      setDevResetLink(response.reset_link || "");
      setSent(true);
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
            "Could not send the reset link. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="w-full space-y-6 rounded-xl border border-slate-200/70 bg-white p-8 text-center shadow-sm sm:p-10 dark:border-[#0d2336] dark:bg-[#051422]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <FiMail className="text-2xl text-success" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight text-primary dark:text-white">
            Check Your Email
          </h1>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            If an account exists for <span className="font-medium">{email}</span>,
            we&apos;ve sent a link to reset your password. The link expires shortly,
            so use it soon.
          </p>
        </div>

        {devResetLink && (
          <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left dark:border-amber-900/50 dark:bg-amber-950/20">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Development mode &mdash; email is not configured, so the link is shown here:
            </p>
            <Link
              href={devResetLink.replace(/^https?:\/\/[^/]+/, "")}
              className="block text-xs break-all text-amber-800 underline dark:text-amber-300"
            >
              {devResetLink}
            </Link>
          </div>
        )}

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
          Forgot Your Password?
        </h1>

        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Enter your email address and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>

      {errorMsg && (
        <div className="animate-shake rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-400">
          {errorMsg}
        </div>
      )}

      <AuthField
        id="email"
        label="Work Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="name@company.com"
        icon={<FiMail />}
        autoComplete="email"
      />

      <button
        type="submit"
        disabled={loading}
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition-all duration-150 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? (
          <>
            <CgSpinner className="animate-spin text-xl" />
            <span>Sending...</span>
          </>
        ) : (
          "Send Reset Link"
        )}
      </button>
    </form>
  );
}
