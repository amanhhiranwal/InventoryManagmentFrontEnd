"use client";

import { ReactNode } from "react";

import { hasPermission } from "@/features/auth/utils/permissions";

export default function PermissionGuard({
  permission,

  children,
}: {
  permission: string;

  children: ReactNode;
}) {
  if (!hasPermission(permission)) {
    return null;
  }

  return children;
}
