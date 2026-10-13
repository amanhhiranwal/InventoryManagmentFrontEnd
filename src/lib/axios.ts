import axios from "axios";
import Cookies from "js-cookie";
import { useUIStore } from "./store/ui.store";

declare module "axios" {
  export interface AxiosRequestConfig {
    skipErrorToast?: boolean;
  }
}

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "",
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    const token = Cookies.get("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes("/auth/login");
    const skipToast = error.config?.skipErrorToast === true;

    /* Signed in on a password that was emailed to them: the server
       refuses everything but choosing a new one, so there is one place
       to be and this is how a stale tab gets there. */
    const mustChangePassword =
      error.response?.status === 403 &&
      typeof error.response?.data?.detail === "string" &&
      error.response.data.detail.includes("Choose your own password");

    if (error.response?.status === 401 && !isLoginRequest) {
      Cookies.remove("token");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    } else if (mustChangePassword) {
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/change-password")
      ) {
        window.location.href = "/change-password";
      }
    } else if (!skipToast) {
      let errorMsg = "An unexpected error occurred. Please try again.";

      /* A 403 used to be reported as a permissions problem whatever the
         server actually said, so a refusal with a real explanation - an
         approval still open, a deal in another region, a password that
         has to be chosen first - arrived as the same unhelpful line. The
         server's own words come first now; the canned one is the
         fallback for a 403 that carries nothing. */
      if (error.response?.status === 403 && !error.response?.data?.detail) {
        errorMsg = "Permission Denied: You do not have the required administrative permissions to perform this action.";
      } else if (error.response?.data) {
        const data = error.response.data;
        if (typeof data.detail === "string") {
          errorMsg = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorMsg = data.detail.map((err: any) => {
            const field = err.loc ? err.loc.filter((l: any) => l !== "body").join(".") : "field";
            return `${field}: ${err.msg}`;
          }).join(", ");
        } else if (data.message) {
          errorMsg = data.message;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }

      useUIStore.getState().addToast(errorMsg, "error");
    }
    return Promise.reject(error);
  },
);

export default api;
