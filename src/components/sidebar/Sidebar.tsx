"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiChevronDown, FiChevronLeft } from "react-icons/fi";
import { sidebarMenu } from "./sidebar-menu";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  const [openMenus, setOpenMenus] = useState<string[]>([]);

  const pathname = usePathname();

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title],
    );
  };

  return (
    <aside
      className={`
        min-h-screen border-r bg-black
        transition-all duration-300
        ${collapsed ? "w-20" : "w-64"}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b">
        {!collapsed && <h2 className="font-bold">RBAC</h2>}

        <button onClick={() => setCollapsed(!collapsed)} className="text-xl">
          <FiChevronLeft className={collapsed ? "rotate-180" : ""} />
        </button>
      </div>

      {/* Menu */}

      <nav className="p-3">
        {sidebarMenu.map((menu) => {
          const Icon = menu.icon;

          if (menu.children) {
            const isOpen = openMenus.includes(menu.title);

            return (
              <div key={menu.title}>
                <button
                  onClick={() => toggleMenu(menu.title)}
                  className="
                    flex w-full items-center
                    justify-between
                    rounded-md
                    p-3
                    hover:bg-gray-100
                    "
                >
                  <div className="flex items-center gap-3">
                    <Icon />

                    {!collapsed && <span>{menu.title}</span>}
                  </div>

                  {!collapsed && (
                    <FiChevronDown
                      className={
                        isOpen ? "rotate-180 transition" : "transition"
                      }
                    />
                  )}
                </button>

                {isOpen && !collapsed && (
                  <div className="ml-8 mt-2 space-y-1">
                    {menu.children.map((child) => {
                      const ChildIcon = child.icon;

                      return (
                        <Link
                          key={child.path}
                          href={child.path}
                          className={`
                                flex items-center gap-3
                                rounded-md
                                p-2
                                text-sm
                                ${
                                  pathname === child.path
                                    ? "bg-blue-100 text-blue-600"
                                    : "hover:bg-gray-100"
                                }
                              `}
                        >
                          <ChildIcon />

                          {child.title}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={menu.path}
              href={menu.path!}
              className={`
                flex items-center gap-3
                rounded-md
                p-3
                ${
                  pathname === menu.path
                    ? "bg-blue-100 text-blue-600"
                    : "hover:bg-gray-100"
                }
                `}
            >
              <Icon />

              {!collapsed && menu.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
