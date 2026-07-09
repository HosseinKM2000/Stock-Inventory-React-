import { z } from "zod";

export const catalogSchema = z.object({
  name: z.string().min(1, "عنوان الزامی است"),
  description: z.string(),
  industry_id: z.number(),
  brand: z.string(),
  image_url: z.string(),
});

export type CatalogFormValues = z.infer<typeof catalogSchema>;
