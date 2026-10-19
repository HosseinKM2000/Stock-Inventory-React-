import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(2, "عنوان حداقل باید ۲ کاراکتر باشد"),

  description: z.string().optional().nullable(),
});
