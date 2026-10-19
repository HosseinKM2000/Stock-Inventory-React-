export type User = {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string | null;
  phone: string | null;
  industry_id: number | null;
  plan: string;
  is_active: boolean;
  is_admin: boolean;
  role: "USER" | "ADMIN";
  is_system_admin: boolean;
  subscription_started_at: string | null;
  subscription_expires_at: string | null;
  created_at: string;
  store_id?: number | null;
  membership_id?: number | null;
  store_role_id?: number | null;
  store_role_name?: string | null;
  store_permissions?: string[];
  is_store_owner?: boolean;
  temporary_password_required?: boolean;
  credentials_notice_viewed?: boolean;
  membership_authorization_checked_at?: string | null;
};

export type AdminUser = User & {
  subscription_status: "active" | "expired";
  last_activity_at: string | null;
  remaining_days: number | null;
  device_limit_mode: "inherit" | "unlimited" | "limited";
  device_limit_override: number | null;
  effective_device_limit: number | null;
  device_limit_source: "plan" | "user";
  active_session_count: number;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type LoginPayload = {
  username: string;
  password: string;
};

export type RegisterPayload = {
  first_name: string;
  last_name: string;
  username: string;
  password: string;
  phone: string;
  email?: string;
};

export type UpdateProfilePayload = {
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string | null;
  phone?: string | null;
};
