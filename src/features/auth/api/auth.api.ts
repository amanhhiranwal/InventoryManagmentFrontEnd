import api from "@/lib/axios";
import { LoginResponse, MeResponse } from "../types/auth.types";

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
  return api.post("/logout");
};