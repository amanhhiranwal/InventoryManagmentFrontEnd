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

    const existingUser = useAuthStore.getState().user;

    useAuthStore.getState().setAuth(
      token,

      {
        id: response.data.user_id,

        first_name: existingUser?.first_name || "",

        last_name: existingUser?.last_name || "",

        email: response.data.email,

        role_id: response.data.role_id,

        permissions: [],

        exp: response.data.exp,
      },
    );

    return true;
  } catch (error) {
    Cookies.remove("token");

    useAuthStore.getState().logout();

    return false;
  }
};
