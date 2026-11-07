import type { Activity } from "./api";

const entities: Record<string, string> = {
  product: "محصول", category: "دسته‌بندی", label: "برچسب", barcode: "بارکد",
  inventory_movement: "موجودی", invoice: "فاکتور", role: "نقش", membership: "عضو تیم", store: "مجموعه",
};

const actions: Record<string, string> = {
  "sync.create": "ایجاد", "sync.update": "ویرایش", "sync.delete": "حذف",
  "role.created": "ایجاد", "role.updated": "ویرایش", "role.deleted": "حذف",
  "personnel.created": "افزودن", "personnel.updated": "تغییر دسترسی",
  "personnel.credentials_reset": "بازنشانی اطلاعات ورود",
  "store.team_activated": "فعال‌کردن کار تیمی برای", "invoice.posted": "ثبت",
  "invoice.cancelled": "لغو", "barcode.create": "افزودن",
  "barcode.update": "ویرایش", "barcode.delete": "حذف",
  "inventory.scan.receive": "افزایش", "inventory.scan.issue": "کاهش",
  "inventory.scan.correction": "اصلاح",
};

const safeNameKeys = ["custom_label", "product_name", "title", "name"] as const;

function safeName(item: Activity) {
  for (const source of [item.after, item.before]) {
    for (const key of safeNameKeys) {
      const value = source?.[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

function quantityChange(item: Activity) {
  const before = item.after?.before_quantity ?? item.before?.quantity;
  const after = item.after?.quantity;
  if (typeof before !== "number" || typeof after !== "number" || before === after) return null;
  const delta = after - before;
  const change = delta > 0
    ? `${delta.toLocaleString("fa-IR")} عدد به موجودی اضافه شد`
    : `${Math.abs(delta).toLocaleString("fa-IR")} عدد از موجودی کم شد`;
  return `${change} (از ${before.toLocaleString("fa-IR")} به ${after.toLocaleString("fa-IR")}).`;
}

export function presentActivity(item: Activity) {
  const entity = entities[item.target_entity] ?? "اطلاعات";
  const verb = actions[item.action] ?? (item.action.startsWith("sync.") ? "تغییر" : "ثبت رویداد");
  const name = safeName(item);
  const subject = name ? `${entity} «${name}»` : entity;
  const result = item.outcome === "applied"
    ? "با تأیید مجموعه انجام شد."
    : item.outcome === "conflict"
      ? "به‌دلیل تداخل با اطلاعات تازه‌تر انجام نشد؛ مورد نیاز به بررسی دارد."
      : "پذیرفته نشد؛ اطلاعات موجود تغییر نکرد.";
  return {
    title: `${verb} ${subject}`,
    detail: quantityChange(item) ?? result,
    result,
    entity,
    diagnostic: `${item.action} · ${item.operation_id}`,
  };
}
