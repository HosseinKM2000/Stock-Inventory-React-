import { beforeEach, describe, expect, it, vi } from "vitest";
import { product } from "../helpers/product";

const mocks = vi.hoisted(() => ({
  getAll: vi.fn(), requireCapability: vi.fn(), apiFetch: vi.fn(), isOffline: vi.fn(),
}));
vi.mock("@/features/app/inventory/services/inventory-service", () => ({ inventoryService: { getAll: mocks.getAll } }));
vi.mock("@/shared/access/access-state", () => ({ accessState: { requireCapability: mocks.requireCapability } }));
vi.mock("@/shared/api/client", () => ({ apiFetch: mocks.apiFetch }));
vi.mock("@/shared/lib/infrastructure/network/network-service", () => ({
  networkService: { isOffline: mocks.isOffline },
}));

import { exportService, ServerExportUnavailableError } from "@/features/setting/services/export.service";

describe("export selection and availability", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:export") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });

  it("rejects empty explicit selection", async () => {
    mocks.getAll.mockResolvedValue([product()]);
    await expect(exportService.exportLocal({ format: "csv", scope: "selected", selectedIds: [] })).rejects.toThrow();
  });

  it("exports only the selected local user's products", async () => {
    mocks.getAll.mockResolvedValue([product({ id: 1 }), product({ id: 2 }), product({ id: 3 })]);
    await expect(exportService.exportLocal({ format: "csv", scope: "selected", selectedIds: [2] })).resolves.toBe(1);
    expect(mocks.requireCapability).toHaveBeenCalledWith("export.local");
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:export");
  });

  it("includes low and out-of-stock records in the low-stock scope", async () => {
    mocks.getAll.mockResolvedValue([
      product({ id: 1, status: "in_stock" }),
      product({ id: 2, status: "low_stock" }),
      product({ id: 3, status: "out_of_stock" }),
    ]);
    await expect(exportService.exportLocal({ format: "csv", scope: "low_stock" })).resolves.toBe(2);
  });

  it("blocks server export while offline before making a request", async () => {
    mocks.isOffline.mockReturnValue(true);
    await expect(exportService.exportServer({ format: "csv", scope: "all" })).rejects.toBeInstanceOf(ServerExportUnavailableError);
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
