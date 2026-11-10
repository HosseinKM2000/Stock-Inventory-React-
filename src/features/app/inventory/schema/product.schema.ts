import { z } from "zod";
import { MAX_PRODUCT_QUANTITY, PRODUCT_QUANTITY_LIMIT_MESSAGE } from "../domain/inventory-quantity";

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

  label_ids: z.array(z.number().int()),

  quantity: z.coerce.number()
    .int("موجودی محصول باید یک عدد صحیح باشد")
    .min(0, "موجودی محصول نمی‌تواند منفی باشد")
    .max(MAX_PRODUCT_QUANTITY, PRODUCT_QUANTITY_LIMIT_MESSAGE),

  price: z.coerce.number().min(0, "قیمت نامعتبر است"),

  sale_price: z.number().int().min(0, "قیمت فروش نامعتبر است").nullable(),

  purchase_price: z.number().int().min(0, "قیمت خرید نامعتبر است").nullable(),

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
