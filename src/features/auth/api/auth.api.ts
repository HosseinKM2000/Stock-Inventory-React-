import { apiFetch } from "@/shared/api/client";
import type {
  User,
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  UpdateProfilePayload,
} from "../types";
import { getDeviceFingerprint } from "@/shared/lib/device/fingerprint";

export async function login(
  payload: Omit<LoginPayload, "device_id">,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    json: {
      ...payload,
      device_id: getDeviceFingerprint(),
    },
  });
}

export async function register(
  payload: Omit<RegisterPayload, "device_id">,
): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/signup", {
    method: "POST",
    json: {
      ...payload,
      device_id: getDeviceFingerprint(),
    },
  });
}

export function getMe(): Promise<User> {
  return apiFetch<User>("/auth/me");
}

export function updateProfile(payload: UpdateProfilePayload): Promise<User> {
  return apiFetch<User>("/auth/me", { method: "PATCH", json: payload });
}

export function updatePassword(password: string): Promise<void> {
  return apiFetch<void>("/auth/me/password", {
    method: "PATCH",
    json: { password },
  });
}
