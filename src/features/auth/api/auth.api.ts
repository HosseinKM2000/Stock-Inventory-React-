import { apiFetch } from "@/shared/api/client";
import { getDeviceFingerprint } from "@/shared/lib/device/fingerprint";

import type {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
  User,
} from "../types";

export function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    json: {
      ...payload,
      device_fingerprint: getDeviceFingerprint(),
    },
  });
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    json: {
      ...payload,
      device_fingerprint: getDeviceFingerprint(),
    },
  });
}

export function getMe(): Promise<User> {
  return apiFetch<User>("/auth/me");
}

export function updateProfile(payload: UpdateProfilePayload): Promise<User> {
  return apiFetch<User>("/auth/me", {
    method: "PATCH",
    json: payload,
  });
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
