import { z } from "zod";
import { passwordSchema } from "@fs/validation";

export const signupSchema = z
  .object({
    firstName: z.string().min(2, "وارد کردن نام الزامی است!"),
    lastName: z.string().min(2, "وارد کردن نام خانوادگی الزامی است!"),
    username: z.string().min(5, "وارد کردن نام کاربری الزامی است!"),
    password: passwordSchema,
    repeatPassword: z.string(),
  })
  .refine((data) => data.password === data.repeatPassword, {
    message: "Passwords do not match",
    path: ["repeatPassword"],
  });
