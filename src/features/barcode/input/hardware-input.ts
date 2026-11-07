import { sanitizeScannedValue } from "../domain/barcode";

export function completedHardwareScan(event: Pick<KeyboardEvent, "key" | "preventDefault">, value: string) {
  if (event.key !== "Enter" && event.key !== "Tab") return null;
  const scanned = sanitizeScannedValue(value);
  if (!scanned) return null;
  event.preventDefault();
  return scanned;
}
