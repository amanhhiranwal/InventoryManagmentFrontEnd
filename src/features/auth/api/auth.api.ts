import api from "@/lib/axios";
import {
  ForgotPasswordResponse,
  LoginResponse,
  MeResponse,
  ResetPasswordResponse,
} from "../types/auth.types";

export const loginApi = async (
  email: string,
  password: string
): Promise<LoginResponse> => {
  const { data } = await api.post("/api/v1/auth/login", {
    email,
    password,
  });

  return data;
};

export const meApi = async (
  token: string
): Promise<MeResponse> => {

  const { data } = await api.get(
    "/api/v1/auth/me",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return data;
};
export const logoutApi = async () => {
  return api.post("/api/v1/auth/logout");
};

export const forgotPasswordApi = async (
  email: string
): Promise<ForgotPasswordResponse> => {
  const { data } = await api.post(
    "/api/v1/auth/forgot-password",
    { email },
    { skipErrorToast: true }
  );

  return data;
};

export const resetPasswordApi = async (
  token: string,
  password: string,
  email?: string
): Promise<ResetPasswordResponse> => {
  const { data } = await api.post(
    "/api/v1/auth/reset-password",
    {
      token,
      password,
      ...(email ? { email } : {}),
    },
    { skipErrorToast: true }
  );

  return data;
};
