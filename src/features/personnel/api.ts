import { apiFetch } from "@/shared/api/client";

export type StoreRole = { id: number; name: string; permissions: string[]; assigned_count: number };
export type Personnel = { membership_id: number; user_id: number; first_name: string; last_name: string; username: string; role_id: number; role_name: string; active: boolean; temporary_password_required: boolean; credentials_notice_viewed: boolean; created_at: string; last_activity_at: string | null };
export type PersonnelCreated = Personnel & { temporary_password: string };
export type Capacity = { enabled: boolean; used: number; limit: number | null; available: number | null };
export type Activity = { id: number; actor_user_id: number; actor_membership_id: number; actor_display_name: string; actor_role_name: string; operation_id: string; target_entity: string; target_id: string | null; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; outcome: "applied" | "rejected" | "conflict"; client_occurred_at: string | null; accepted_at: string };
export type ActivityFilters = { page?: number; actor_user_id?: number; action?: string; date_from?: string; date_to?: string };

export const personnelApi = {
  roles: () => apiFetch<StoreRole[]>("/store/roles"),
  createRole: (input: { name: string; permissions: string[] }) => apiFetch<StoreRole>("/store/roles", { method: "POST", json: input }),
  updateRole: (id: number, input: { name: string; permissions: string[] }) => apiFetch<StoreRole>(`/store/roles/${id}`, { method: "PATCH", json: input }),
  deleteRole: (id: number) => apiFetch<void>(`/store/roles/${id}`, { method: "DELETE" }),
  personnel: () => apiFetch<Personnel[]>("/store/personnel"),
  capacity: () => apiFetch<Capacity>("/store/personnel/capacity"),
  create: (input: { first_name: string; last_name: string; username?: string; role_id: number }) => apiFetch<PersonnelCreated>("/store/personnel", { method: "POST", json: input }),
  update: (id: number, input: { role_id?: number; active?: boolean }) => apiFetch<Personnel>(`/store/personnel/${id}`, { method: "PATCH", json: input }),
  resetCredentials: (id: number) => apiFetch<PersonnelCreated>(`/store/personnel/${id}/temporary-credentials`, { method: "POST" }),
  activity: (filters: ActivityFilters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const query = params.toString();
    return apiFetch<{ items: Activity[]; total: number; page: number; page_size: number }>(`/store/activity${query ? `?${query}` : ""}`);
  },
  todayActivity: () => apiFetch<{ count: number }>("/store/activity/today-summary"),
  dismissCredentialsNotice: () => apiFetch<void>("/store/credentials-notice/viewed", { method: "POST" }),
};

export const permissionOptions = [
  ["products.view", "مشاهده محصولات"], ["products.create", "ایجاد محصول"], ["products.edit", "ویرایش جزئیات محصول"],
  ["products.quantity.change", "تغییر موجودی"], ["products.sale_price.view", "مشاهده قیمت فروش"], ["products.sale_price.change", "تغییر قیمت فروش"],
  ["products.purchase_price.view", "مشاهده قیمت خرید"], ["products.purchase_price.change", "تغییر قیمت خرید"], ["finance.view", "مشاهده تحلیل مالی"], ["products.delete", "حذف محصول"],
  ["categories.manage", "مدیریت دسته‌ها"], ["labels.manage", "مدیریت برچسب‌ها"], ["products.bulk", "عملیات گروهی"],
  ["barcodes.lookup", "مشاهده و اسکن بارکد"], ["barcodes.manage", "مدیریت بارکد"], ["labels.print", "چاپ لیبل"],
  ["dashboard.view", "مشاهده داشبورد"], ["tools.import", "ورود اطلاعات"], ["tools.export", "خروجی"],
  ["tools.catalog", "کاتالوگ"], ["tools.backup", "پشتیبان‌گیری"], ["tools.restore", "بازیابی"],
] as const;
