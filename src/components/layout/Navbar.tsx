"use client";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { useUIStore } from "@/lib/store/ui.store";
import { IoMdLogOut } from "react-icons/io";
import { CgProfile } from "react-icons/cg";
import { FiSun, FiMoon, FiMenu } from "react-icons/fi";
import Link from "next/link";

export default function Navbar() {
  const user = useAuthStore((state) => state.user);
  const { logout } = useLogout();
  const { theme, toggleTheme, toggleSidebarOpen } = useUIStore();

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 dark:border-[#0d2336] bg-white/80 dark:bg-[#051422]/80 px-6 backdrop-blur-md transition-colors duration-300">
      <div className="flex items-center gap-4">
        {/* Mobile Hamburger Menu */}
        <button
          onClick={toggleSidebarOpen}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
          aria-label="Toggle Sidebar"
        >
          <FiMenu className="text-xl" />
        </button>

        <div>
          <h1 className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
            Dashboard
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Theme Switcher Button */}
        <button
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 dark:border-[#0d2336] text-slate-500 hover:bg-slate-100 dark:hover:bg-[#0d2336] transition-all cursor-pointer"
          aria-label="Toggle Theme"
        >
          {theme === "light" ? (
            <FiMoon className="text-lg text-slate-600" />
          ) : (
            <FiSun className="text-lg text-amber-400" />
          )}
        </button>

        {/* Profile Dropdown */}
        <div className="relative group">
          {/* Profile Trigger */}
          <div className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 dark:border-[#0d2336] px-3.5 py-1.5 hover:bg-slate-50 dark:hover:bg-[#0d2336] transition-all">
            <CgProfile className="text-xl text-slate-500 dark:text-slate-300" />
            <div className="hidden text-left md:block">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {user?.first_name || "User"}
              </p>
              <p className="text-[10px] text-slate-400">Account</p>
            </div>
          </div>

          {/* Dropdown menu */}
          <div
            className="
              absolute right-0 top-full pt-2 z-50 
              hidden group-hover:block w-48
            "
          >
            <div className="rounded-xl border border-slate-200 dark:border-[#0d2336] bg-white dark:bg-[#051422] p-1.5 shadow-xl">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-[#0d2336]">
                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user?.email}
                </p>
              </div>
              <ul className="space-y-0.5 mt-1.5">
                <li>
                  <Link
                    href="/profile"
                    className="
                      flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-600 dark:text-slate-300
                      hover:bg-slate-100 dark:hover:bg-[#0d2336] hover:text-slate-900 dark:hover:text-white transition-all
                    "
                  >
                    <CgProfile className="text-lg" />
                    <span>Profile</span>
                  </Link>
                </li>

                <li>
                  <button
                    onClick={logout}
                    className="
                      flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-600 dark:text-red-400
                      hover:bg-red-50 dark:hover:bg-red-950/20 text-left transition-all cursor-pointer
                    "
                  >
                    <IoMdLogOut className="text-lg" />
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