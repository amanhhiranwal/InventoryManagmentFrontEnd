"use client";

import Cookies from "js-cookie";
import { useRouter } from "next/navigation";

import { logoutApi } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";

export const useLogout = () => {
  const router = useRouter();

  const logout = async () => {
    try {
      await logoutApi();
    } catch (error) {
      console.log(error);
    } finally {
      Cookies.remove("token");

      useAuthStore.getState().logout();

      router.replace("/login");
    }
  };

  return {
    logout,
  };
};
