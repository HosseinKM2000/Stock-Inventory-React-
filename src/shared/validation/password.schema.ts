import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "رمز عبور باید حداقل ۸ کاراکتر داشته باشد.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "رمز عبور نباید بیشتر از ۷۲ بایت باشد.",
  )
  .regex(/[A-Z]/, "رمز عبور باید حداقل یک حرف بزرگ انگلیسی داشته باشد.")
  .regex(/[a-z]/, "رمز عبور باید حداقل یک حرف کوچک انگلیسی داشته باشد.")
  .regex(/[0-9]/, "رمز عبور باید حداقل یک عدد داشته باشد.");
