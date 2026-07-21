// import axios from "axios";
// import Cookies from "js-cookie";

// const api = axios.create({
//   baseURL: process.env.NEXT_PUBLIC_API_URL,
//   timeout: 10000,
// });

// api.interceptors.request.use(
//   (config) => {
//     const token = Cookies.get("token");

//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }

//     return config;
//   },

//   (error) => Promise.reject(error),
// );

// api.interceptors.response.use(
//   (response) => response,

//   (error) => {
//     if (error.response?.status === 401) {
//       Cookies.remove("token");

//       if (typeof window !== "undefined") {
//         window.location.href = "/login";
//       }
//     }

//     return Promise.reject(error);
//   },
// );

// export default api;

import axios from "axios";
import Cookies from "js-cookie";

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

import { useUIStore } from "./store/ui.store";

api.interceptors.response.use(
  (response) => response,

  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove("token");

      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    } else if (error.response?.status === 403) {
      // Trigger global permission denied toast
      useUIStore.getState().addToast(
        "Permission Denied: You do not have the required administrative permissions to perform this action.",
        "error"
      );
    }

    return Promise.reject(error);
  },
);

export default api;
