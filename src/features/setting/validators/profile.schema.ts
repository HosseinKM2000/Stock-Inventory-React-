import { z } from "zod";
import { INVALID_MOBILE_MESSAGE, normalizeIranianMobile } from "@/features/auth/mobile";

const mobileSchema = z.string().transform((value, context) => {
  const normalized = normalizeIranianMobile(value);
  if (!normalized) {
    context.addIssue({ code: "custom", message: INVALID_MOBILE_MESSAGE });
    return z.NEVER;
  }
  return normalized;
});

export const profileSchema = z.object({
  first_name: z.string().min(1, "نام الزامی است"),
  last_name: z.string().min(1, "نام خانوادگی الزامی است"),
  username: z.string().min(3, "حداقل ۳ کاراکتر"),
  email: z.string().email("ایمیل نامعتبر").or(z.literal("")),
  phone: mobileSchema,
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
