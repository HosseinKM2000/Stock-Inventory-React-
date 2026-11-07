export type BarcodeSource = "manufacturer" | "tanzim";
export type BarcodeSymbology = "code128" | "ean13" | "ean8" | "upca" | "upce" | "unknown";
export type BarcodeMeaning = "unit" | "package";

export type ProductBarcode = {
  id: number;
  local_key?: string;
  local_user_id?: number;
  local_store_id?: number;
  store_id?: number;
  product_id: number;
  value: string;
  source: BarcodeSource;
  symbology: BarcodeSymbology;
  meaning: BarcodeMeaning;
  scan_quantity: number;
  is_active: boolean;
  is_default: boolean;
  version?: number;
  created_at: string;
  updated_at: string;
};

export type ScanInputSource = "manual" | "hardware" | "camera";
export type InventoryMovementKind = "receive" | "issue" | "correction" | "reversal";
export type InventoryMovementSyncStatus = "pending" | "accepted" | "rejected" | "conflict";

export type InventoryMovement = {
  id: number;
  local_key?: string;
  local_user_id?: number;
  local_store_id?: number;
  operation_id: string;
  product_id: number;
  actor_user_id: number;
  actor_membership_id: number | null;
  kind: InventoryMovementKind;
  delta: number;
  correction_quantity: number | null;
  scan_source: ScanInputSource;
  barcode_id: number | null;
  barcode_value: string | null;
  scan_quantity: number;
  before_quantity: number;
  after_quantity: number;
  reverses_operation_id: string | null;
  sync_status: InventoryMovementSyncStatus;
  created_at: string;
  updated_at: string;
};

export type LabelProfileKind = "thermal" | "a4";
export type LabelProfile = {
  id: string;
  name: string;
  kind: LabelProfileKind;
  widthMm: number;
  heightMm: number;
  marginMm: number;
  horizontalGapMm: number;
  verticalGapMm: number;
  columns: number;
  showPrice: boolean;
  showStoreName: boolean;
  showPackageQuantity: boolean;
};
