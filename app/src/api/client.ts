import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

export const DEFAULT_DEMO_USER_ID = "a0000000-0000-0000-0000-000000000001";
export const DEMO_TOKEN_KEY = "camplx.auth.token";

export function getBaseApiUrl(): string {
  if (process.env.EXPO_PUBLIC_BACKEND_URL) {
    const raw = process.env.EXPO_PUBLIC_BACKEND_URL.trim().replace(/\/$/, "");
    return raw.endsWith("/api/v1") ? raw : `${raw}/api/v1`;
  }
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000/api/v1";
  }
  return "http://localhost:8000/api/v1";
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  headers?: Record<string, string>;
  isFormData?: boolean;
  timeoutMs?: number;
};

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    isFormData = false,
    timeoutMs = 15000,
  } = options;
  const baseUrl = getBaseApiUrl();
  const url = `${baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  let token: string | null = null;
  try {
    token = await SecureStore.getItemAsync(DEMO_TOKEN_KEY);
  } catch {
    // Non-blocking in environments without SecureStore
  }

  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    "X-Camplx-Demo-User-Id": DEFAULT_DEMO_USER_ID,
    ...headers,
  };

  if (!isFormData && body !== undefined && !reqHeaders["Content-Type"]) {
    reqHeaders["Content-Type"] = "application/json";
  }

  if (token) {
    reqHeaders["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers: reqHeaders,
      body: isFormData
        ? (body as FormData)
        : body !== undefined
          ? JSON.stringify(body)
          : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      let errJson: any = null;
      try {
        errJson = await response.json();
      } catch {}
      throw new ApiError(
        response.status,
        errJson?.code || "HTTP_ERROR",
        errJson?.message || `Request failed with status ${response.status}`,
        errJson?.details,
      );
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  } catch (error: any) {
    clearTimeout(timeout);
    if (error instanceof ApiError) {
      throw error;
    }
    const message =
      error.name === "AbortError"
        ? "Network timeout"
        : error.message || "Network request failed";
    throw new ApiError(0, "NETWORK_ERROR", message);
  }
}
