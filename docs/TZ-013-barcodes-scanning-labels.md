# TZ-013 architecture: barcodes, scanning, and label printing

## Current-system audit

- Store inventory is already partitioned locally by authenticated actor and store, while the server resolves ownership from the active membership. Barcode and movement records use the same boundary.
- Inventory quantity is stored in actual units. Package scans therefore store a fixed `scan_quantity`; they never infer a future package size from a previously printed code.
- Existing product sync is idempotent by operation ID but sends absolute product snapshots. Scanner mutations use a separate additive movement command so concurrent scans are not stale overwrites.
- Private and shared catalog products both resolve to a store inventory item. Store barcode associations never modify the shared catalog record.
- The service worker precaches Vite manifest chunks. Camera fallback and barcode rendering are lazy chunks, bundled locally, and available after an online application update has completed.
- Existing browser printing is the only available printer transport. No direct USB/Bluetooth claims are made.

## Domain and synchronization

`ProductBarcode` is a store-owned association with a stable local/server ID, product ID, exact encoded string, source, symbology, unit/package meaning, fixed scan quantity, active/default flags, and sync version. The server enforces `(store_id, value)` uniqueness. Local resolution uses an IndexedDB multi-entry value index and also detects corrupted/ambiguous legacy data instead of mutating it.

`InventoryMovement` is an immutable command/history record. It contains one stable operation ID, store/product/actor attribution, `delta` or explicit correction, input source, barcode/package conversion, before/after local values, optional reversal reference, timestamps, and sync outcome. The outbox remains the only delivery queue. The server locks the inventory row, re-authorizes at acceptance time, rejects insufficient stock, and stores the operation exactly once. Undo creates one compensating movement and never deletes history.

Sync order is product, barcode, then movement. This lets an offline-created product and its barcode/movement arrive in dependency order. Older clients continue using product sync; the additive entities extend the accepted data schema without changing existing product payload meaning.

## Input and safety pipeline

Manual entry, focused HID input, native `BarcodeDetector`, and lazy-loaded ZXing all emit the same `{value, source}` event. Transport terminators are removed, but case and leading zeros are preserved. UPC/EAN equivalence is limited to the explicit UPC-A/EAN-13 leading-zero relationship after checksum validation.

The scanner always starts in read-only observation. Stock modes require an explicit choice. Single-scan changes require confirmation; continuous mode must be explicitly enabled and exposes a persistent Stop control. Camera frames are suppressed until the value leaves the frame or the user rearms; HID submissions remain independent so intentional repeated scans are accepted.

## Labels and printer boundary

Code 128 SVG rendering is separate from printing. Profiles describe thermal single-label or A4-sheet geometry in millimetres. Rendering validates available width, quiet zones, encoded length, copies, and batch size before opening an isolated print document. Browser/system print and portable HTML are supported; dialog closure is not recorded as successful printing.

## Dependencies

- `@zxing/browser`: maintained browser camera decoder fallback, dynamically imported only after camera activation.
- `bwip-js`: Code 128 SVG encoder, dynamically imported only for preview/printing.

Both are locally bundled; neither sends scanned data to an external service.

## Compatibility risks

- Printed package labels intentionally retain their fixed quantity when product packaging changes. The UI warns and requires reassignment for a different meaning.
- Offline uniqueness is checked against the current store projection. A server-only collision becomes a recoverable sync conflict; the printed identifier is not silently changed.
- Physical camera focus, scanner suffix configuration, browser print scaling, fonts, and label stock require hardware acceptance. Automated mocks verify lifecycle and event safety but do not prove a particular device.
- Existing backups without barcode/movement tables remain importable. New backups exclude authority data and bind records to the same owner/store as before.

## Verification and hardware acceptance

Automated verification covers barcode normalization/checksums, scoped IndexedDB persistence, outbox idempotence and conflict handling, label SVG geometry, production builds, offline PWA cold starts, and responsive desktop/mobile journeys. PostgreSQL migration and synchronization tests run against a disposable local test database.

Before releasing against a specific device fleet, verify each supported HID scanner sends one terminal Enter or Tab, repeated intentional scans are counted once each, rear-camera focus can read the smallest deployed label, thermal and A4 output is printed at 100%/Actual size with browser headers disabled, quiet zones remain clear after cutting, Persian product text uses the installed printer font, and browser/system cancellation is not reported as physical success. These physical checks cannot be established by automated browser mocks.
