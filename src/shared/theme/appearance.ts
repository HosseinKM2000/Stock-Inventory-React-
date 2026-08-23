export type Appearance = "light" | "dark" | "system";

const KEY = "inventory-appearance";

export function getAppearance(): Appearance {
  const value = localStorage.getItem(KEY);
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function setAppearance(value: Appearance) {
  localStorage.setItem(KEY, value);
  window.dispatchEvent(new CustomEvent("appearance-change", { detail: value }));
}
