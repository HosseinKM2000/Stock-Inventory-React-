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
    .max(500, "آدرس تصویر بیش از حد طولانی است"),
  is_packaged: z.boolean(),
  pack_size: z.number().int("تعداد هر بسته باید عدد صحیح باشد").positive("تعداد هر بسته باید حداقل یک باشد").nullable(),
}).superRefine((value, context) => {
  if (value.is_packaged && value.pack_size == null) {
    context.addIssue({
      code: "custom",
      path: ["pack_size"],
      message: "تعداد واحد در هر بسته الزامی است",
    });
  }
});

export type CatalogFormValues = z.infer<typeof catalogSchema>;
