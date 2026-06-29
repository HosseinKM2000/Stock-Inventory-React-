import { z } from "zod";

export const phoneNumberSchema = z
  .string()
  .trim()
  .min(9, "شماره تلفن معتبر نیست!")
  .max(16, "شماره تلفن معتبر نیست!")
  .min(1, "نیازه شماره تلفن رو وارد کنی!");
