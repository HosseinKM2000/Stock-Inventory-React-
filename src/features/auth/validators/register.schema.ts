import { z } from "zod";
import { passwordSchema } from "@/shared/validation/password.schema";
import { INVALID_MOBILE_MESSAGE, normalizeIranianMobile } from "../mobile";

const mobileSchema = z.string().transform((value, context) => {
  const normalized = normalizeIranianMobile(value);
  if (!normalized) {
    context.addIssue({ code: "custom", message: INVALID_MOBILE_MESSAGE });
    return z.NEVER;
  }
  return normalized;
});

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "نام کاربری باید حداقل ۳ کاراکتر داشته باشد.")
      .max(30, "نام کاربری نباید بیشتر از ۳۰ کاراکتر باشد.")
      .regex(/^[A-Za-z][A-Za-z0-9._-]*$/, "نام کاربری باید با حرف انگلیسی شروع شود و فقط شامل حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد."),
    phone: mobileSchema,
    password: passwordSchema,
    repeatPassword: z.string(),
  })
  .refine((data) => data.password === data.repeatPassword, {
    message: "رمز عبور و تکرار آن یکسان نیست.",
    path: ["repeatPassword"],
  });
