export type Industry = {
  id: number;
  name: string;
  is_active: boolean;
  description: string;
};

export type CreateIndustry = {
  name: string;
  is_active: boolean;
  description?: string;
};

export type UpdateIndustry = {
  name?: string;
  is_active?: boolean;
  description?: string;
};
