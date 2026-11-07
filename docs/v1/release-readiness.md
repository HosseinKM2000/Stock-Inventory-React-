# V1 release readiness

This is the current release decision for Tanzim V1. Historical task evidence remains in `progress.md`; this document does not turn old checks into fresh verification.

## Candidate identity

| Item | Accepted value |
|---|---|
| Accepted source `draft` | `6a9f4ee1e2bbe503e9a2d4897b5f2c08dc06715c` |
| Acceptance runtime candidate | `8f22fea` (`fix: preserve unresolved sync outcomes`) |
| Alembic head | `20261106_0016` |
| Browser database | Dexie v14 |
| Backup envelope | format 1, schema 5; schemas 1–5 remain readable under the documented validation rules |
| Acceptance build | package `0.12.0`, build ID `TZ-V1-09B-20261106-1` |
| Browser scope | Playwright Chromium desktop and mobile viewports on Windows; no Firefox, WebKit, or physical-device claim |

The release-header schema value was corrected from stale `0015` to `20261106_0016`. No production or customer environment was accessed.

## Current truth

Completed and freshly checked:

- Store ownership, immutable sync replay, recovery review, Solo/Team boundaries, durable media, safe PWA updates, invoices and reports remain integrated.
- Free and historical Starter cannot create/use paid invoice effects; Pro and VIP have invoice capabilities. Administrator-managed integer-Toman offer configuration exists, but checkout remains disabled.
- A `403` on a never-attempted dispatch is a definite current rejection. A `403` after a possible earlier dispatch is now retained as non-retrying, immutable, **outcome unresolved because access is denied** evidence. Renewal or reauthentication does not replay it.
- After current membership/read permission is restored, an explicit same-actor/store read-only lookup can return an already-recorded result. It cannot apply an operation, is denied while membership is revoked, projects the result through current read permissions, and returns not-recorded distinctly. The browser uses no `/sync/batch` call for this resolution.
- The existing local PostgreSQL migration/concurrency suite reached head `0016`. Real disposable-backend browser journeys covered protected media recovery and the new operation-resolution path. The real two-build journey covered service workers, Cache Storage, Web Locks, Dexie v14, OPFS, old tabs, incomplete install, and offline reopen.

Known defects or limits that are not release-critical for the technical candidate:

- Build still reports six-month-old Browserslist data and a roughly 930 kB `bwip-js` chunk.
- Product preview/detail share one derivative; media and application-cache garbage collection remain deliberately conservative.
- Invoice PDF text is Chromium-rendered imagery rather than selectable/tagged text.
- The 110-case browser pass had one late mobile preview load time out on a blank document. The exact case then passed 3/3 under the same final build; this is recorded as an investigated test-harness/preview interruption, not silently erased.

Unverified environments and operations:

- Firefox, WebKit/Safari, physical Android/desktop hardware, real camera/scanner/printer/share sheets, and OS/browser-process kills.
- The production host, secrets, TLS/proxy, CORS, durable-media mount, disk capacity, worker replacement, service-worker publication, external backup storage, monitoring, alerting, and incident response.
- The latest database-plus-media restore rehearsal is the disposable/local RH-09 rehearsal recorded in `release-hardening.md`; it matched database counts and one media path/size/SHA-256. It was not rerun against, and does not verify, the target environment.

Unresolved business decisions:

- Actual Pro/VIP Toman prices and billing terms; no offer should be enabled until explicitly approved.
- Remaining tier capabilities and inventory/personnel capacities.
- Gift eligibility, audience and duration; expiry/grace and retention rules.
- Existing Starter transition. Silent remapping remains forbidden.
- Payment provider, checkout/callback/idempotency/refund/reconciliation and operational ownership.

## Fresh acceptance evidence

| Evidence boundary | Result |
|---|---|
| Frontend unit/component | PASS — 86 files, 375 tests |
| Backend fast/API | PASS — 88 tests |
| Isolated PostgreSQL | PASS — 19 tests, migrations through `0016` plus existing concurrency checks |
| Typecheck / lint / final build | PASS / PASS / PASS; final service worker contains the exact acceptance build ID; existing warnings above remain |
| Production-preview browser matrix | 110 cases: 101 passed, 1 investigated blank-document timeout, 8 environment-gated skips. The failed case passed 3/3 focused reruns. API acceptance in this matrix is mocked unless a spec says otherwise. |
| Real media browser/backend | PASS — desktop/mobile, disposable SQLite API/media directory, protected download, SHA-256, OPFS and offline decode |
| Real resolution browser/backend | PASS — desktop/mobile full application UI against disposable API; one read-only result lookup, zero batch replay, one recorded operation/domain effect |
| Real two-build PWA | PASS — desktop/mobile; real browser storage/service worker but mocked/aborted business API |

Synthetic storage pages, mocked browser APIs, API tests, PostgreSQL checks, and full application journeys are separate evidence and are not interchangeable. Live-credential authentication remained skipped. Disposable SQLite browser journeys do not replace PostgreSQL concurrency evidence.

## Controlled release and recovery sequence

The release owner must fill every bracketed value and retain command/output evidence.

1. Assign `[release owner]`, `[database/media backup operator]`, `[health/log/disk observer]`, and `[incident/rollback owner]`. These assignments are unresolved today.
2. Verify the target has supported Node/Python/PostgreSQL versions, production `SECRET_KEY`, `DATABASE_URL`, exact `CORS_ORIGINS`, TLS/proxy settings, and an absolute durable `MEDIA_STORAGE_DIR` with checked free space and service-account permissions. Confirm the candidate commit and build ID.
3. Create coordinated, timestamped PostgreSQL and durable-media backups. Restore both into an isolated target-like environment; verify Alembic revision, core row counts, media associations, sampled file paths/sizes/SHA-256, and authenticated protected reads. A backup without a successful paired restore check is not release approval.
4. Stop all pre-`0016` workers and prevent writes. Keep the prior supported immutable frontend asset generation available. Do not clear browser storage.
5. From `backend/`, run `alembic current`, rehearse/inspect the full preflight path on the restored copy, then run `alembic upgrade head` on the stopped target. Require `alembic current` to report `20261106_0016`; on preflight failure, leave workers stopped and remediate the reported source records explicitly.
6. Start only candidate-compatible backend workers. Check `/api/health`, `X-Tanzim-Build`, `X-Tanzim-Schema`, database connectivity, durable-media read/write, authentication, store isolation, and sanitized request-ID logs before admitting users.
7. Upload every immutable frontend asset first, verify availability, then publish `sw.js` last. Preserve the prior supported asset generation for open old tabs.
8. Smoke-test signup/profile, Solo offline edit/reopen/sync, Team accepted mutation, invoice historical read and permitted posting, protected media recovery, local backup export/review, dashboard navigation, entitlement denial, and explicit unresolved-operation lookup. Use synthetic release accounts only.
9. During the limited window, the named operator records health, error rate/request IDs, database and media disk growth, failed sync/media outcomes, backup completion and restore-check results. No such owner or production monitoring is currently configured in repository evidence.

Before database/local-schema advancement, stop and restore the complete previous backend/frontend/database/media set if a smoke gate fails. After Alembic or Dexie advancement, do not mix old workers or clear browser data; keep traffic stopped and use only a reviewed compatible downgrade with its preflight, or a forward fix. Unknown sync outcomes and recovery evidence must survive either path.

## Readiness decisions

1. **Technical candidate — PASS.** The scoped V1 candidate passes the automated local/disposable acceptance boundary, including the corrected lifecycle edge. This is not production-environment approval.
2. **Limited early-user release — BLOCKED.** Select the actual plan/offer configuration, grant eligibility and duration (or explicitly choose no grants), prepare and restore-test the target, assign operators, and complete the physical-device checklist below.
3. **Public paid launch — BLOCKED.** Checkout is intentionally `PAYMENT_PROVIDER_NOT_CONFIGURED`; actual prices/terms and remaining commercial policies are not approved, and provider callback/reconciliation/refund operations are neither implemented nor verified.

## Physical Android/desktop checklist

All items are currently **UNVERIFIED** and require results recorded per device/browser/version:

- Install PWA, close it, reopen offline, visit previously unvisited supported routes, then reconnect and update.
- Create local work offline; confirm it survives app/browser restart and synchronizes without identity change.
- Export a local backup, grant/deny file permissions, import into recovery review, and verify no authority is restored.
- Exercise camera barcode capture and supported hardware scanner input; verify cancellation and permission denial.
- Download invoice PDF; check Persian layout, multipage/cancelled output and local file permissions.
- Exercise native print and share surfaces where supported; confirm fallback download where not supported.
- Install build A, leave an old tab open, activate build B with pending durable evidence, and verify old/new tabs plus offline reopen.
