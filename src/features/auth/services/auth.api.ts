import { apiFetch } from "@/shared/api/client";
import type {
  AuthResponse,
  LoginPayload,
  SignupPayload,
  UpdateProfilePayload,
  User,
} from "../types";

export function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", { method: "POST", json: payload });
}

export function signup(payload: SignupPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/signup", { method: "POST", json: payload });
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
