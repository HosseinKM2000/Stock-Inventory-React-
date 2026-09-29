import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "Password must be at most 72 UTF-8 bytes",
  )
  .regex(/[A-Z]/, "Must include one uppercase letter")
  .regex(/[a-z]/, "Must include one lowercase letter")
  .regex(/[0-9]/, "Must include one number");
