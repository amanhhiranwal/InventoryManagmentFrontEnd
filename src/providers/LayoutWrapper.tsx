"use client";

import { usePathname } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Auth paths where sidebar & navbar should be hidden
  const authPaths = ["/login", "/register", "/forgot-password"];
  
  if (authPaths.includes(pathname)) {
    return <>{children}</>;
  }
  
  return <DashboardLayout>{children}</DashboardLayout>;
}
