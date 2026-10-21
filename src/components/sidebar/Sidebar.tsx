"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  LuChevronDown,
  LuChevronLeft,
  LuX,
  LuCircle,
} from "react-icons/lu";
import * as LuIcons from "react-icons/lu";
import { getSidebarMenusApi, DBMenuItem } from "@/features/menus/api/menus.api";
import { useUIStore } from "@/lib/store/ui.store";
import { useAuthStore } from "@/features/auth/store/auth.store";

/**
 * Icons that are not a plain lucide export.
 *
 * lucide's Quote glyph has its bowl at the top with the tail sweeping down,
 * which reads as a closing quote (99). The design uses an opening quote
 * (66) - the same glyph turned through 180 degrees.
 */
const ICON_OVERRIDES: Record<string, (props: any) => any> = {
  /* The dashboard's four blocks fill in on the page they belong to and
     stay outlines everywhere else.

     Solid all the time, the blocks are four dark squares next to seven
     thin outlines, and that weight alone reads as the selected row even
     from another page - which is what the design reserves for the page
     you are on. So the row passes data-active, and only then are the
     squares filled; the colour still comes from the row's own class. */
  LuLayoutGrid: ({ className, style, size, ...rest }: any) => {
    const active = rest["data-active"] === "true" || rest["data-active"] === true;

    return (
      <svg
        {...rest}
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke={active ? "none" : "currentColor"}
        strokeWidth="1.8"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
        style={{ width: size ?? "1em", height: size ?? "1em", ...style }}
      >
        <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
      </svg>
    );
  },

  /* Sales is a megaphone in the menu table and a person over a rising
     chart in the design. The menu row keeps its stored name - the shape
     is swapped here, so nothing has to be migrated.

     Same rule as the dashboard's blocks: the head fills in on the
     section you are in and is an outline everywhere else. */
  LuMegaphone: ({ className, style, size, ...rest }: any) => {
    const active = rest["data-active"] === "true" || rest["data-active"] === true;

    return (
      <svg
        {...rest}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
        style={{ width: size ?? "1em", height: size ?? "1em", ...style }}
      >
        <circle
          cx="9.5"
          cy="6.8"
          r={active ? 4.4 : 3.6}
          fill={active ? "currentColor" : "none"}
          stroke={active ? "none" : "currentColor"}
        />
        <path d="M2.8 18.2 8.4 13l3.6 3.4 7-6.2" />
        <path d="M15.3 10.2H19v3.7" />
      </svg>
    );
  },

  LuQuoteOpen: ({ style, ...props }: any) => (
    /* Rotated inline rather than with a utility class so it cannot be
       dropped by the CSS scanner, and so the caller's own className
       (sizing, colour) is left intact. */
    <LuIcons.LuQuote
      {...props}
      style={{ ...style, transform: "rotate(180deg)" }}
    />
  ),
};

function resolveIconComponent(iconName?: string) {
  if (!iconName) return LuCircle;
  if (iconName in ICON_OVERRIDES) return ICON_OVERRIDES[iconName];
  const iconComp = (LuIcons as Record<string, any>)[iconName];
  return iconComp || LuCircle;
}

export default function Sidebar() {
  const {
    isSidebarOpen,
    isSidebarCollapsed,
    isFormFocus,
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

  /* Create / edit forms use the full width, as in the design. */
  if (isFormFocus) return null;

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
          ${isSidebarCollapsed ? "lg:w-[72px]" : "lg:w-[197px]"}
          ${isSidebarOpen ? "w-[197px] translate-x-0" : "w-[197px] -translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Brand Header */}
        <div className="flex h-20 items-center justify-between px-5 shrink-0 border-b border-transparent">
          {(!isSidebarCollapsed || isSidebarOpen) ? (
            <Link href="/dashboard" aria-label="Synergy Global home" className="block shrink-0">
              {/* The design's logo artwork: navy wordmark on light, white on dark. */}
              <Image
                src="/logo-light.png"
                alt="Synergy Global"
                width={119}
                height={33}
                priority
                className="h-[33px] w-[119px] object-contain dark:hidden"
              />
              <Image
                src="/logo-dark.png"
                alt="Synergy Global"
                width={119}
                height={33}
                priority
                className="hidden h-[33px] w-[119px] object-contain dark:block"
              />
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
          <nav className="space-y-0.5">
            {dbMenus.map((menu) => {
              const Icon = resolveIconComponent(menu.icon);
              const hasSubmenus = Array.isArray(menu.children) && menu.children.length > 0;

              if (hasSubmenus) {
                const isOpen = openMenus.includes(menu.title);
                const isChildActive = menu.children!.some((child) => child.path && pathname === child.path);

                return (
                  <div key={menu.id} className="space-y-0.5">
                    {/* Parent Row */}
                    <div className="relative pl-2">
                      {isChildActive && !isOpen && (
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-y-0 right-0 w-[3px] bg-[#16294a] dark:bg-sky-400"
                        />
                      )}

                      <button
                        onClick={() => toggleMenu(menu.title)}
                        className={`
                          flex w-full items-center justify-between py-2 px-3 text-left transition-all duration-150 cursor-pointer
                          ${
                            isChildActive
                              ? `text-[#16294a] dark:text-sky-300 font-semibold${
                                  isOpen
                                    ? " rounded-xl"
                                    : " rounded-l-xl bg-[#e8edf2] dark:bg-[#0c2136]"
                                }`
                              : "rounded-xl text-slate-800 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/40"
                          }
                        `}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* The group follows the page you are on: navy with
                              the icon filled in while one of its pages is
                              open, slate otherwise. Opened, it leaves the
                              grey pill to the child that is actually
                              current and keeps only the colour. */}
                          <Icon
                            data-active={isChildActive ? "true" : undefined}
                            className={`text-[17px] shrink-0 ${
                              isChildActive
                                ? "text-[#16294a] dark:text-sky-300"
                                : "text-slate-800 dark:text-slate-200"
                            }`}
                          />
                          {(!isSidebarCollapsed || isSidebarOpen) && (
                            <span
                              className={`text-[13.5px] truncate ${
                                isChildActive
                                  ? "font-semibold text-[#16294a] dark:text-sky-300"
                                  : "font-medium text-slate-800 dark:text-slate-200"
                              }`}
                            >
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
                      <div className="ml-[25px] pl-2 border-l border-slate-300 dark:border-slate-700/80 my-1 space-y-0.5">
                        {menu.children!.map((child) => {
                          const ChildIcon = resolveIconComponent(child.icon);
                          const isActive = child.path ? pathname === child.path : false;

                          return (
                            <div key={child.id} className="relative">
                              {isActive && (
                                <span
                                  aria-hidden
                                  className="pointer-events-none absolute inset-y-0 right-0 w-[3px] bg-[#16294a] dark:bg-sky-400"
                                />
                              )}

                              <Link
                                href={child.path || "#"}
                                className={`
                                  flex items-center gap-2 py-1.5 px-2 text-[13px] transition-colors
                                  ${
                                    isActive
                                      ? "rounded-l-lg bg-[#e8edf2] dark:bg-[#0c2136] text-[#16294a] dark:text-sky-300 font-bold"
                                      : "rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 font-medium"
                                  }
                                `}
                              >
                                <ChildIcon className={`text-[15px] shrink-0 ${isActive ? "text-[#16294a] dark:text-sky-300" : "text-slate-600 dark:text-slate-400"}`} />
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
                <div key={menu.id} className="relative pl-2">
                  {isActive && (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-y-0 right-0 w-[3px] bg-[#16294a] dark:bg-sky-400"
                    />
                  )}
                  <Link
                    href={menu.path || "#"}
                    className={`
                      flex items-center gap-2 py-2 px-3 transition-all duration-150
                      ${
                        isActive
                          ? "rounded-l-xl bg-[#e8edf2] dark:bg-[#0c2136] text-[#16294a] dark:text-sky-300 font-semibold"
                          : "rounded-xl text-slate-800 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 font-medium"
                      }
                    `}
                  >
                    <Icon
                      data-active={isActive ? "true" : undefined}
                      className={`text-[17px] shrink-0 ${
                        isActive ? "text-[#16294a] dark:text-sky-300" : "text-slate-800 dark:text-slate-200"
                      }`}
                    />
                    {(!isSidebarCollapsed || isSidebarOpen) && (
                      <span className="text-[13.5px] truncate">
                        {menu.title}
                      </span>
                    )}
                  </Link>
                </div>
              );
            })}
          </nav>
        </div>

        {/* The profile card that used to sit here was a second way into
            /profile, under the account menu in the top bar that already
            goes there and carries the same name and address. */}
      </aside>
    </>
  );
}