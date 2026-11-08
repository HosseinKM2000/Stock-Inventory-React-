import { z } from "zod";

import { INVALID_MOBILE_MESSAGE, normalizeIranianMobile } from "../mobile";

function normalizeIdentifier(value: string, context: z.RefinementCtx) {
  const identifier = value.trim();
  if (!identifier) {
    context.addIssue({ code: "custom", message: "نام کاربری یا شماره موبایل الزامی است." });
    return z.NEVER;
  }
  if (identifier.length > 120) {
    context.addIssue({ code: "custom", message: "شناسه ورود بیش از حد طولانی است." });
    return z.NEVER;
  }

  const latinDigits = identifier.replace(/[۰-۹٠-٩]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩".indexOf(digit) % 10 + "");
  if (/^(?:\+98|0098|0)\d+$/.test(latinDigits)) {
    const mobile = normalizeIranianMobile(identifier);
    if (!mobile) {
      context.addIssue({ code: "custom", message: INVALID_MOBILE_MESSAGE });
      return z.NEVER;
    }
    return mobile;
  }
  return identifier;
}

export const loginSchema = z.object({
  username: z.string().transform(normalizeIdentifier),
  password: z.string().min(1, "رمز عبور الزامی است").max(128, "رمز عبور بیش از حد طولانی است."),
  remember: z.boolean().default(false),
});
