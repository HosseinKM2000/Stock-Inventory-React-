import { ApiError } from "./api-error";

const BASE_URL = "http://127.0.0.1:8000";

export type ApiRequestConfig = Omit<RequestInit, "body"> & {
  params?: Record<string, string | number | boolean>;
  body?: unknown;
};

async function request<T>(
  endpoint: string,
  config: ApiRequestConfig = {},
): Promise<T> {
  const { params, body, headers, ...rest } = config;

  const url = new URL(endpoint, BASE_URL);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
    });
  }

  const response = await fetch(url.toString(), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...rest,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      data?.message ?? "Request failed",
      response.status,
      data,
    );
  }

  return data;
}

export const apiClient = {
  get<T>(endpoint: string, config?: ApiRequestConfig) {
    return request<T>(endpoint, {
      ...config,
      method: "GET",
    });
  },

  post<T>(endpoint: string, body?: unknown, config?: ApiRequestConfig) {
    return request<T>(endpoint, {
      ...config,
      method: "POST",
      body,
    });
  },

  put<T>(endpoint: string, body?: unknown, config?: ApiRequestConfig) {
    return request<T>(endpoint, {
      ...config,
      method: "PUT",
      body,
    });
  },

  patch<T>(endpoint: string, body?: unknown, config?: ApiRequestConfig) {
    return request<T>(endpoint, {
      ...config,
      method: "PATCH",
      body,
    });
  },

  delete<T>(endpoint: string, config?: ApiRequestConfig) {
    return request<T>(endpoint, {
      ...config,
      method: "DELETE",
    });
  },
};
