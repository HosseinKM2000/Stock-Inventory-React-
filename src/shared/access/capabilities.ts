/** Stable server-configurable feature identifiers. Presentation remains elsewhere. */
export const CAPABILITIES = {
  inventoryRead: "inventory.read",
  inventoryWrite: "inventory.write",
  bulkEdit: "inventory.bulk_edit",
  categoriesWrite: "categories.write",
  labelsWrite: "labels.write",
  importXlsx: "import.xlsx",
  exportLocal: "export.local",
  exportServer: "export.server",
  backup: "backup",
} as const;

export type CapabilityId = typeof CAPABILITIES[keyof typeof CAPABILITIES];
