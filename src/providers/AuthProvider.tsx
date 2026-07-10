"use client";

import { ReactNode, useEffect, useState } from "react";

import { initializeAuth } from "@/features/auth/services/auth.service";

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      await initializeAuth();

      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return children;
}
