"use client";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { useLogout } from "@/features/auth/hooks/useLogout";
import { IoMdLogOut } from "react-icons/io";
import { CgProfile } from "react-icons/cg";
import Link from "next/link";

export default function Navbar() {
  const user = useAuthStore((state) => state.user);

  const { logout } = useLogout();

  return (
    <nav className="flex items-center justify-between border-b p-5">
      <div>
        <h2 className="font-bold">RBAC Dashboard</h2>
      </div>

      <div className="relative group">
        {/* Profile Trigger */}
        <div className="flex cursor-pointer items-center gap-3">
          <div>
            <p className="font-medium">{user?.first_name}</p>
          </div>

          <CgProfile className="text-2xl" />
        </div>

        {/* Dropdown */}
        <div
          className="
            absolute right-0 top-10 z-50 
            hidden w-48 rounded-md border bg-black shadow-lg
            group-hover:block
          "
        >
          <ul className="py-2">
            <li>
              <Link
                href="/profile"
                className="
                  flex items-center gap-2 px-4 py-2
                  hover:bg-gray-100
                "
              >
                <CgProfile />
                Profile
              </Link>
            </li>

            <li>
              <button
                onClick={logout}
                className="
                  flex w-full items-center gap-2 px-4 py-2
                  text-left hover:bg-gray-100
                "
              >
                <IoMdLogOut />
                Logout
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}