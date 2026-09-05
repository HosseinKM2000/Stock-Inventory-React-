import { z } from "zod";

export const industrySchema = z.object({
  name: z.string().min(1, "عنوان الزامی است"),
  description: z.string(),
  is_active: z.boolean(),
});

export type IndustryFormValues = z.infer<typeof industrySchema>;