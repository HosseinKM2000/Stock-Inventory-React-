export type Category = {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
};

export type CategoryInput = {
  name: string;
  description?: string | null;
};
