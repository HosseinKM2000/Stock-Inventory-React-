export type User = {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string | null;
  phone: string | null;
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

export type SignupPayload = {
  first_name: string;
  last_name: string;
  username: string;
  password: string;
};

export type UpdateProfilePayload = {
  first_name?: string;
  last_name?: string;
  username?: string;
  email?: string | null;
  phone?: string | null;
};
