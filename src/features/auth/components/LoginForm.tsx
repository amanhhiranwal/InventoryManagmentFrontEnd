"use client";

import { useState } from "react";
import { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { loginApi, meApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";
import { CgSpinner } from "react-icons/cg";
import { FiMail, FiLock } from "react-icons/fi";

export default function LoginForm() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

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
      className="w-full space-y-6 rounded-2xl p-6 sm:p-8"
    >
      <div className="text-center">
        {/* Branding accent */}
        <div className="mx-auto mb-4 flex h-11 w-14 items-center justify-center rounded-xl bg-primary text-white font-extrabold text-xl shadow-lg">
          CRM
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">
          Welcome Back
        </h1>

        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Sign in to access your inventory management workspace
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 p-3 text-sm text-red-600 dark:text-red-400 animate-shake">
          {errorMsg}
        </div>
      )}

      <div className="space-y-4">
        {/* Email Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Email Address
          </label>

          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
              <FiMail />
            </span>
            <input
              type="email"
              required
              className="
                w-full
                rounded-xl
                border
                border-slate-200
                dark:border-[#0d2336]
                bg-slate-50/50
                dark:bg-[#071929]/50
                pl-10
                pr-4
                py-3
                text-sm
                text-slate-900
                dark:text-white
                placeholder:text-slate-400
                outline-none
                transition-all
                focus:border-primary
                focus:bg-white
                focus:ring-2
                focus:ring-primary/10
                dark:focus:border-primary-hover
                dark:focus:bg-[#071929]
                dark:focus:ring-primary/20
              "
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Password
            </label>
          </div>

          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
              <FiLock />
            </span>
            <input
              type="password"
              required
              className="
                w-full
                rounded-xl
                border
                border-slate-200
                dark:border-[#0d2336]
                bg-slate-50/50
                dark:bg-[#071929]/50
                pl-10
                pr-4
                py-3
                text-sm
                text-slate-900
                dark:text-white
                placeholder:text-slate-400
                outline-none
                transition-all
                focus:border-primary
                focus:bg-white
                focus:ring-2
                focus:ring-primary/10
                dark:focus:border-primary-hover
                dark:focus:bg-[#071929]
                dark:focus:ring-primary/20
              "
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="
          flex
          w-full
          items-center
          justify-center
          gap-2
          rounded-xl
          bg-primary
          hover:bg-primary-hover
          px-4
          py-3
          font-semibold
          text-white
          shadow-lg
          shadow-primary/15
          hover:shadow-primary/25
          transition-all
          duration-150
          disabled:cursor-not-allowed
          disabled:opacity-50
          cursor-pointer
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
