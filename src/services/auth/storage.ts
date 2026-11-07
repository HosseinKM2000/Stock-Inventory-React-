"use client";

const TOKEN_KEY = "kaizen_token";
const PENDING_PHONE_KEY = "kaizen_pending_phone";

export const authStorage = {
  getToken: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null,

  setToken: (token: string): void =>
    localStorage.setItem(TOKEN_KEY, token),

  clearToken: (): void =>
    localStorage.removeItem(TOKEN_KEY),

  getPendingPhone: (): string | null =>
    typeof window !== "undefined" ? localStorage.getItem(PENDING_PHONE_KEY) : null,

  setPendingPhone: (phone: string): void =>
    localStorage.setItem(PENDING_PHONE_KEY, phone),

  clearPendingPhone: (): void =>
    localStorage.removeItem(PENDING_PHONE_KEY),

  isLoggedIn: (): boolean =>
    typeof window !== "undefined" && !!localStorage.getItem(TOKEN_KEY),
};
