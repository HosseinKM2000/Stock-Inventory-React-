import { z } from "zod";

export const catalogSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "عنوان الزامی است")
    .max(200, "عنوان نمی‌تواند بیشتر از ۲۰۰ نویسه باشد"),
  description: z
    .string()
    .max(5000, "توضیحات نمی‌تواند بیشتر از ۵۰۰۰ نویسه باشد"),
  industry_id: z.number().int().positive("حوزه کاری را انتخاب کنید"),
  brand: z
    .string()
    .max(120, "نام برند نمی‌تواند بیشتر از ۱۲۰ نویسه باشد"),
  image_url: z
    .string()
    .max(500, "آدرس تصویر بیش از حد طولانی است")
    .refine(
      (value) =>
        !value.trim() ||
        value.trim().startsWith("/uploads/") ||
        /^https?:\/\//i.test(value.trim()),
      "آدرس تصویر باید یک نشانی معتبر باشد",
    ),
});

export type CatalogFormValues = z.infer<typeof catalogSchema>;
