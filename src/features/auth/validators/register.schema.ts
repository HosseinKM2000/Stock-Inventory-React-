import { z } from "zod";
import { passwordSchema } from "@/shared/validation/password.schema";
import { phoneNumberSchema } from "../schemas/phoneNumberSchema";

export const registerSchema = z
  .object({
    firstName: z.string().min(2, "وارد کردن نام الزامی است!"),
    lastName: z.string().min(2, "وارد کردن نام خانوادگی الزامی است!"),
    username: z.string().min(5, "وارد کردن نام کاربری الزامی است!"),
    phone: phoneNumberSchema,
    email: z.union([
      z.literal(""),
      z.email("آدرس ایمیل صحیح نیست!"),
    ]).optional(),
    password: passwordSchema,
    repeatPassword: z.string(),
  })
  .refine((data) => data.password === data.repeatPassword, {
    message: "Passwords do not match",
    path: ["repeatPassword"],
  });
