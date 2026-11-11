import { ApiError } from "./api-error";
import { clearToken, getToken } from "./token-store";
import { getDeviceFingerprint } from "@/shared/lib/device/fingerprint";
import { accessState } from "@/shared/access/access-state";
import { recordDiagnostic } from "@/shared/lib/diagnostics/diagnostic-buffer";

const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

/** Origin of the API, used to resolve relative asset URLs like `/uploads/x.png`. */
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  json?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  responseType?: "json" | "blob";
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
  const {
    method = "GET",
    json,
    formData,
    signal,
    headers: customHeaders,
    responseType = "json",
  } = options;

  const headers: Record<string, string> = {
    "X-Client-Data-Schema": "3",
    "X-Request-ID": crypto.randomUUID(),
    ...customHeaders,
  };

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

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method, headers, body, signal });
  } catch (error) {
    recordDiagnostic({ kind: "network_error", summary: "NETWORK_UNAVAILABLE", requestId: headers["X-Request-ID"], path });
    throw error;
  }
  const requestId = response.headers.get("X-Request-ID") ?? headers["X-Request-ID"];
  const serverBuild = response.headers.get("X-Tanzim-Build") ?? undefined;
  const serverSchema = response.headers.get("X-Tanzim-Schema") ?? undefined;

  if (response.status === 204) {
    return undefined as T;
  }

  if (responseType === "blob" && response.ok) {
    return (await response.blob()) as T;
  }

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: response.ok ? "Invalid server response" : text };
    }
  }

  if (!response.ok) {
    const message = extractMessage(data) ?? response.statusText;
    recordDiagnostic({
      kind: "api_error",
      summary: /^[A-Z][A-Z0-9_.:-]+$/.test(message) ? message : `HTTP_${response.status}`,
      requestId,
      httpStatus: response.status,
      path,
      details: { server_build: serverBuild, server_schema: serverSchema },
    });

    const shouldLogout =
      response.status === 401 ||
      (response.status === 403 &&
        (message === "Session expired" ||
          message === "Invalid device session"));

    if (response.status === 423 && message === "ACCOUNT_DISABLED") {
      accessState.disableAccount();
    }

    if (shouldLogout) {
      clearToken();

      if (!location.pathname.startsWith("/auth")) {
        window.location.href = "/auth/login";
      }
    }

    throw new ApiError(response.status, message, data, { requestId, serverBuild, serverSchema });
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
