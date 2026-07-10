import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthUser } from "../types/auth.types";

interface AuthState {
  token: string | null;

  user: AuthUser | null;

  isAuthenticated: boolean;

  setAuth: (token: string, user: AuthUser) => void;

  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) =>
        set({
          token,
          user,
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "auth-storage",
    },
  ),
);
