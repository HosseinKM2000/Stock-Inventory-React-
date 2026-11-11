import { describe, expect, it } from "vitest";
import { loginSchema } from "@/features/auth/validators/login.schema";
import { registerSchema } from "@/features/auth/validators/register.schema";
import { passwordSchema } from "@/shared/validation/password.schema";

describe("authentication validation", () => {
  it("trims a valid login username and rejects missing credentials", () => {
    const result = loginSchema.parse({ username: "  tester  ", password: "secret" });
    expect(result.username).toBe("tester");
    expect(result.remember).toBe(false);
    expect(loginSchema.safeParse({ username: " ", password: "" }).success).toBe(false);
  });

  it.each(["09123456789", "+989123456789", "۰۹۱۲۳۴۵۶۷۸۹", "٠٩١٢٣٤٥٦٧٨٩"])(
    "accepts and canonicalizes mobile login identifier %s",
    (username) => {
      expect(loginSchema.parse({ username, password: "secret", remember: true })).toEqual({
        username: "09123456789",
        password: "secret",
        remember: true,
      });
    },
  );

  it("rejects a phone-shaped but invalid login identifier", () => {
    expect(loginSchema.safeParse({ username: "09123", password: "secret" }).success).toBe(false);
  });

  it.each(["ab", "9owner", "owner name", "مالک"])("rejects invalid registration username %s", (username) => {
    expect(registerSchema.safeParse({
      username,
      phone: "09123456789",
      password: "StrongPass123!",
      repeatPassword: "StrongPass123!",
    }).success).toBe(false);
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
      phone: "09123456789",
      password: "StrongPass123!",
      repeatPassword: "DifferentPass123!",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === "repeatPassword")).toBe(true);
  });

  it("normalizes Iranian mobile forms and keeps confirmation out of the server payload", () => {
    const values = registerSchema.parse({
      username: "  new-owner  ",
      phone: "+۹۸۹۱۲۳۴۵۶۷۸۹",
      password: "StrongPass123!",
      repeatPassword: "StrongPass123!",
    });
    expect(values.username).toBe("new-owner");
    expect(values.phone).toBe("09123456789");
    expect({ username: values.username, phone: values.phone, password: values.password }).toEqual({
      username: "new-owner",
      phone: "09123456789",
      password: "StrongPass123!",
    });
  });

  it.each(["09123456789", "+989123456789", "00989123456789", "۰۹۱۲۳۴۵۶۷۸۹", "٠٩١٢٣٤٥٦٧٨٩"])(
    "normalizes equivalent mobile %s",
    (phone) => {
      const values = registerSchema.parse({
        username: "owner",
        phone,
        password: "StrongPass123!",
        repeatPassword: "StrongPass123!",
      });
      expect(values.phone).toBe("09123456789");
    },
  );

  it("uses the exact Persian minimum-length feedback", () => {
    const result = registerSchema.safeParse({
      username: "owner",
      phone: "09123456789",
      password: "Aa1short",
      repeatPassword: "Aa1short",
    });
    expect(result.success).toBe(true);

    const tooShort = registerSchema.safeParse({
      username: "owner",
      phone: "09123456789",
      password: "Aa1tiny",
      repeatPassword: "Aa1tiny",
    });
    expect(tooShort.success).toBe(false);
    if (!tooShort.success) {
      expect(tooShort.error.issues.some((issue) => issue.message === "رمز عبور باید حداقل ۸ کاراکتر داشته باشد.")).toBe(true);
    }
  });

  it.each(["", "02112345678", "+12025550123", "09123abc789"])(
    "rejects invalid mobile %s with the stable Persian message",
    (phone) => {
      const result = registerSchema.safeParse({
        username: "owner",
        phone,
        password: "StrongPass123!",
        repeatPassword: "StrongPass123!",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path[0] === "phone" && issue.message === "شماره موبایل معتبر نیست.")).toBe(true);
      }
    },
  );
});
