import { describe, expect, it } from "vitest";
import { diagnosticErrorCode, userErrorMessage } from "@/shared/lib/presentation/user-error";

describe("user-facing errors", () => {
  it("keeps actionable Persian validation but hides raw internal codes", () => {
    expect(userErrorMessage(new Error("عنوان الزامی است."), "ثبت نشد.")).toBe("عنوان الزامی است.");
    expect(userErrorMessage(new Error("TEAM_ONLINE_REQUIRED"), "ثبت نشد.")).toContain("حالت تیمی");
    expect(userErrorMessage(new Error("NEW_SERVER_CODE"), "ثبت نشد.")).not.toContain("NEW_SERVER_CODE");
    expect(diagnosticErrorCode(new Error("NEW_SERVER_CODE"))).toBe("NEW_SERVER_CODE");
  });
});
