"use client";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { useUIStore } from "@/lib/store/ui.store";
import { IoMdLogOut } from "react-icons/io";
import { CgProfile } from "react-icons/cg";
import {
  FiSun,
  FiMoon,
  FiMenu,
  FiRefreshCw,
  FiBell,
  FiChevronDown,
  FiBriefcase
} from "react-icons/fi";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import api from "@/lib/axios";

export default function Navbar() {
  const user = useAuthStore((state) => state.user);
  const { logout } = useLogout();
  const { theme, toggleTheme, toggleSidebarOpen } = useUIStore();
  const pathname = usePathname();
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (user && user.avatar_url === undefined) {
      api.get("/api/v1/profile/").then((res) => {
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          useAuthStore.setState({
            user: {
              ...currentUser,
              avatar_url: res.data?.data?.avatar_url || null
            }
          });
        }
      }).catch(() => {});
    }
  }, [user]);

  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname.startsWith("/sales/customers")) return "Customers";
    if (pathname.startsWith("/leads")) return "Sales / Leads";
    if (pathname.startsWith("/sales/opportunities")) return "Sales / Opportunities";
    if (pathname.startsWith("/sales/orders")) return "Sales Orders";
    if (pathname.startsWith("/inventory")) return "Inventory";
    if (pathname.startsWith("/users")) return "Users & Access";
    if (pathname.startsWith("/rbac")) return "Roles & Permissions";
    if (pathname.startsWith("/workflows")) return "Workflows";
    if (pathname.startsWith("/profile")) return "User Profile";
    return "Enterprise Suite";
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200/80 dark:border-[#0d2336] bg-white dark:bg-[#051422] px-6 transition-colors duration-200 select-none">
      {/* Left: Mobile hamburger + Page Title + Refresh button */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebarOpen}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
          aria-label="Toggle Sidebar"
        >
          <FiMenu className="text-lg" />
        </button>

        <div className="flex items-center gap-2">
          <h1 className="text-base sm:text-lg font-bold text-slate-800 dark:text-white tracking-tight">
            {getPageTitle()}
          </h1>

          <button
            onClick={handleRefresh}
            title="Refresh current dataset"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#071929] transition-all cursor-pointer"
          >
            <FiRefreshCw className={`text-xs ${isRefreshing ? "animate-spin text-[#233353] dark:text-sky-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Right: Company selector, Notification Bell, Theme Switcher, User Avatar */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Organization / Company Selector (Figma: Qonevo Technologies) */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#0d2336] bg-slate-50/60 dark:bg-[#071929]/50 text-xs font-semibold text-slate-700 dark:text-slate-200">
          <FiBriefcase className="text-primary dark:text-sky-400 text-xs" />
          <span>Enterprise Workspace</span>
          <FiChevronDown className="text-slate-400 text-xs" />
        </div>

        {/* Notifications Bell with unread dot */}
        <button
          className="relative p-2 rounded-xl border border-slate-200 dark:border-[#0d2336] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#071929] transition-all cursor-pointer"
          title="Notifications"
        >
          <FiBell className="text-base" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#fb3748] ring-2 ring-white dark:ring-[#051422]" />
        </button>

        {/* Theme Switcher */}
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-[#0d2336] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#071929] transition-all cursor-pointer"
          aria-label="Toggle Theme"
        >
          {theme === "light" ? (
            <FiMoon className="text-sm text-slate-600" />
          ) : (
            <FiSun className="text-sm text-amber-400" />
          )}
        </button>

        {/* User Profile Avatar with Dropdown */}
        <div className="relative group">
          <div className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200 dark:border-[#0d2336] p-1.5 hover:bg-slate-50 dark:hover:bg-[#071929] transition-all">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="Profile Avatar"
                className="w-7 h-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-xs"
              />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-[#233353] text-white flex items-center justify-center text-xs font-bold font-mono shadow-sm">
                {user?.first_name ? user.first_name[0].toUpperCase() : "U"}
              </div>
            )}
            <div className="hidden text-left sm:block pr-1">
              <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                {user?.first_name || "User"}
              </p>
              <p className="text-[10px] text-slate-400 leading-tight">
                {user?.is_super_admin ? "Super Admin" : "Sales Team"}
              </p>
            </div>
            <FiChevronDown className="text-slate-400 text-xs hidden sm:block" />
          </div>

          {/* Dropdown menu */}
          <div className="absolute right-0 top-full pt-2 z-50 hidden group-hover:block w-56 animate-fadeIn">
            <div className="rounded-xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-1.5 shadow-xl">
              <div className="flex items-center gap-2.5 px-3 py-2 border-b border-slate-100 dark:border-[#0d2336]">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="User Avatar"
                    className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-[#233353] text-white flex items-center justify-center text-xs font-bold font-mono shrink-0">
                    {user?.first_name ? user.first_name[0].toUpperCase() : "U"}
                  </div>
                )}
                <div className="truncate">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {user?.email}
                  </p>
                </div>
              </div>
              <ul className="space-y-0.5 mt-1.5">
                <li>
                  <Link
                    href="/profile"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0d2336] transition-all"
                  >
                    <CgProfile className="text-base" />
                    <span>My Profile</span>
                  </Link>
                </li>
                <li>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-[#fb3748] hover:bg-rose-50 dark:hover:bg-rose-950/20 text-left transition-all cursor-pointer"
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