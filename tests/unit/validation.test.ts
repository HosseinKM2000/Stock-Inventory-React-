import { describe, expect, it } from "vitest";
import { loginSchema } from "@/features/auth/validators/login.schema";
import { registerSchema } from "@/features/auth/validators/register.schema";
import { passwordSchema } from "@/shared/validation/password.schema";

describe("authentication validation", () => {
  it("trims a valid login username and rejects missing credentials", () => {
    expect(loginSchema.parse({ username: "  tester  ", password: "secret" }).username).toBe("tester");
    expect(loginSchema.safeParse({ username: " ", password: "" }).success).toBe(false);
  });

  it.each(["short1A", "alllowercase1", "ALLUPPERCASE1", "NoNumberHere"])(
    "rejects weak password %s",
    (password) => expect(passwordSchema.safeParse(password).success).toBe(false),
  );

  it("enforces bcrypt's UTF-8 byte boundary", () => {
    expect(passwordSchema.safeParse(`A1a${"é".repeat(35)}`).success).toBe(false);
  });

  it("requires password confirmation at registration", () => {
    const result = registerSchema.safeParse({
      username: "tester",
      password: "StrongPass123!",
      repeatPassword: "DifferentPass123!",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === "repeatPassword")).toBe(true);
  });

  it("accepts the minimal signup shape and keeps confirmation out of the server payload", () => {
    const values = registerSchema.parse({
      username: "  new-owner  ",
      password: "StrongPass123!",
      repeatPassword: "StrongPass123!",
    });
    expect(values.username).toBe("new-owner");
    expect({ username: values.username, password: values.password }).toEqual({
      username: "new-owner",
      password: "StrongPass123!",
    });
  });

  it("uses the exact Persian minimum-length feedback", () => {
    const result = registerSchema.safeParse({
      username: "owner",
      password: "Aa1short",
      repeatPassword: "Aa1short",
    });
    expect(result.success).toBe(true);

    const tooShort = registerSchema.safeParse({
      username: "owner",
      password: "Aa1tiny",
      repeatPassword: "Aa1tiny",
    });
    expect(tooShort.success).toBe(false);
    if (!tooShort.success) {
      expect(tooShort.error.issues.some((issue) => issue.message === "رمز عبور باید حداقل ۸ کاراکتر داشته باشد.")).toBe(true);
    }
  });
});
