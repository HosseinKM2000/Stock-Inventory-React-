import { describe, expect, it } from "vitest";
import { formatJalaliDate, formatJalaliDateOnly, normalizeDateDigits, parseJalaliDate } from "@/shared/lib/date/jalali";

describe("Jalali dates", () => {
  it("formats timestamps in Tehran with a fixed shape", () => expect(formatJalaliDate("2025-01-01T00:00:00Z")).toBe("۱۴۰۳/۱۰/۱۲"));
  it("normalizes Persian and Arabic digits", () => expect(normalizeDateDigits("۱۴۰۳/٠١/۱۲")).toBe("1403/01/12"));
  it("round trips date-only values without a timezone shift", () => { const iso = parseJalaliDate("۱۴۰۳/۱۰/۱۲"); expect(iso).toBe("2025-01-01"); expect(formatJalaliDateOnly(iso!)).toBe("۱۴۰۳/۱۰/۱۲"); });
  it("validates month lengths and leap boundaries", () => { expect(parseJalaliDate("1403/07/31")).toBeNull(); expect(parseJalaliDate("1402/12/30")).toBeNull(); expect(parseJalaliDate("1399/12/30")).toBe("2021-03-20"); });
  it("rejects ambiguous and malformed input", () => { expect(parseJalaliDate("03/10/12")).toBeNull(); expect(parseJalaliDate("1403-10-12")).toBeNull(); });
});
