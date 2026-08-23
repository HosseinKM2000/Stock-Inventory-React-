import { apiFetch } from "@/shared/api/client";
import { getDeviceFingerprint } from "@/shared/lib/device/fingerprint";

import type {
  User,
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
} from "../types";
import { normalizeUser } from "../normalize-user";

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    json: {
      ...payload,
      device_fingerprint: getDeviceFingerprint(),
    },
  });
  return { ...response, user: normalizeUser(response.user) };
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    json: {
      ...payload,
      device_fingerprint: getDeviceFingerprint(),
    },
  });
  return { ...response, user: normalizeUser(response.user) };
}

export async function getMe(): Promise<User> {
  return normalizeUser(await apiFetch<User>("/auth/me"));
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<User> {
  return normalizeUser(await apiFetch<User>("/auth/me", {
    method: "PATCH",
    json: payload,
  }));
}

export function updatePassword(password: string): Promise<void> {
  return apiFetch<void>("/auth/me/password", {
    method: "PATCH",
    json: {
      password,
    },
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>("/auth/logout", {
    method: "POST",
    headers: {
      "X-Device-Fingerprint": getDeviceFingerprint(),
    },
  });
}
