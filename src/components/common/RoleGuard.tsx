"use client";

import { ReactNode } from "react";
import { hasRole } from "@/features/auth/utils/permissions";

export default function RoleGuard({
  role,

  children,
}: {
  role: string;

  children: ReactNode;
}) {
  if (!hasRole(role)) {
    return null;
  }

  return children;
}
