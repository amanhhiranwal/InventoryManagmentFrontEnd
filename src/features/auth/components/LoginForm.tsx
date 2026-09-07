"use client";

import { useEffect, useState } from "react";
import { AxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { loginApi, meApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import { CgSpinner } from "react-icons/cg";
import { FiMail, FiLock } from "react-icons/fi";
import AuthField from "./AuthField";

const REMEMBERED_EMAIL_KEY = "remembered-email";

export default function LoginForm() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Restore the previously remembered email address
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {}
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!email || !password) {
      setErrorMsg("Please fill in all fields.");
      return;
    }

    try {
      setLoading(true);

      const login = await loginApi(email, password);
      Cookies.set("token", login.access_token);

      const me = await meApi(login.access_token);

      const rawUser = login.user as unknown as Record<string, unknown>;
      const parsedIsSuperAdmin = !!(rawUser.is_super_admin ?? rawUser.super_admin ?? rawUser.isSuperAdmin);

      setAuth(login.access_token, {
        id: login.user.id,
        first_name: login.user.first_name,
        last_name: login.user.last_name,
        email: login.user.email,
        is_super_admin: parsedIsSuperAdmin,
        role_id: me.data.role_id,
        permissions: me.data.permissions || [],
        exp: me.data.exp,
      });

      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        } else {
          localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
      } catch {}

      router.replace("/dashboard");
    } catch (err: unknown) {
      console.error(err);
      const axiosError = err as AxiosError<{ message?: string }>;
      if (axiosError.message === "Network Error" || !axiosError.response) {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";
        setErrorMsg(
          `Connection failed. Please verify that the backend server is running at ${apiUrl} and CORS is configured correctly.`
        );
      } else {
        setErrorMsg(
          axiosError.response?.data?.message || "Invalid credentials. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="w-full space-y-6 rounded-xl border border-slate-200/70 bg-white p-8 shadow-sm sm:p-10 dark:border-[#0d2336] dark:bg-[#051422]"
    >
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-primary dark:text-white">
          Sign In To Sales CRM
        </h1>

        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Access your sales workspace &amp; manage your pipeline.
        </p>
      </div>

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
          autoComplete="email"
        />

        <div className="space-y-2">
          <AuthField
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            icon={<FiLock />}
            autoComplete="current-password"
          />

          <Link
            href="/forgot-password"
            className="inline-block text-xs text-slate-500 transition-colors hover:text-primary dark:text-slate-400 dark:hover:text-slate-200"
          >
            Forgot password?
          </Link>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-primary dark:border-[#0d2336]"
          />
          Remember me
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="
          flex
          w-full
          cursor-pointer
          items-center
          justify-center
          gap-2
          rounded-lg
          bg-primary
          px-4
          py-3
          text-sm
          font-semibold
          tracking-wide
          text-white
          uppercase
          transition-all
          duration-150
          hover:bg-primary-hover
          disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        {loading ? (
          <>
            <CgSpinner className="animate-spin text-xl" />
            <span>Signing In...</span>
          </>
        ) : (
          "Sign In"
        )}
      </button>
    </form>
  );
}
