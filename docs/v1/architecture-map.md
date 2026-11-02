# Commercial V1 architecture map

The original map was established from source commit `16064aba18c57ca92866251fcba3aca543df6409`; synchronization integrity from TZ-V1-01A, store ownership from TZ-V1-01B, and the task-branch implementation of safe restore reconciliation from TZ-V1-01C are incorporated below. Installed packages are not treated as active features without imports or call paths.

## Current module boundaries

| Area | Observed implementation and primary symbols |
|---|---|
| Application shell | React 19/Vite SPA; TanStack Router in `src/main.tsx`; generated routes in `src/routes/`; React Query in `src/shared/api/query-client.ts`; shared Radix/Tailwind UI and tokens in `src/shared/ui/` and `src/style/`. |
| Theme and scale | `AppTheme` in `src/shared/theme/app-theme.tsx`; `getDisplaySize`/`setDisplaySize` in `display-size.ts`; CSS variables and RTL/responsive rules in `src/style/index.css`. |
| PWA lifecycle | `registerServiceWorker` in `src/shared/lib/infrastructure/pwa/`; update orchestration in `src/features/app-update/`; shell/cache/message handlers in `public/sw.js`. The service worker does not own credentials or perform closed-page outbox synchronization. |
| Local data | Dexie `InventoryDatabase` versions 1–12 in `src/shared/lib/infrastructure/storage/db.ts`; actor/store keys in `keys.ts` and repository modules; products/categories/labels/barcodes/movements, sync queue, metadata/cursors, backup settings, and recovery sessions/items are IndexedDB-backed. Version 11 records attempt state/resource keys; version 12 adds durable recovery journals and review mappings. |
| Local media | OPFS access through `imageRepository`, processing through `imageService`, and object URL/authenticated fallback through `useResolvedImage` under `src/shared/lib/infrastructure/media/`. |
| Sync | Durable queue and compaction in `queue.service.ts`; transactional claim in `queue-storage.ts`; orchestration in `sync-service.ts`; multipart metadata/media push in `src/features/app/inventory/api/sync.api.ts`; service startup in `sync-bootstrap.ts`. |
| Backend | FastAPI application in `backend/app/main.py`; SQLAlchemy models in `models.py`; Alembic revisions through `20261101_0009`; PostgreSQL is the intended engine. |
| Identity/store authorization | JWT/device sessions in `auth_service.py`, `session_service.py`, and `security.py`; membership context in `store_service.active_store_context`; effective permission checks in `store_authorization.py`; request dependencies in `deps.py`. Exactly one active membership is resolved in current V1; multiple active memberships fail closed as `STORE_CONTEXT_AMBIGUOUS`. |
| Plans | Central built-in catalog in `backend/app/plans.py`; policy/entitlement resolution in `plan_policy.py` and `subscription_service.py`; frontend cached access in `src/shared/access/`. |
| Inventory and catalog | API routers for products/categories/labels/inventory/transactions scope operational access by authenticated `store_id`; frontend inventory repository/services/forms under `src/features/app/inventory/`; catalog reconciliation in `catalog_product_service._reconcile_catalog_assignments` locks and provisions eligible stores, not users. |
| Barcode and quantity | Barcode/movement repositories and `movementService` under `src/features/barcode/`; additive server application in `backend/app/routers/sync.py`; ordinary forms, quick edits, bulk edit, and import send absolute product quantities with base versions. |
| Media server | Multipart handling in `backend/app/routers/sync.py`; protected delivery in `routers/files.py`; bytes stored under the backend upload filesystem. No object-store/CDN adapter is active. |
| Backup/restore | Local snapshot/format/external destination/restore modules under `src/features/backup/services/`; `backup-restore.ts` coordinates sync/mutation locks, durable checkpoints, staged OPFS writes, and persistent review. The server snapshot endpoint remains present and server restore remains unimplemented in `backend/app/routers/backup.py`. |
| Dashboard/activity/date | Local selectors and valuation in `src/features/app/dashboard/services/`; server dashboard has different scope; store activity in `activity_service.py` and personnel activity API; shared Jalali formatters in `src/shared/lib/date/jalali.ts` and `backend/app/services/jalali_date.py`. |
| Delivery/operations | npm/Vitest/Testing Library, pytest, Playwright, Docker Compose, Alembic, and `/health`; no repository `.github` CI, deployment pipeline, monitoring/alerting, rollback automation, or server backup runbook was found. |

## End-to-end paths

### Current solo-style mutation path

1. Inventory form/service validates input and calls a local repository.
2. `local-mutation-storage.ts` commits the projection and outbox record in one Dexie transaction; UI success follows that local commit.
3. `queue.service.enqueue` consolidates pending work and schedules sync.
4. `sync-service.ts` claims due work, `sync.api.ts` sends a batch, and `backend/app/routers/sync.py` resolves membership, entitlement, permission, resource scope, version, and operation id.
5. Accepted state/change cursor is returned and reconciled into the local projection; conflicts/fatal rejections remain local recovery entries.

Operational reads, writes, bulk paths, file authorization, categories, labels, custom products, transactions, and sync pull use the authenticated store boundary. `user_id` remains on transitional tables as the original owner compatibility value; `actor_user_id` and membership IDs retain server-derived attribution. PostgreSQL relation constraints reject cross-store category, inventory, barcode, movement, and transaction references; a migration trigger protects the legacy inventory-label join shape.

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

`backupRestoreService.apply` treats a backup as untrusted input. It verifies integrity, supported/legacy shape, owner/store binding, business relationships, authority-field exclusion, operation types, and included media before touching live state. It captures the current actor/store projections, every queue state, preferences, reconciliation metadata, and available local image bytes in a durable browser-local checkpoint. The checkpoint is recovery evidence for this browser, not an independent external backup.

The recoverable state machine is `preparing -> media_staged -> database_committed -> review -> complete`. Imported media is written and verified at unique staging paths before the scoped Dexie replacement transaction. A restart at `media_staged` aborts safely and removes staging because live IndexedDB was not changed. After `database_committed`, a per-file journal copies and verifies staged bytes to live paths and resumes after interruption; cleanup follows the persisted copy marker. Missing source media remains visibly unavailable. A Web Lock shared with outbox synchronization and local mutations, plus a bounded maintenance marker, prevents a concurrent acknowledgement or local write from crossing the checkpoint/commit boundary.

The current outbox is never deleted by restore. Snapshot records and backup operations become separate persistent review evidence. Never-attempted snapshot/new recovery changes receive a new operation id only after explicit approval and pass current access/permission and base-version checks. Attempted or uncertain operations retain their original operation id and exact semantic payload so the existing idempotent server replay can return a prior result without duplicating an effect. Terminal and unknown additive outcomes cannot be guessed; they remain discardable/exportable evidence. Review-item-to-operation mapping is atomic and idempotent, and resume refuses to complete while any decision or queued result remains unresolved. Discard can remove only a never-attempted pending recovery operation and never claims to cancel a possible server effect.

Legacy backup schemas 1–4 remain readable when their data is safe and unambiguous. Imported cursors, success flags, authority, and absence-as-delete are not trusted. Restore remains owner/store-bound, offline local restore is labelled pending reconciliation, and submission still goes through the existing queue/sync acceptance path. This does not implement team operating mode, server disaster recovery, clean-device media hydration, or device-loss protection.

### Store-ownership migration and compatibility

Alembic `20261101_0009` expands `stores` with the authoritative business domain, backfills nullable operational `store_id` values first from the unique owner and then from an unambiguous membership, validates cross-store references, and only then makes ownership columns non-null and replaces owner-user uniqueness/indexes. It preserves primary keys, quantities, prices, category/transaction history, sync fingerprints, operation IDs, and cursors.

The migration deliberately raises `STORE_OWNERSHIP_PREFLIGHT:<table>:<reason>` for unresolved rows, cross-store references, or duplicate store/catalog, category, label, or actor-operation keys. The diagnostic includes the total and up to 20 affected record/group identifiers. PostgreSQL transactional DDL rolls the failed revision back to `0008`; operators must export and resolve the identified rows and retry. The migration does not select a winner, sum quantities, delete records, or rewrite operation semantics. A request committed under `20261101_0008` retains its fingerprint and recorded result and replays after upgrade without reapplying its mutation.

Schema `0009` is not rolling-compatible with pre-1B backend processes. The legacy process uses owner-user lookup/deduplication assumptions while `0009` enforces store/actor keys, so migration requires a controlled backend replacement: stop old workers, back up and preflight, apply `0009`, verify the Alembic head, then start only 1B-or-newer workers. The repository contains manual Alembic/start instructions but no automated production deployment or rollback workflow.

The local database already partitions projections, cursors, and outbox entries by actor and store. No Dexie version or backup format changed in 1B; schema-v2 backup store binding and legacy compatibility remain as before. Restore review behavior is intentionally unchanged and remains a 1C risk.

## Implementation versus confirmed target

| Topic | Observed implementation | Confirmed target |
|---|---|---|
| Ownership | Operational tables and query paths use non-null `store_id`; uniqueness and dependent relations are store-scoped. Authenticated membership selects the store, while legacy `user_id` is compatibility-only and actor fields are attribution. | Store is the business-data boundary; server-derived actor/membership is attribution only. |
| Active store | `active_store_context` accepts exactly one active membership; zero is unauthorized and multiple memberships fail closed with `STORE_CONTEXT_AMBIGUOUS`. There is no session-bound multi-store selector. | Context comes from an authenticated active membership, never a client store claim. |
| Mode | No explicit server-controlled solo/team mode; cached local-first mutations apply to team members and owners. | Solo is local-first; team shared mutations require current online authorization and acceptance. |
| Plans | Free/Starter/Pro/VIP code defaults exist; some limits/capabilities are enforced, prices/payment/grants/admin coverage are incomplete. | Free/Pro/VIP launch restrictions, explicit early-user paid grants, validated centralized admin model. |
| Operation identity | Never-attempted pending absolute mutations may compact. Attempted/uncertain payloads and additive movements are immutable; same-resource successors remain ordered. The server verifies exact replay fingerprints. | Transmitted identity/payload is immutable; new mutation gets a new identity. |
| Media | Metadata can complete without bytes; no transfer state or local rehydration. | Coordinated independent states and entitled byte recovery. |
| Backup | External local backup is store-bound. Local restore now checkpoints current work, stages media, preserves the outbox, and requires persistent apply/discard/export review; attempted/uncertain replay keeps original identity/payload. Server restore remains absent. | Independent backup plus non-destructive, authority-safe reconciliation and tested server recovery. |
| Dates | Shared Jalali formatting exists in many flows, but consistency across every input/print/export was not exhaustively verified. | One Jalali convention everywhere human-facing, Persian/Latin input digits, maintained library, offline assets. |

## Compact risk register

| ID / severity | Classification | Evidence | Affected flow | Owning task |
|---|---|---|---|---|
| SYNC-001 / resolved in TZ-V1-01A | Verified implementation and regression coverage | Attempt state is persisted before dispatch; successors use new identities and are ordered per resource; stale acknowledgements preserve/rebase newer local intent; server fingerprints exact submissions and serializes concurrent duplicate ids. SQLite and PostgreSQL regressions cover mismatch, historical rows, and concurrent equivalent replay. | The known lost-response/newer-edit path is closed. Legacy payloads overwritten before the v11 upgrade cannot be reconstructed. | 1A |
| OWN-001 / resolved in TZ-V1-01B | Verified implementation and PostgreSQL migration coverage | Operational ownership, constraints, reads/writes, sync cursors, file checks, bulk paths, and relations are store-scoped. Multiple active memberships fail closed; legacy owner fields are compatibility-only. | Owner and personnel share one authorized store projection; unrelated stores and cross-store IDs are rejected. A future multi-store selector remains out of scope. | 1B |
| CAT-001 / resolved in TZ-V1-01B | Verified implementation and PostgreSQL concurrency coverage | Reconciliation locks the catalog/store rows, selects eligible `Store.industry_id`, and relies on `(store_id, catalog_product_id)` uniqueness. | Personnel changes no longer create inventory; repeated/concurrent reconciliation preserves customer overrides and creates one assignment. | 1B |
| REST-001 / resolved on TZ-V1-01C task branch | Focused unit/browser regression coverage | Restore preserves a durable checkpoint and current outbox, journals staged media, and persists explicit reconciliation decisions. Attempted/uncertain identity and payload are immutable; unknown additive effects remain unresolved. | The known silent deletion path is closed. The checkpoint is browser-local, server restore is absent, and real process-kill/cross-browser file-system coverage remains. | 1C |
| MODE-001 / high | Confirmed policy gap | No operating-mode model; cached access plus local mutation path is shared by owner/personnel. | Team edits may appear saved locally and later be rejected. | 1 |
| MED-001 / high | Observed defect/gap | Missing OPFS bytes do not block metadata; no media queue state; remote display does not hydrate OPFS. | False completion and incomplete fresh-device/offline recovery. | 4 |
| SUB-001 / high | Observed gap | Four code plans include Starter, no complete pricing/payment/grant flow, and admin options omit effective keys. | Commercial launch and operator explainability. | 2 |
| OPS-001 / high | Unverified/absent repository evidence | No CI/deploy/monitoring/rollback/server-backup workflow in the repository. | Release, incident response, and disaster recovery. | 9 |
| UI-001 / medium | Runtime-observed defect | E2E dashboard return keeps the keyed scroll root at `scrollTop=0` in desktop and mobile. | Navigation continuity. | 8 or earlier UI maintenance |
| UI-002 / medium | Runtime-observed risk | Supplemental mobile product capture shows the connection/status notice overlapping the top search/header area. | Small-screen product usability. | 3/8 |

Passing tests establish only their covered scenarios. The covered PostgreSQL duplicate-submission serialization does not establish every multi-resource concurrency case. Recovery fault injection covers named boundaries but not a real browser-process kill. Physical peripherals, cross-browser file access, interrupted multipart upload, production deployment, device loss, and real stale-device transitions remain unverified.
