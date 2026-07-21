import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
}

interface UIState {
  isSidebarOpen: boolean; // mobile drawer open state
  isSidebarCollapsed: boolean; // desktop collapsed state
  theme: "light" | "dark";
  toasts: ToastMessage[];
  addToast: (message: string, type: ToastMessage["type"]) => void;
  removeToast: (id: string) => void;
  toggleSidebarOpen: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleTheme: () => void;
  setTheme: (theme: "light" | "dark") => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarOpen: false,
      isSidebarCollapsed: false,
      theme: "light",
      toasts: [],
      addToast: (message, type) =>
        set((state) => {
          const id = Math.random().toString(36).substring(2, 9);
          // Auto remove after 5 seconds
          setTimeout(() => {
            useUIStore.getState().removeToast(id);
          }, 5000);
          return {
            toasts: [...state.toasts, { id, message, type }],
          };
        }),
      removeToast: (id) =>
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        })),
      toggleSidebarOpen: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      toggleSidebarCollapsed: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      toggleTheme: () =>
        set((state) => {
          const nextTheme = state.theme === "light" ? "dark" : "light";
          if (typeof window !== "undefined") {
            if (nextTheme === "dark") {
              document.documentElement.classList.add("dark");
            } else {
              document.documentElement.classList.remove("dark");
            }
          }
          return { theme: nextTheme };
        }),
      setTheme: (theme) =>
        set(() => {
          if (typeof window !== "undefined") {
            if (theme === "dark") {
              document.documentElement.classList.add("dark");
            } else {
              document.documentElement.classList.remove("dark");
            }
          }
          return { theme };
        }),
    }),
    {
      name: "ui-storage",
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        theme: state.theme,
      }), // Persist only sidebar collapsed state and user theme preference
    }
  )
);
