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
      firstName: "Test",
      lastName: "User",
      username: "tester",
      phone: "09123456789",
      email: "",
      password: "StrongPass123!",
      repeatPassword: "DifferentPass123!",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === "repeatPassword")).toBe(true);
  });
});
