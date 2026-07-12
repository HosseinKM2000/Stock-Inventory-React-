import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(1, "نام محصول الزامی است"),

  description: z.string().nullable(),

//   category_id: z.number().nullable(),

//   unit: z.string().nullable(),

  quantity: z.coerce.number().min(0, "تعداد نامعتبر است"),

  price: z.coerce.number().min(0, "قیمت نامعتبر است"),

  low_stock_threshold: z.coerce.number().min(0),

  low_stock_alert: z.boolean(),

  image: z.instanceof(File).nullable().optional(),

  remove_image: z.boolean().optional(),
});

export type ProductFormValues = z.infer<typeof productSchema>;
