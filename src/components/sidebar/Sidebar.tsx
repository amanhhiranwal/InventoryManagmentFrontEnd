"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  LuChevronDown,
  LuChevronLeft,
  LuX,
  LuSettings,
  LuCircle,
} from "react-icons/lu";
import * as LuIcons from "react-icons/lu";
import { getSidebarMenusApi, DBMenuItem } from "@/features/menus/api/menus.api";
import { useUIStore } from "@/lib/store/ui.store";
import { useAuthStore } from "@/features/auth/store/auth.store";

function resolveIconComponent(iconName?: string) {
  if (!iconName) return LuCircle;
  const iconComp = (LuIcons as Record<string, any>)[iconName];
  return iconComp || LuCircle;
}

export default function Sidebar() {
  const {
    isSidebarOpen,
    isSidebarCollapsed,
    setSidebarOpen,
    toggleSidebarCollapsed,
  } = useUIStore();

  const pathname = usePathname();
  const [dbMenus, setDbMenus] = useState<DBMenuItem[]>([]);
  const [openMenus, setOpenMenus] = useState<string[]>(["Sales"]);
  const user = useAuthStore((state) => state.user);

  // Fetch DB-driven sidebar navigation
  const fetchDbSidebar = useCallback(async () => {
    try {
      const data = await getSidebarMenusApi();
      if (Array.isArray(data) && data.length > 0) {
        setDbMenus(data);
      }
    } catch (err) {
      console.error("Failed to fetch database sidebar menus:", err);
    }
  }, []);

  useEffect(() => {
    fetchDbSidebar();
  }, [fetchDbSidebar, user?.role_id]);

  // Close mobile sidebar on navigation change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  // Automatically expand active parent menus
  useEffect(() => {
    dbMenus.forEach((menu) => {
      if (menu.children && menu.children.some((child) => child.path && pathname === child.path)) {
        setOpenMenus((prev) => {
          if (!prev.includes(menu.title)) {
            return [...prev, menu.title];
          }
          return prev;
        });
      }
    });
  }, [pathname, dbMenus]);

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white dark:bg-[#061423] border-r border-slate-200/80 dark:border-[#0d2336]
          transition-all duration-300 ease-in-out lg:static lg:z-30 h-screen select-none
          ${isSidebarCollapsed ? "lg:w-[72px]" : "lg:w-[240px]"}
          ${isSidebarOpen ? "w-[240px] translate-x-0" : "w-[240px] -translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Brand Header */}
        <div className="flex h-20 items-center justify-between px-6 shrink-0 border-b border-transparent">
          {(!isSidebarCollapsed || isSidebarOpen) ? (
            <Link href="/dashboard" className="flex flex-col group transition-opacity">
              <div className="flex items-baseline">
                <span className="text-[26px] font-black tracking-tight text-[#16294a] dark:text-white font-sans">
                  Synergy
                </span>
                <span className="text-[12px] font-bold text-[#16294a] dark:text-white ml-0.5 relative -top-2">
                  ™
                </span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#ea580c] inline-block ml-1 relative -top-1" />
              </div>
              <span className="text-[9.5px] font-black tracking-[0.22em] text-[#ea580c] uppercase pl-7 -mt-1 font-sans">
                GLOBAL
              </span>
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#16294a] text-white font-black text-sm shadow-xs"
            >
              S<span className="text-[#ea580c]">•</span>
            </Link>
          )}

          {/* Mobile Close Button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
          >
            <LuX className="text-xl" />
          </button>

          {/* Desktop Collapse Button */}
          <button
            onClick={toggleSidebarCollapsed}
            className="hidden rounded-lg p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 lg:block cursor-pointer"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <LuChevronLeft
              className={`text-lg transition-transform duration-300 ${
                isSidebarCollapsed ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* Navigation Section (100% Database-Driven) */}
        <div className="flex-grow overflow-y-auto pt-2 pb-4 scrollbar-none">
          <nav className="space-y-1">
            {dbMenus.map((menu) => {
              const Icon = resolveIconComponent(menu.icon);
              const hasSubmenus = Array.isArray(menu.children) && menu.children.length > 0;

              if (hasSubmenus) {
                const isOpen = openMenus.includes(menu.title);
                const isChildActive = menu.children!.some((child) => child.path && pathname === child.path);

                return (
                  <div key={menu.id} className="space-y-1">
                    {/* Parent Row */}
                    <div className="relative pl-3">
                      <button
                        onClick={() => toggleMenu(menu.title)}
                        className={`
                          flex w-full items-center justify-between rounded-l-2xl py-2.5 px-4 text-left transition-all duration-150 cursor-pointer
                          ${
                            isChildActive && !isOpen
                              ? "bg-[#e8edf2] dark:bg-[#0c2136] text-[#16294a] dark:text-sky-300 font-semibold border-l-[3.5px] border-[#16294a] dark:border-sky-400 pl-[12.5px]"
                              : "text-slate-800 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/40"
                          }
                        `}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <Icon className="text-[20px] shrink-0 text-slate-800 dark:text-slate-200" />
                          {(!isSidebarCollapsed || isSidebarOpen) && (
                            <span className="text-[14.5px] font-medium text-slate-800 dark:text-slate-200 truncate">
                              {menu.title}
                            </span>
                          )}
                        </div>

                        {(!isSidebarCollapsed || isSidebarOpen) && (
                          <LuChevronDown
                            className={`text-xs text-slate-400 transition-transform duration-200 shrink-0 ml-1 ${
                              isOpen ? "rotate-180" : ""
                            }`}
                          />
                        )}
                      </button>
                    </div>

                    {/* Submenu Branch */}
                    {isOpen && (!isSidebarCollapsed || isSidebarOpen) && (
                      <div className="ml-[31px] pl-3.5 border-l border-slate-300 dark:border-slate-700/80 my-1 space-y-1">
                        {menu.children!.map((child) => {
                          const ChildIcon = resolveIconComponent(child.icon);
                          const isActive = child.path ? pathname === child.path : false;

                          return (
                            <div key={child.id} className="relative">
                              <Link
                                href={child.path || "#"}
                                className={`
                                  flex items-center gap-3 rounded-l-xl py-2 px-3 text-[13.5px] transition-colors
                                  ${
                                    isActive
                                      ? "bg-[#e8edf2] dark:bg-[#0c2136] text-[#16294a] dark:text-sky-300 font-bold border-l-[3px] border-[#16294a] dark:border-sky-400 pl-[9px]"
                                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 font-medium"
                                  }
                                `}
                              >
                                <ChildIcon className={`text-[17px] shrink-0 ${isActive ? "text-[#16294a] dark:text-sky-300" : "text-slate-600 dark:text-slate-400"}`} />
                                <span className="truncate">{child.title}</span>
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = menu.path ? pathname === menu.path : false;

              return (
                <div key={menu.id} className="relative pl-3">
                  <Link
                    href={menu.path || "#"}
                    className={`
                      flex items-center gap-3.5 rounded-l-2xl py-2.5 px-4 transition-all duration-150
                      ${
                        isActive
                          ? "bg-[#e8edf2] dark:bg-[#0c2136] text-[#16294a] dark:text-sky-300 font-semibold border-l-[3.5px] border-[#16294a] dark:border-sky-400 pl-[12.5px]"
                          : "text-slate-800 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 font-medium"
                      }
                    `}
                  >
                    <Icon
                      className={`text-[20px] shrink-0 ${
                        isActive ? "text-[#16294a] dark:text-sky-300" : "text-slate-800 dark:text-slate-200"
                      }`}
                    />
                    {(!isSidebarCollapsed || isSidebarOpen) && (
                      <span className="text-[14.5px] truncate">
                        {menu.title}
                      </span>
                    )}
                  </Link>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Footer Profile / Settings Quicklink */}
        {(!isSidebarCollapsed || isSidebarOpen) && (
          <div className="p-3 border-t border-slate-100 dark:border-[#0d2336] shrink-0">
            <Link
              href="/profile"
              className="flex items-center gap-3 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all text-xs font-medium"
            >
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-[#0d2336] text-slate-600 dark:text-slate-300">
                <LuSettings className="text-base" />
              </div>
              <div className="truncate">
                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {user?.first_name ? `${user.first_name} ${user.last_name || ""}` : "Settings"}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {user?.email || "Account & Preferences"}
                </p>
              </div>
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
