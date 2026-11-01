# Commercial V1 architecture map

Evidence is from source commit `16064aba18c57ca92866251fcba3aca543df6409`. Installed packages are not treated as active features without imports or call paths. The earlier audit under `docs/audits/` was used as an index and rechecked against the unchanged implementation commit.

## Current module boundaries

| Area | Observed implementation and primary symbols |
|---|---|
| Application shell | React 19/Vite SPA; TanStack Router in `src/main.tsx`; generated routes in `src/routes/`; React Query in `src/shared/api/query-client.ts`; shared Radix/Tailwind UI and tokens in `src/shared/ui/` and `src/style/`. |
| Theme and scale | `AppTheme` in `src/shared/theme/app-theme.tsx`; `getDisplaySize`/`setDisplaySize` in `display-size.ts`; CSS variables and RTL/responsive rules in `src/style/index.css`. |
| PWA lifecycle | `registerServiceWorker` in `src/shared/lib/infrastructure/pwa/`; update orchestration in `src/features/app-update/`; shell/cache/message handlers in `public/sw.js`. The service worker does not own credentials or perform closed-page outbox synchronization. |
| Local data | Dexie `InventoryDatabase` versions 1–10 in `src/shared/lib/infrastructure/storage/db.ts`; actor/store keys in `keys.ts` and repository modules; products/categories/labels/barcodes/movements, sync queue, metadata/cursors, and backup settings are IndexedDB-backed. |
| Local media | OPFS access through `imageRepository`, processing through `imageService`, and object URL/authenticated fallback through `useResolvedImage` under `src/shared/lib/infrastructure/media/`. |
| Sync | Durable queue and compaction in `queue.service.ts`; transactional claim in `queue-storage.ts`; orchestration in `sync-service.ts`; multipart metadata/media push in `src/features/app/inventory/api/sync.api.ts`; service startup in `sync-bootstrap.ts`. |
| Backend | FastAPI application in `backend/app/main.py`; SQLAlchemy models in `models.py`; Alembic revisions through `20261017_0007`; PostgreSQL is the intended engine. |
| Identity/store authorization | JWT/device sessions in `auth_service.py`, `session_service.py`, and `security.py`; membership context in `store_service.active_store_context`; effective permission checks in `store_authorization.py`; request dependencies in `deps.py`. |
| Plans | Central built-in catalog in `backend/app/plans.py`; policy/entitlement resolution in `plan_policy.py` and `subscription_service.py`; frontend cached access in `src/shared/access/`. |
| Inventory and catalog | API routers for products/categories/labels/inventory/transactions; frontend inventory repository/services/forms under `src/features/app/inventory/`; catalog reconciliation in `catalog_product_service._reconcile_catalog_assignments`. |
| Barcode and quantity | Barcode/movement repositories and `movementService` under `src/features/barcode/`; additive server application in `backend/app/routers/sync.py`; ordinary forms, quick edits, bulk edit, and import send absolute product quantities with base versions. |
| Media server | Multipart handling in `backend/app/routers/sync.py`; protected delivery in `routers/files.py`; bytes stored under the backend upload filesystem. No object-store/CDN adapter is active. |
| Backup/restore | Local snapshot/format/external destination/restore modules under `src/features/backup/services/`; server snapshot endpoint and unimplemented server restore in `backend/app/routers/backup.py`. |
| Dashboard/activity/date | Local selectors and valuation in `src/features/app/dashboard/services/`; server dashboard has different scope; store activity in `activity_service.py` and personnel activity API; shared Jalali formatters in `src/shared/lib/date/jalali.ts` and `backend/app/services/jalali_date.py`. |
| Delivery/operations | npm/Vitest/Testing Library, pytest, Playwright, Docker Compose, Alembic, and `/health`; no repository `.github` CI, deployment pipeline, monitoring/alerting, rollback automation, or server backup runbook was found. |

## End-to-end paths

### Current solo-style mutation path

1. Inventory form/service validates input and calls a local repository.
2. `local-mutation-storage.ts` commits the projection and outbox record in one Dexie transaction; UI success follows that local commit.
3. `queue.service.enqueue` consolidates pending work and schedules sync.
4. `sync-service.ts` claims due work, `sync.api.ts` sends a batch, and `backend/app/routers/sync.py` resolves membership, entitlement, permission, resource scope, version, and operation id.
5. Accepted state/change cursor is returned and reconciled into the local projection; conflicts/fatal rejections remain local recovery entries.

This path is active for both owners and personnel when cached access allows it. There is no explicit operating-mode field or team-only server-acceptance mutation path.

### Target team mutation path (not implemented)

The server-controlled mode must be read with current membership/entitlement. In `team`, UI input may be retained as an actor/store-scoped draft, but the shared projection changes only after an online server request is authorized and accepted. Owner and personnel follow the same acceptance boundary. Mode activation must first reconcile queued and stale-device work.

### Synchronization and retry

`queueStorage.claim` leases work; expired in-flight items can retry. Server `SyncOperation` deduplicates by legacy owner/operation identity and stores the result. Rejected operations are classified per item. However, a `retryable_error` item can currently receive a new merged payload while retaining the transmitted `operationId`, so a cached response for the old payload may acknowledge and remove the new edit.

### Media

Forms process/store local image bytes in OPFS and put the local reference in product metadata. During product sync, `pushProductBatch` attaches readable local bytes; missing bytes are intentionally ignored so metadata still proceeds. The backend writes a protected filesystem object and returns a URL. A clean client can display authenticated remote bytes but does not hydrate them into OPFS, and the queue has no independent media state.

### Restore

`backupRestoreService.apply` verifies owner/store binding, writes a recovery copy, restores image bytes, replaces actor/store projections, deletes the current actor queue, and reintroduces backup operations as conflict entries with new ids. `resumeSynchronization` then deletes every `RESTORED_BACKUP_REVIEW_REQUIRED` entry before synchronizing. This prevents blind replay but can discard restored local-only work instead of reconciling it.

## Implementation versus confirmed target

| Topic | Observed implementation | Confirmed target |
|---|---|---|
| Ownership | Membership resolves a store, but important tables, uniqueness, sync identity, and catalog provisioning still use legacy owner `user_id`. | Store is the business-data boundary; server-derived actor/membership is attribution only. |
| Active store | `active_store_context` selects the first membership, preferring owner; there is no session-bound selector. | Context comes from an authenticated active membership, never a client store claim. |
| Mode | No explicit server-controlled solo/team mode; cached local-first mutations apply to team members and owners. | Solo is local-first; team shared mutations require current online authorization and acceptance. |
| Plans | Free/Starter/Pro/VIP code defaults exist; some limits/capabilities are enforced, prices/payment/grants/admin coverage are incomplete. | Free/Pro/VIP launch restrictions, explicit early-user paid grants, validated centralized admin model. |
| Operation identity | Pending/retryable payloads can be merged under an existing operation id. | Transmitted identity/payload is immutable; new mutation gets a new identity. |
| Media | Metadata can complete without bytes; no transfer state or local rehydration. | Coordinated independent states and entitled byte recovery. |
| Backup | External local backup is real and store-bound; restore queue review currently ends by deleting restored operations; server restore is absent. | Independent backup plus non-destructive, authority-safe reconciliation and tested server recovery. |
| Dates | Shared Jalali formatting exists in many flows, but consistency across every input/print/export was not exhaustively verified. | One Jalali convention everywhere human-facing, Persian/Latin input digits, maintained library, offline assets. |

## Compact risk register

| ID / severity | Classification | Evidence | Affected flow | Owning task |
|---|---|---|---|---|
| SYNC-001 / critical | Observed static defect | `queue.service.enqueue` reuses `operationId` for `retryable_error`; server sync deduplicates and returns the prior result. No direct fault-injection test. | Lost-response retry followed by a newer edit can silently lose the edit. | 1 |
| OWN-001 / critical | Observed architectural defect | `store_data_owner_id`, legacy `user_id` constraints/models, and sync keys remain owner-user-based. | Ownership, migration, future multi-store, authorization proofs. | 1 |
| CAT-001 / critical | Observed static defect | `_reconcile_catalog_assignments` selects `User` by industry and creates `InventoryItem(user_id=...)`. | Personnel can receive separate/inaccessible catalog rows instead of store rows. | 1 |
| REST-001 / critical | Observed static defect | Restore deletes the current queue; resume deletes restored conflict entries before pull/sync. | Local-only restored or pre-restore work can be discarded. | 1 |
| MODE-001 / high | Confirmed policy gap | No operating-mode model; cached access plus local mutation path is shared by owner/personnel. | Team edits may appear saved locally and later be rejected. | 1 |
| MED-001 / high | Observed defect/gap | Missing OPFS bytes do not block metadata; no media queue state; remote display does not hydrate OPFS. | False completion and incomplete fresh-device/offline recovery. | 4 |
| SUB-001 / high | Observed gap | Four code plans include Starter, no complete pricing/payment/grant flow, and admin options omit effective keys. | Commercial launch and operator explainability. | 2 |
| OPS-001 / high | Unverified/absent repository evidence | No CI/deploy/monitoring/rollback/server-backup workflow in the repository. | Release, incident response, and disaster recovery. | 9 |
| UI-001 / medium | Runtime-observed defect | E2E dashboard return keeps the keyed scroll root at `scrollTop=0` in desktop and mobile. | Navigation continuity. | 8 or earlier UI maintenance |
| UI-002 / medium | Runtime-observed risk | Supplemental mobile product capture shows the connection/status notice overlapping the top search/header area. | Small-screen product usability. | 3/8 |

Passing tests establish only their covered scenarios. PostgreSQL concurrency, real process-kill points, physical peripherals, cross-browser file access, interrupted multipart upload, production deployment, and real stale-device transitions remain unverified.
