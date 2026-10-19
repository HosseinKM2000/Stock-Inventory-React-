export type DisplaySize = "compact" | "normal" | "large";

const KEY = "inventory-display-size";
export const DISPLAY_SIZE_EVENT = "display-size-change";

export function getDisplaySize(): DisplaySize {
  const value = localStorage.getItem(KEY);
  return value === "compact" || value === "large" || value === "normal" ? value : "normal";
}

export function setDisplaySize(value: DisplaySize) {
  localStorage.setItem(KEY, value);
  document.documentElement.dataset.displaySize = value;
  window.dispatchEvent(new CustomEvent<DisplaySize>(DISPLAY_SIZE_EVENT, { detail: value }));
  window.dispatchEvent(new Event("tanzim-backup-relevant-change"));
}
