"use client";

import { usePathname } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Auth paths where sidebar & navbar should be hidden. /change-password
  // belongs here even though the person is signed in: the server refuses
  // every other screen until they have chosen one, so a sidebar full of
  // links that all bounce back here is an offer we cannot keep.
  const authPaths = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/change-password",
  ];
  
  if (authPaths.includes(pathname)) {
    return <>{children}</>;
  }
  
  return <DashboardLayout>{children}</DashboardLayout>;
}
