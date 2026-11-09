const SECTION_TITLES: Record<string, string> = {
  dashboard: "داشبورد",
  inventory: "محصولات",
  tools: "ابزارها",
  setting: "تنظیمات",
  management: "مدیریت",
  industry: "حوزه کاری",
};

export function getHeaderSectionTitle(pathname: string): string {
  const rootSegment = pathname.split("/").filter(Boolean)[0];
  return SECTION_TITLES[rootSegment] ?? "داشبورد";
}
