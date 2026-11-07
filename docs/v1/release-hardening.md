# TZ-V1-09A release hardening record

This record is an audit and release-evidence aid, not production approval. It used synthetic data and disposable/local infrastructure. Task 2B and Task 05B remain pending.

## Findings register

| ID | Severity | Evidence and reproduction | Affected flow | Resolution |
|---|---|---|---|---|
| RH-01 | High | An API failure had no stable identifier shared by browser, response and backend log. An injected health failure reproduced it. | Support diagnosis and unknown outcomes | Fixed. Requests have a validated/generated ID; responses expose request, build and schema context. Unhandled logs retain the ID without exception messages or bodies. |
| RH-02 | High | Nested variants such as `password_hash`, `api_key` and `set-cookie` survived activity redaction. | Activity/diagnostic confidentiality | Fixed. Keys are normalized and recursively deny-listed; focused regression covers the variants. |
| RH-03 | Medium | The browser had no bounded, offline-persistent, explicitly exported support record. | Offline/support diagnosis | Fixed. A person/store-partitioned buffer retains at most 40 entries and 48 KiB. The sync page copies/downloads a sanitized report; nothing is sent automatically. |
| RH-04 | Medium | HTTP 200 sync batches could contain rejected/conflicted commands invisible to access logs. | Sync operations | Fixed. Safe request/store/actor/operation/entity/action/status/code tuples are logged; client sync/media failures retain safe correlation locally. |
| RH-05 | High | The two-build update rehearsal predated invoices and did not assert Dexie v14 invoice evidence. The media fixture explicitly opened v13. | PWA update/offline recovery | Fixed in evidence. The update journey verifies a pending invoice and stable operation ID through activation/offline reopen; media opens v14. |
| RH-06 | Low | Representative inventory/report sizes lacked an explicit responsiveness guard. | Dashboard/reports | Fixed in evidence. Synthetic 5,000-product and 10,000-invoice runs have a conservative 3-second ceiling. |
| RH-09 | High | Two ordinary production builds both stamped service-worker build `0.12.0`; the real update test reproduced that no second worker could install unless an external build ID happened to be supplied. | PWA release/update | Fixed. Explicit `TANZIM_BUILD_ID`/CI SHA remains preferred; the safe fallback now includes UTC build time and process identity. The real two-build regression proves distinct workers. |
| RH-07 | Release blocker (pre-existing) | Deployment, production monitoring/alerting, scheduled backup retention and rollback orchestration are manual. | Production operations | Open. The local rehearsal proves mechanics only; ownership, schedule, RPO/RTO and approval remain external. |
| RH-08 | Medium (pre-existing) | Chromium is installed; Firefox/WebKit and physical scanner/camera/printer/share surfaces are unavailable here. | Cross-engine/device confidence | Open and explicit. |

## Diagnostic use

The browser sends `X-Request-ID`; the backend accepts only a bounded safe identifier or replaces it. Responses expose `X-Request-ID`, `X-Tanzim-Build` and `X-Tanzim-Schema`, including controlled 500 responses. The sync-page **گزارش امن برای پشتیبانی** action exports safe version, queue/media state and bounded entries for the active person/store partition.

The report excludes account/store identifiers, passwords, tokens, cookies, raw bodies, payloads, descriptions, images and local media paths. Stable request/operation/transfer IDs are retained so support can locate recorded evidence. Operators search by request or operation ID, inspect the stored result/fingerprint, and use exact replay/status behavior. They must not manufacture a new ID for a possibly committed command or edit an attempted payload.

## Database and media restore rehearsal

Prerequisites: isolated/stopped writers, matching PostgreSQL tools, a verified database target, durable-media access, separate free storage and the exact compatible build. Never rehearse against a production database name.

1. Stop incompatible writers and record build ID, Alembic head, database name and media root.
2. Run `pg_dump --format=custom --file=<backup.dump> <source_database>` and copy the complete media root separately.
3. Create a new empty rehearsal database; run `pg_restore --exit-on-error --no-owner --dbname=<restore_database> <backup.dump>`.
4. Compare Alembic head and table counts for stores, memberships, products, invoices/lines, movements, sync operations and media assets. Verify representative IDs, associations, fingerprints/results and actor attribution.
5. Restore media to a new empty root. Compare relative paths, counts, sizes and SHA-256 digests; sample every referenced `media_assets.storage_key`.
6. Start only a compatible worker against the rehearsal pair and perform protected reads. Preserve the source; remove only explicitly named rehearsal targets after review.

The 09A run used `tanzim_test`, separate `tanzim_restore_rehearsal` and copied synthetic media directories. A dump alone was not proof: restored table counts and relative-path media SHA-256 values were compared. This does not establish production scheduling, encryption/key custody, retention, off-site storage, RPO/RTO or disaster ownership.

Observed rehearsal result: source and restored core counts matched; a synthetic inventory row retained store `1`, actor `2`, quantity `7`, sale/purchase values, and its media-asset foreign key. The restored media row retained the same storage key, 46-byte size and SHA-256 `05d3010a…cd434dc`. The filesystem backup/restore comparison found one file and zero mismatches. Rehearsal-only database rows, restore database, dump and temporary copies were then removed; they are not recoverable and contained no customer data.

## Evidence matrix

| Boundary | Evidence type | Establishes | Limit |
|---|---|---|---|
| Signup, tenant isolation, Team/Solo, replay, revocation, invoice concurrency | Backend + disposable PostgreSQL regressions | Authorization, atomicity, constraints, idempotency | Not one continuous browser journey |
| Media fresh-profile recovery/offline reopen | Real Chromium + disposable backend/media | Protected bytes, OPFS integrity, offline decode | Synthetic account; Chromium only |
| Two-build update | Real Chromium, Cache Storage, Web Locks, IndexedDB v14, OPFS | Install/lock safety and outbox/invoice/media preservation | Mocked/aborted API; no OS kill |
| Restore review/local-only preservation | Real Chromium storage + injected interruption and unit tests | Checkpoint/merge/review persistence, pre-commit tab close | No post-commit process kill/device loss |
| Dashboard, invoices, help, diagnostics/layout | Production-preview Chromium + mocked APIs | Real routing/storage/rendering, Persian controls, reachability | Not live PostgreSQL browser evidence |
| Database/media restore | Local PostgreSQL dump/restore + filesystem hashes | Separate restored DB and byte integrity | Manual local rehearsal |
| Larger inventory/history | Synthetic selectors | 5,000 products/10,000 invoices within guard | Not a low-end device benchmark |

## Remaining release limits

- Task 2B owns final prices, tier allocations/capacities, gift/grace and Starter transition. Task 05B owns broader lifecycle/deployment policy.
- Server restore orchestration, off-site backups, monitoring/alerting, incident ownership and production rollback are not automated or approved.
- Browser-local recovery evidence cannot survive device loss; post-commit browser-process kill and other engines remain unverified.
- Media retention/GC, physical peripherals, payments/tax/partial returns/realized profit and long-term invoice numbering remain out of scope.
