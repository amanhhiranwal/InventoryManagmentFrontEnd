import Cookies from "js-cookie";

import { meApi } from "../api/auth.api";

import { useAuthStore } from "../store/auth.store";

export const initializeAuth = async () => {
  const token = Cookies.get("token");

  if (!token) {
    return false;
  }

  try {
    const response = await meApi(token);

    let isSuperAdminFromStore = false;
    let storedFirstName = "";
    let storedLastName = "";

    if (typeof window !== "undefined") {
      const storage = localStorage.getItem("auth-storage");
      if (storage) {
        try {
          const parsed = JSON.parse(storage);
          if (parsed?.state?.user) {
            isSuperAdminFromStore = !!parsed.state.user.is_super_admin;
            storedFirstName = parsed.state.user.first_name || "";
            storedLastName = parsed.state.user.last_name || "";
          }
        } catch {}
      }
    }

    const existingUser = useAuthStore.getState().user;
    const finalIsSuperAdmin = !!((response.data as Record<string, unknown>).is_super_admin ?? existingUser?.is_super_admin ?? isSuperAdminFromStore);
    const finalFirstName = existingUser?.first_name || storedFirstName;
    const finalLastName = existingUser?.last_name || storedLastName;

    useAuthStore.getState().setAuth(
      token,

      {
        id: response.data.user_id,

        first_name: finalFirstName,

        last_name: finalLastName,

        email: response.data.email,

        is_super_admin: finalIsSuperAdmin,

        role_id: response.data.role_id,

        permissions: response.data.permissions || [],

        exp: response.data.exp,
      },
    );

    return true;
  } catch {
    Cookies.remove("token");

    useAuthStore.getState().logout();

    return false;
  }
};
