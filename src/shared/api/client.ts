import { ApiError } from "@/services/api/api-error";
import { clearToken, getToken } from "./token-store";
import { getDeviceFingerprint } from "@/shared/lib/device/fingerprint";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

/** Origin of the API, used to resolve relative asset URLs like `/uploads/x.png`. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  json?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
};

function extractMessage(data: unknown): string | null {
  if (data && typeof data === "object" && "detail" in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg;
    }
  }
  return null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", json, formData, signal } = options;

  const headers: Record<string, string> = {};

  const token = getToken();

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  headers["X-Device-Fingerprint"] = getDeviceFingerprint();

  let body: BodyInit | undefined;
  if (formData) {
    body = formData; // browser sets multipart Content-Type with boundary
  } else if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(json);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body,
    signal,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();

      if (!location.pathname.startsWith("/auth")) {
        window.location.href = "/auth/login";
      }
    }

    throw new ApiError(
      response.status,
      extractMessage(data) ?? response.statusText,
      data,
    );
  }

  return data as T;
}

/** Turn a backend image path into an absolute URL the browser can load. */
export function resolveAssetUrl(
  path: string | null | undefined,
): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_ORIGIN}${path}`;
}
