"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiChevronDown, FiChevronLeft, FiX } from "react-icons/fi";
import { sidebarMenu } from "./sidebar-menu";
import { useUIStore } from "@/lib/store/ui.store";
import { useEffect, useState } from "react";

export default function Sidebar() {
  const {
    isSidebarOpen,
    isSidebarCollapsed,
    setSidebarOpen,
    toggleSidebarCollapsed,
  } = useUIStore();

  const pathname = usePathname();
  const [openMenus, setOpenMenus] = useState<string[]>([]);

  // Close mobile sidebar on navigation change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const isMenuChildActive = (menu: any) => {
    if (!menu.children) return pathname === menu.path;
    return menu.children.some((child: any) => pathname === child.path);
  };

  const renderNavItems = () => (
    <nav className="p-3 space-y-1.5">
      {sidebarMenu.map((menu) => {
        const Icon = menu.icon;
        const isChildActive = isMenuChildActive(menu);

        if (menu.children) {
          const isOpen = openMenus.includes(menu.title);

          return (
            <div key={menu.title} className="space-y-1">
              <button
                onClick={() => toggleMenu(menu.title)}
                className={`
                  flex w-full items-center justify-between rounded-xl p-3 text-sm font-medium transition-all duration-200 cursor-pointer
                  ${
                    isChildActive
                      ? "bg-primary-light/50 dark:bg-primary-light/5 text-primary dark:text-[#38bdf8]"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
                  }
                `}
              >
                <div className="flex items-center gap-3.5">
                  <Icon className="text-lg shrink-0" />
                  {(!isSidebarCollapsed || isSidebarOpen) && (
                    <span>{menu.title}</span>
                  )}
                </div>

                {(!isSidebarCollapsed || isSidebarOpen) && (
                  <FiChevronDown
                    className={`text-slate-400 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              {isOpen && (!isSidebarCollapsed || isSidebarOpen) && (
                <div className="ml-6 pl-3 border-l border-slate-200 dark:border-slate-800 mt-1 space-y-1 animate-fadeIn">
                  {menu.children.map((child) => {
                    const ChildIcon = child.icon;
                    const isActive = pathname === child.path;

                    return (
                      <Link
                        key={child.path}
                        href={child.path}
                        className={`
                          flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150
                          ${
                            isActive
                              ? "bg-primary text-white shadow-sm shadow-primary/20 dark:shadow-none"
                              : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
                          }
                        `}
                      >
                        <ChildIcon className="text-base shrink-0" />
                        <span>{child.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        const isActive = pathname === menu.path;

        return (
          <Link
            key={menu.path}
            href={menu.path!}
            className={`
              flex items-center gap-3.5 rounded-xl p-3 text-sm font-medium transition-all duration-200
              ${
                isActive
                  ? "bg-primary text-white shadow-md shadow-primary/10 dark:shadow-none"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
              }
            `}
          >
            <Icon className="text-lg shrink-0" />
            {(!isSidebarCollapsed || isSidebarOpen) && <span>{menu.title}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`
          fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white dark:bg-[#051422] border-r border-slate-200 dark:border-[#0d2336]
          transition-all duration-300 ease-in-out lg:static lg:z-30 h-screen
          ${isSidebarCollapsed ? "lg:w-20" : "lg:w-64"}
          ${isSidebarOpen ? "w-64 translate-x-0" : "w-64 -translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between px-5 border-b border-slate-100 dark:border-[#0d2336] shrink-0">
          {(!isSidebarCollapsed || isSidebarOpen) && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-lg shadow-sm">
                R
              </div>
              <span className="font-bold text-slate-800 dark:text-white tracking-wide text-base">
                RBAC System
              </span>
            </div>
          )}

          {isSidebarCollapsed && !isSidebarOpen && (
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white font-bold text-lg shadow-sm">
              R
            </div>
          )}

          {/* Toggle buttons */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
          >
            <FiX className="text-xl" />
          </button>

          <button
            onClick={toggleSidebarCollapsed}
            className="hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:block cursor-pointer"
          >
            <FiChevronLeft
              className={`text-xl transition-transform duration-300 ${
                isSidebarCollapsed ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-grow overflow-y-auto mt-2">
          {renderNavItems()}
        </div>

        {/* Footer info/tag */}
        {(!isSidebarCollapsed || isSidebarOpen) && (
          <div className="p-4 border-t border-slate-100 dark:border-[#0d2336] text-center shrink-0">
            <p className="text-[10px] font-medium text-slate-400 tracking-wider uppercase">
              V1.0.0
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
