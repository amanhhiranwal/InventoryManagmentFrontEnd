"use client";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { useUIStore } from "@/lib/store/ui.store";

import { IoMdLogOut } from "react-icons/io";
import { CgProfile } from "react-icons/cg";
import { FaCaretDown } from "react-icons/fa";
import { FiSun, FiMoon, FiMenu } from "react-icons/fi";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/axios";
import NotificationBell from "@/components/layout/NotificationBell";
import { getCompanyProfileApi } from "@/features/proformaInvoices/api/proformaInvoices.api";

export default function Navbar() {
  const user = useAuthStore((state) => state.user);

  const { logout } = useLogout();

  const {
    theme,
    toggleTheme,
    toggleSidebarOpen,
  } = useUIStore();

  /* The seller's legal name (COMPANY_LEGAL_NAME in the backend .env) and the
     user's role, shown beside the bell as in the design. */
  const [companyName, setCompanyName] = useState("Enterprise Workspace");
  const [roleName, setRoleName] = useState<string | null>(null);

  useEffect(() => {
    getCompanyProfileApi()
      .then((profile) => {
        if (profile?.legal_name) setCompanyName(profile.legal_name);
      })
      .catch(() => {});

    api
      .get("/api/v1/profile/")
      .then((res) => {
        const roles = res.data?.data?.roles;
        if (Array.isArray(roles) && roles.length) setRoleName(String(roles[0]));
      })
      .catch(() => {});
  }, []);

  const fullName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() || "User";

  // --------------------------------------------------
  // Load profile avatar
  // --------------------------------------------------

  useEffect(() => {
    if (user && user.avatar_url === undefined) {
      api
        .get("/api/v1/profile/")
        .then((res) => {
          const currentUser = useAuthStore.getState().user;

          if (currentUser) {
            useAuthStore.setState({
              user: {
                ...currentUser,
                avatar_url: res.data?.data?.avatar_url || null,
              },
            });
          }
        })
        .catch(() => {});
    }
  }, [user]);

  return (
    <header
      className="
        sticky top-0 z-40
        flex h-[60px] w-full shrink-0
        items-center justify-between
        dark:border-b dark:border-[#0d2336]
        bg-white dark:bg-[#051422]
        px-6
        transition-colors duration-200
        select-none
      "
    >
      {/* ============================================================
          LEFT
          Only mobile sidebar button.

          IMPORTANT:
          Page title + page refresh are NOT handled here.
          Each page owns its own header.
      ============================================================ */}

      <div className="flex items-center">
        <button
          type="button"
          onClick={toggleSidebarOpen}
          className="
            rounded-lg p-2
            text-slate-500
            hover:bg-slate-100
            dark:hover:bg-slate-800
            lg:hidden
            cursor-pointer
          "
          aria-label="Toggle Sidebar"
        >
          <FiMenu className="text-lg" />
        </button>
      </div>

      {/* ============================================================
          RIGHT
      ============================================================ */}

      <div className="flex items-center gap-3 sm:gap-5">
        {/* Company - the seller this workspace invoices as. */}
        <div
          className="hidden h-[31px] items-center gap-2 rounded-md border border-[#c4c4c4] bg-white px-2.5 text-[13px] font-medium text-[#141414] md:flex dark:border-[#17304a] dark:bg-[#071929] dark:text-slate-200"
          title="Workspace"
        >
          <span className="max-w-[220px] truncate">{companyName}</span>
          <FaCaretDown size={12} />
        </div>

        <NotificationBell />

        {/* Day / night */}
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#141414] transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#0b2034]"
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          {theme === "light" ? (
            <FiMoon size={18} />
          ) : (
            <FiSun size={18} className="text-amber-400" />
          )}
        </button>

        {/* User */}
        <div className="relative group">
          <div className="flex cursor-pointer items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition hover:bg-slate-50 dark:hover:bg-[#0b2034]">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="Profile Avatar"
                className="h-[27px] w-[27px] rounded-md object-cover"
              />
            ) : (
              <div className="flex h-[27px] w-[27px] items-center justify-center rounded-md bg-[#233353] text-xs font-bold text-white">
                {user?.first_name ? user.first_name[0].toUpperCase() : "U"}
              </div>
            )}

            <div className="hidden text-left leading-tight sm:block">
              <p className="text-[12px] font-semibold text-[#141414] dark:text-white">
                {fullName}
              </p>
              <p className="text-[10px] text-[#141414] dark:text-slate-400">
                {roleName || (user?.is_super_admin ? "Super Admin" : "Sales Team")}
              </p>
            </div>
          </div>

          {/* --------------------------------------------------------
              Profile Dropdown
          -------------------------------------------------------- */}

          <div
            className="
              absolute
              right-0
              top-full
              pt-2
              z-50
              hidden
              group-hover:block
              w-56
              animate-fadeIn
            "
          >
            <div
              className="
                rounded-xl
                border border-slate-200
                dark:border-[#0d2336]
                bg-white
                dark:bg-[#051422]
                p-1.5
                shadow-xl
              "
            >
              {/* Profile information */}

              <div
                className="
                  flex
                  items-center
                  gap-2.5
                  px-3 py-2
                  border-b
                  border-slate-100
                  dark:border-[#0d2336]
                "
              >
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="User Avatar"
                    className="
                      w-8 h-8
                      rounded-lg
                      object-cover
                      border border-slate-200
                      dark:border-slate-700
                      shrink-0
                    "
                  />
                ) : (
                  <div
                    className="
                      w-8 h-8
                      rounded-lg
                      bg-[#233353]
                      text-white
                      flex
                      items-center
                      justify-center
                      text-xs
                      font-bold
                      font-mono
                      shrink-0
                    "
                  >
                    {user?.first_name
                      ? user.first_name[0].toUpperCase()
                      : "U"}
                  </div>
                )}

                <div className="truncate">
                  <p
                    className="
                      text-xs
                      font-bold
                      text-slate-800
                      dark:text-white
                      truncate
                    "
                  >
                    {user?.first_name} {user?.last_name}
                  </p>

                  <p
                    className="
                      text-[10px]
                      text-slate-400
                      truncate
                    "
                  >
                    {user?.email}
                  </p>
                </div>
              </div>

              {/* Menu */}

              <ul className="space-y-0.5 mt-1.5">
                <li>
                  <Link
                    href="/profile"
                    className="
                      flex
                      items-center
                      gap-2.5
                      rounded-lg
                      px-3 py-2
                      text-xs
                      font-medium
                      text-slate-700
                      dark:text-slate-300
                      hover:bg-slate-100
                      dark:hover:bg-[#0d2336]
                      transition-all
                    "
                  >
                    <CgProfile className="text-base" />

                    <span>My Profile</span>
                  </Link>
                </li>

                <li>
                  <button
                    type="button"
                    onClick={logout}
                    className="
                      flex
                      w-full
                      items-center
                      gap-2.5
                      rounded-lg
                      px-3 py-2
                      text-xs
                      font-medium
                      text-[#fb3748]
                      hover:bg-rose-50
                      dark:hover:bg-rose-950/20
                      text-left
                      transition-all
                      cursor-pointer
                    "
                  >
                    <IoMdLogOut className="text-base" />

                    <span>Logout</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}