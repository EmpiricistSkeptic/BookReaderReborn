import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "../constants/api";

type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE";

export async function apiRequest<T>(
  endpoint: string,
  method: HttpMethod = "GET",
  body?: object | FormData,
  extraHeaders: HeadersInit = {}
): Promise<T | null> {
  const token = await AsyncStorage.getItem("accessToken");

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    if (body instanceof FormData) {
      delete (headers as Record<string, string>)["Content-Type"];
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

  const responseText = await response.text();

  if (!response.ok) {
    try {
      const errorData = JSON.parse(responseText);

      throw new Error(
        errorData.error ??
          errorData.detail ??
          JSON.stringify(errorData)
      );
    } catch {
      throw new Error(
        responseText || `Server error (${response.status})`
      );
    }
  }

  if (!responseText) {
    return null;
  }

  return JSON.parse(responseText) as T;
}