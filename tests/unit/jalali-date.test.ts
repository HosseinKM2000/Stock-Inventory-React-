import { describe, expect, it } from "vitest";
import { formatJalaliDate, formatJalaliDateOnly, normalizeDateDigits, parseJalaliDate, parseJalaliDateTime, tehranDateRange } from "@/shared/lib/date/jalali";

describe("Jalali dates", () => {
  it("formats timestamps in Tehran with a fixed shape", () => expect(formatJalaliDate("2025-01-01T00:00:00Z")).toBe("۱۴۰۳/۱۰/۱۲"));
  it("normalizes Persian and Arabic digits", () => expect(normalizeDateDigits("۱۴۰۳/٠١/۱۲")).toBe("1403/01/12"));
  it("round trips date-only values without a timezone shift", () => { const iso = parseJalaliDate("۱۴۰۳/۱۰/۱۲"); expect(iso).toBe("2025-01-01"); expect(formatJalaliDateOnly(iso!)).toBe("۱۴۰۳/۱۰/۱۲"); });
  it("validates month lengths and leap boundaries", () => { expect(parseJalaliDate("1403/07/31")).toBeNull(); expect(parseJalaliDate("1402/12/30")).toBeNull(); expect(parseJalaliDate("1399/12/30")).toBe("2021-03-20"); });
  it("rejects ambiguous and malformed input", () => { expect(parseJalaliDate("03/10/12")).toBeNull(); expect(parseJalaliDate("1403-10-12")).toBeNull(); });
  it("creates inclusive Tehran bounds for Persian or Latin input", () => {
    expect(tehranDateRange("۱۴۰۳/۱۰/۱۲", "1403/10/12")).toEqual({
      start: "2024-12-31T20:30:00.000Z",
      end: "2025-01-01T20:29:59.999Z",
    });
  });
  it("parses a Jalali date and 24-hour Tehran time without changing the API timestamp contract", () => {
    expect(parseJalaliDateTime("۱۴۰۳/۱۰/۱۲", "۰۹:۰۵")).toBe("2025-01-01T05:35:00.000Z");
    expect(parseJalaliDateTime("1403/10/12", "24:00")).toBeNull();
  });
});
