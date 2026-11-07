# Commercial V1 architecture map

Evidence is from source commit `16064aba18c57ca92866251fcba3aca543df6409`. Installed packages are not treated as active features without imports or call paths. The earlier audit under `docs/audits/` was used as an index and rechecked against the unchanged implementation commit.

## Current module boundaries

| Area | Observed implementation and primary symbols |
|---|---|
| Application shell | React 19/Vite SPA; TanStack Router in `src/main.tsx`; generated routes in `src/routes/`; React Query in `src/shared/api/query-client.ts`; shared Radix/Tailwind UI and tokens in `src/shared/ui/` and `src/style/`. |
| Theme and scale | `AppTheme` in `src/shared/theme/app-theme.tsx`; `getDisplaySize`/`setDisplaySize` in `display-size.ts`; CSS variables and RTL/responsive rules in `src/style/index.css`. |
| PWA lifecycle | `registerServiceWorker` in `src/shared/lib/infrastructure/pwa/`; update orchestration in `src/features/app-update/`; shell/cache/message handlers in `public/sw.js`. The service worker does not own credentials or perform closed-page outbox synchronization. |
| Local data | Dexie `InventoryDatabase` versions 1–11 in `src/shared/lib/infrastructure/storage/db.ts`; actor/store keys in `keys.ts` and repository modules; products/categories/labels/barcodes/movements, sync queue, metadata/cursors, and backup settings are IndexedDB-backed. Version 11 records attempt state and a logical resource key for queued operations. |
| Local media | OPFS access through `imageRepository`, processing through `imageService`, and object URL/authenticated fallback through `useResolvedImage` under `src/shared/lib/infrastructure/media/`. |
| Sync | Durable queue and compaction in `queue.service.ts`; transactional claim in `queue-storage.ts`; orchestration in `sync-service.ts`; multipart metadata/media push in `src/features/app/inventory/api/sync.api.ts`; service startup in `sync-bootstrap.ts`. |
| Backend | FastAPI application in `backend/app/main.py`; SQLAlchemy models in `models.py`; Alembic revisions through `20261101_0008`; PostgreSQL is the intended engine. |
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

The verified SYNC-001 root cause had two cooperating parts: client compaction could replace the payload of a `retryable_error` operation while retaining its already-transmitted id, and acknowledgement reconciliation could write the older server record before accounting for a newer successor. Server deduplication then correctly returned A's recorded result, but the client could misapply it to the mutated local snapshot and lose edit B.

`queueStorage.claim` durably records an attempt before dispatch and leases the operation. Only never-attempted pending absolute mutations may compact; after any possible transmission the operation identity and payload are frozen, and a later edit receives a new operation id. Additive inventory movements never compact. Queue selection preserves order per logical resource while allowing independent resources to progress. An accepted predecessor may update only a `pending`/`never` successor's base version to the predecessor's accepted version, without changing its identity or business intent. The server still compares that base with its current version, so an intervening update from another device produces a conflict rather than being overwritten.

Server `SyncOperation` stores a canonical SHA-256 request fingerprint with the result. An exact replay returns the recorded result; reuse of an operation id with different semantics is a terminal `OPERATION_PAYLOAD_MISMATCH`. Historical rows without a fingerprint are rejected conservatively as `OPERATION_PAYLOAD_UNVERIFIED`. PostgreSQL advisory serialization and one transaction cover duplicate detection, domain application, and result persistence for a given actor/operation id.

Dexie version 11 marks pre-existing queue entries with unknown attempt history as `uncertain`, so they cannot be compacted after upgrade. This preserves their current payload and backup compatibility, but it cannot reconstruct an older payload that a previous application version had already overwritten before the migration.

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
| Operation identity | Never-attempted pending absolute mutations may compact. Attempted/uncertain payloads and additive movements are immutable; same-resource successors remain ordered. The server verifies exact replay fingerprints. | Transmitted identity/payload is immutable; new mutation gets a new identity. |
| Media | Metadata can complete without bytes; no transfer state or local rehydration. | Coordinated independent states and entitled byte recovery. |
| Backup | External local backup is real and store-bound; restore queue review currently ends by deleting restored operations; server restore is absent. | Independent backup plus non-destructive, authority-safe reconciliation and tested server recovery. |
| Dates | Shared Jalali formatting exists in many flows, but consistency across every input/print/export was not exhaustively verified. | One Jalali convention everywhere human-facing, Persian/Latin input digits, maintained library, offline assets. |

## Compact risk register

| ID / severity | Classification | Evidence | Affected flow | Owning task |
|---|---|---|---|---|
| SYNC-001 / resolved in TZ-V1-01A | Verified implementation and regression coverage | Attempt state is persisted before dispatch; successors use new identities and are ordered per resource; stale acknowledgements preserve/rebase newer local intent; server fingerprints exact submissions and serializes concurrent duplicate ids. SQLite and PostgreSQL regressions cover mismatch, historical rows, and concurrent equivalent replay. | The known lost-response/newer-edit path is closed. Legacy payloads overwritten before the v11 upgrade cannot be reconstructed. | 1A |
| OWN-001 / critical | Observed architectural defect | `store_data_owner_id`, legacy `user_id` constraints/models, and sync keys remain owner-user-based. | Ownership, migration, future multi-store, authorization proofs. | 1 |
| CAT-001 / critical | Observed static defect | `_reconcile_catalog_assignments` selects `User` by industry and creates `InventoryItem(user_id=...)`. | Personnel can receive separate/inaccessible catalog rows instead of store rows. | 1 |
| REST-001 / critical | Observed static defect | Restore deletes the current queue; resume deletes restored conflict entries before pull/sync. | Local-only restored or pre-restore work can be discarded. | 1 |
| MODE-001 / high | Confirmed policy gap | No operating-mode model; cached access plus local mutation path is shared by owner/personnel. | Team edits may appear saved locally and later be rejected. | 1 |
| MED-001 / high | Observed defect/gap | Missing OPFS bytes do not block metadata; no media queue state; remote display does not hydrate OPFS. | False completion and incomplete fresh-device/offline recovery. | 4 |
| SUB-001 / high | Observed gap | Four code plans include Starter, no complete pricing/payment/grant flow, and admin options omit effective keys. | Commercial launch and operator explainability. | 2 |
| OPS-001 / high | Unverified/absent repository evidence | No CI/deploy/monitoring/rollback/server-backup workflow in the repository. | Release, incident response, and disaster recovery. | 9 |
| UI-001 / medium | Runtime-observed defect | E2E dashboard return keeps the keyed scroll root at `scrollTop=0` in desktop and mobile. | Navigation continuity. | 8 or earlier UI maintenance |
| UI-002 / medium | Runtime-observed risk | Supplemental mobile product capture shows the connection/status notice overlapping the top search/header area. | Small-screen product usability. | 3/8 |

Passing tests establish only their covered scenarios. The covered PostgreSQL duplicate-submission serialization does not establish every multi-resource concurrency case. Real process-kill points, physical peripherals, cross-browser file access, interrupted multipart upload, production deployment, and real stale-device transitions remain unverified.
