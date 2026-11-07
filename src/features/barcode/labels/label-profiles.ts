import { accessState } from "@/shared/access/access-state";
import type { LabelProfile } from "../types";

const DEFAULT_PROFILES: LabelProfile[] = [
  { id: "thermal-50x30", name: "حرارتی ۵۰ × ۳۰", kind: "thermal", widthMm: 50, heightMm: 30, marginMm: 2, horizontalGapMm: 0, verticalGapMm: 0, columns: 1, showPrice: true, showStoreName: false, showPackageQuantity: true },
  { id: "a4-3-column", name: "برگه A4 سه‌ستونه", kind: "a4", widthMm: 63.5, heightMm: 38.1, marginMm: 7, horizontalGapMm: 2.5, verticalGapMm: 0, columns: 3, showPrice: true, showStoreName: false, showPackageQuantity: true },
];

function key() {
  const user = accessState.user();
  return `tanzim:label-profiles:${user?.id ?? "guest"}:${user?.store_id ?? user?.id ?? "none"}`;
}

export const labelProfileStore = {
  all(): LabelProfile[] {
    try {
      const stored = JSON.parse(localStorage.getItem(key()) ?? "null") as LabelProfile[] | null;
      return Array.isArray(stored) && stored.length ? stored : DEFAULT_PROFILES;
    } catch {
      return DEFAULT_PROFILES;
    }
  },
  save(profile: LabelProfile) {
    const profiles = this.all();
    const next = profiles.some((item) => item.id === profile.id)
      ? profiles.map((item) => item.id === profile.id ? profile : item)
      : [...profiles, profile];
    localStorage.setItem(key(), JSON.stringify(next));
    return next;
  },
};
