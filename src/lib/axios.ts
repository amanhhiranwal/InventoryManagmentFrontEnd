import axios from "axios";
import Cookies from "js-cookie";
import { useUIStore } from "./store/ui.store";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
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
    if (error.response?.status === 401 && !isLoginRequest) {
      Cookies.remove("token");
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    } else {
      let errorMsg = "An unexpected error occurred. Please try again.";

      if (error.response?.status === 403) {
        errorMsg = "Permission Denied: You do not have the required administrative permissions to perform this action.";
      } else if (error.response?.data) {
        const data = error.response.data;
        if (typeof data.detail === "string") {
          errorMsg = data.detail;
        } else if (Array.isArray(data.detail)) {
          // Format validation errors (e.g. FastAPI 422 errors)
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
