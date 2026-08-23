export type User = {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string | null;
  phone: string | null;
  industry_id: number | null;
  plan: "free" | "starter" | "pro" | "vip";
  is_active: boolean;
  is_admin: boolean;
  subscription_expires_at: string | null;
  created_at: string;
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
