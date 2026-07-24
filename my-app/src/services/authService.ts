import { apiRequest } from "./apiService";

const AUTH_ENDPOINT = "/auth/";

interface AuthResponse {
  user: unknown;
  access: string;
  refresh: string;
  message: string;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  password: string;
  email: string;
}

export async function registerUser(
  userData: RegisterData
): Promise<AuthResponse> {
  const data = await apiRequest<any>(
    `${AUTH_ENDPOINT}register/`,
    "POST",
    userData
  );

  return {
    user: data.user,
    access: data.tokens.access,
    refresh: data.tokens.refresh,
    message: data.message,
  };
}

export async function loginUser(
  credentials: LoginCredentials
): Promise<AuthResponse> {
  const data = await apiRequest<any>(
    `${AUTH_ENDPOINT}login/`,
    "POST",
    credentials
  );

  return {
    user: data.user,
    access: data.tokens.access,
    refresh: data.tokens.refresh,
    message: data.message,
  };
}

export async function refreshTokenService(
  refresh: string
): Promise<string> {
  const data = await apiRequest<{ access: string }>(
    `${AUTH_ENDPOINT}refresh/`,
    "POST",
    { refresh }
  );

  return data?.access ?? "";
}