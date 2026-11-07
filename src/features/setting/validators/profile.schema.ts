import { z } from "zod";

export const profileSchema = z.object({
  first_name: z.string().min(1, "نام الزامی است"),
  last_name: z.string().min(1, "نام خانوادگی الزامی است"),
  username: z.string().min(3, "حداقل ۳ کاراکتر"),
  email: z.string().email("ایمیل نامعتبر").or(z.literal("")),
  phone: z.string().or(z.literal("")),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;
