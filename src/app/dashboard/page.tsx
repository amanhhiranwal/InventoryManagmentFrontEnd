

"use client";

import { useAuthStore } from "@/features/auth/store/auth.store";

export default function Dashboard() {
  const user = useAuthStore((state) => state.user);
  return (
    <div className="p-10">
      <h1 className="text-3xl font-bold">Welcome {user?.first_name}</h1>
      <div className="mt-8 rounded border p-5">
        <p>
          Email:
          {user?.email}
        </p>
        <p>
          User ID:
          {user?.id}
        </p>
      </div>
    </div>
  );
}
