import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must include one uppercase letter")
  .regex(/[a-z]/, "Must include one lowercase letter")
  .regex(/[0-9]/, "Must include one number");
