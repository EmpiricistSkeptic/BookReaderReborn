import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../constants/api";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// ============================================================
// UNAUTHORIZED HANDLER
// ============================================================
// AuthContext регистрирует здесь колбэк при монтировании.
// Когда refresh token тоже оказывается недействителен,
// apiRequest не просто чистит AsyncStorage — он ещё и
// уведомляет AuthContext, чтобы React-состояние (isAuthenticated)
// обновилось и навигатор сам переключился на экран логина.
type UnauthorizedHandler = () => void;

let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

async function requestNewAccessToken(): Promise<string | null> {
  const refreshToken = await AsyncStorage.getItem("refreshToken");

  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh: refreshToken,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (!data.access) {
      return null;
    }

    await AsyncStorage.setItem("accessToken", data.access);

    return data.access;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  method: HttpMethod = "GET",
  body?: object | FormData,
  extraHeaders: HeadersInit = {},
  retry = true
): Promise<T | null> {
  let token = await AsyncStorage.getItem("accessToken");

  const headers: HeadersInit = {
    ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
    ...extraHeaders,
  };

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    if (body instanceof FormData) {
      config.body = body;
    } else {
      config.body = JSON.stringify(body);
    }
  }

  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${endpoint}`, config);
  } catch (error) {
    console.error("Network error:", error);
    throw new Error("Network error. Please check your internet connection.");
  }

  // ============================================
  // ACCESS TOKEN EXPIRED
  // ============================================
  if (response.status === 401 && retry && endpoint !== "/auth/refresh/") {
    const newAccessToken = await requestNewAccessToken();

    if (newAccessToken) {
      // Access token успешно обновлён — повторяем исходный запрос
      // один раз (retry = false, чтобы не уйти в бесконечный цикл).
      return apiRequest<T>(endpoint, method, body, extraHeaders, false);
    }

    // Refresh token тоже недействителен — сессия действительно
    // закончилась. Чистим хранилище...
    await AsyncStorage.multiRemove(["user", "accessToken", "refreshToken"]);

    // ...и уведомляем AuthContext, чтобы isAuthenticated стал false
    // и навигатор сам переключился на экран логина.
    onUnauthorized?.();

    throw new Error("SESSION_EXPIRED");
  }

  const responseText = await response.text();

  if (!response.ok) {
    try {
      const errorData = JSON.parse(responseText);

      throw new Error(errorData.error ?? errorData.detail ?? JSON.stringify(errorData));
    } catch {
      throw new Error(responseText || `Server error (${response.status})`);
    }
  }

  if (!responseText) {
    return null;
  }

  return JSON.parse(responseText) as T;
}