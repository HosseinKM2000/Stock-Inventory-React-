export type Industry = {
  id: number;
  name: string;
  is_active: boolean;
  description: string;
};

export type IndustryInput = {
  name: string;
  description: string;
  is_active: boolean;
};

export type Category = {
  id: number;
  name: string;
  description: string;
  created_at: string;
};

export type CategoryInput = {
  name: string;
  description?: string;
};

