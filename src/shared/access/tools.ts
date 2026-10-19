export const DOMAIN_TOOLS = [
  { id: "import", label: "ورود از اکسل" },
  { id: "labels", label: "برچسب‌ها" },
  { id: "categories", label: "دسته‌ها" },
  { id: "export", label: "خروجی" },
  { id: "catalog", label: "کاتالوگ" },
  { id: "recovery", label: "بازیابی" },
] as const;

export type DomainToolId = typeof DOMAIN_TOOLS[number]["id"];
export const DEFAULT_DOMAIN_TOOLS: Record<DomainToolId, boolean> = Object.fromEntries(DOMAIN_TOOLS.map(({ id }) => [id, true])) as Record<DomainToolId, boolean>;
