import { z } from "zod";

const catalogProductSchema = z.object({
  id: z.number(),

  industry_id: z.number(),

  name: z.string(),

  description: z.string().nullable(),

  brand: z.string().nullable(),

  image_url: z.string().nullable(),

  is_packaged: z.boolean(),

  pack_size: z.number().int("تعداد هر بسته باید عدد صحیح باشد").positive("تعداد هر بسته باید حداقل یک باشد").nullable(),

  created_at: z.string(),
}).superRefine((value, context) => {
  if (value.is_packaged && value.pack_size == null) {
    context.addIssue({
      code: "custom",
      path: ["pack_size"],
      message: "تعداد واحد در هر بسته الزامی است",
    });
  }
});

export const productSchema = z.object({
  id: z.number(),

  catalog_product_id: z.number(),

  is_catalog_backed: z.boolean(),

  category_id: z.number().nullable(),

  quantity: z.coerce.number().min(0, "تعداد نامعتبر است"),

  price: z.coerce.number().min(0, "قیمت نامعتبر است"),

  custom_label: z.string().nullable(),

  image_url: z.string().nullable(),

  note: z.string().nullable(),

  low_stock_threshold: z.coerce.number().min(0),

  low_stock_alert: z.boolean(),

  is_hidden: z.boolean(),

  deleted_at: z.string().nullable(),

  status: z.enum(["in_stock", "low_stock", "out_of_stock"]),

  created_at: z.string(),

  updated_at: z.string(),

  catalog_product: catalogProductSchema,

  image: z.instanceof(File).nullable().optional(),

  remove_image: z.boolean().optional(),
});

export type ProductFormValues = z.infer<typeof productSchema>;
