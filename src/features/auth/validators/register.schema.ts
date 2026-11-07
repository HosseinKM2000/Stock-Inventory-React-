import { z } from "zod";
import { passwordSchema } from "@/shared/validation/password.schema";

export const registerSchema = z
  .object({
    username: z.string().trim().min(5, "نام کاربری باید حداقل ۵ کاراکتر داشته باشد."),
    password: passwordSchema,
    repeatPassword: z.string(),
  })
  .refine((data) => data.password === data.repeatPassword, {
    message: "رمز عبور و تکرار آن یکسان نیست.",
    path: ["repeatPassword"],
  });
