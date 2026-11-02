# Commercial V1 baseline progress

## Snapshot

- Baseline date: 2026-11-01 (Asia/Tehran)
- Task branch: `chore/v1-baseline`
- Source branch/commit: local `draft` at `16064aba18c57ca92866251fcba3aca543df6409`
- Remote check: fetched `origin`; `origin/draft` is `c0de63392602e634c55d596524da81c065dd3dba` and is an ancestor of local `draft`. There is no divergence; local is ahead.
- Initial worktree: clean. No application behavior, dependency version, schema, customer data, or visual design was changed.
- Implementation delta since the earlier audited commit `e719c7f`: only the two files under `docs/audits/`; runtime implementation is unchanged.

## Fresh baseline checks

Environment: Windows/PowerShell, Node `v24.12.0`, npm `10.8.1`, Python `3.13.13`, Docker `29.2.0`, Chromium supplied by Playwright `1.62.1`.

| Command | Result | Evidence / limitation |
|---|---|---|
| `npm.cmd test` | Passed | 69 files, 265 unit/component tests. |
| `npm.cmd run test:typecheck` | Passed | `tsc --noEmit -p tsconfig.test.json`. |
| `npm.cmd run lint` | Passed | ESLint exit 0. |
| `npm.cmd run build` | Passed with warnings | Vite `8.0.16`; stale Browserslist data and chunks over 500 kB (largest reported `bwip-js` chunk about 930 kB). No dependencies were changed. |
| `.\.venv\Scripts\python.exe -m pytest -c backend\pytest.ini backend\tests --ignore=backend\tests\test_postgresql.py` | Passed | 42 tests using disposable SQLite fixtures; this is not PostgreSQL evidence. |
| `npm.cmd run test:backend:postgres:local` | Passed with warning | 6 tests against local disposable PostgreSQL database `tanzim_test`: migrations, constraints, auth/session, concurrent device admission, admin immutability, expiry. Pytest could not write its cache due to workspace permissions. |
| `npm.cmd run test:e2e -- --workers=1` with production preview | Failed | 76 cases: 71 passed, 3 failed, 2 credential-gated authentication cases skipped. Persistent failures: dashboard scroll restoration, desktop and mobile. Transient failure: desktop display scaling. |
| `npx.cmd playwright test --last-failed --workers=1` | Failed | 3 selected: theme scaling passed; dashboard scroll failed again in both projects with `scrollTop=0`. |
| Temporary isolated UI capture spec | Passed | 1 capture journey; the temporary spec was removed and did not change the test suite. |

The production preview used the fresh build at `127.0.0.1:4173`, API mocks, isolated browser contexts/profiles, and synthetic non-personal data. No destructive seed, restore, or migration touched a non-test database.

## TZ-V1-01A synchronization integrity

Branch `fix/v1-sync-operation-integrity` closes the known lost-edit sequence without changing UI, commercial policy, ownership, restore, or operating-mode behavior:

- A queue claim persists `attempted` state before network dispatch. After any possible attempt, the operation id and payload are immutable; a later mutation receives a new operation id.
- Never-attempted pending absolute mutations may still compact safely. Additive inventory movements never compact.
- Operations are ordered per logical resource, while unrelated resources can continue. Acknowledging predecessor A cannot overwrite successor B's local projection; B is rebased to the accepted server version and can drain in the same sync run.
- Server replays require the same canonical request fingerprint. Mismatched reuse is terminal, historical fingerprint-less rows are conservatively unverified, and PostgreSQL serializes concurrent submissions of the same actor/operation id.
- Dexie schema 11 derives resource keys and marks legacy queue entries `uncertain`; Alembic `20261101_0008` adds nullable request fingerprints. Existing backup shapes remain readable because the new client fields are optional.

The compatibility limit is explicit: the migration freezes the payload currently present in a legacy entry, but cannot recover an original payload already overwritten by an older application build.

Verification for TZ-V1-01A:

| Command / scope | Result |
|---|---|
| Focused client regressions | Passed: lost response + edit B, in-flight edit/delete dependencies, restart, delayed/duplicate acknowledgement, safe pre-attempt compaction, additive movements, independent resources, legacy uncertainty, claim-storage failure, and refusal to rebase a successor after its own attempt begins. |
| `npm.cmd test` | Final review passed: 69 files, 278 unit/component tests. |
| Backend tests excluding PostgreSQL | Passed before final review: 43 tests, including canonical replay, payload/image mismatch, and historical fingerprint handling. Final review additionally passed the complete 20-test sync module with a two-device concurrency regression. |
| `npm.cmd run test:backend:postgres:local` | Passed: 7 tests, including migrations and concurrent equivalent submission. Pytest cache still reports the known workspace-permission warning. |
| `npm.cmd run test:typecheck` and `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed with the existing stale Browserslist data and large-chunk warnings. |
| Critical `pwa.spec.ts` journeys | Final review passed all 8 production-preview cases. The earlier isolated-profile failure was reproduced 11/20 times and traced to the test's fake token triggering an unmocked `/api/auth/me` failure and hard navigation to `/auth/login` during `page.evaluate`. The storage-isolation assertion now uses a stable same-origin document and explicit disposable IndexedDB stores; it passed 20/20 repeated desktop/mobile cases without sleeps or weaker assertions. This was a test lifecycle defect, not an application synchronization regression. |

## TZ-V1-01A final review

- Successor rebasing is limited to `pending` operations whose `attemptState` is `never`; an attempted or uncertain successor remains byte-for-byte frozen.
- The successor base advances only to the accepted predecessor version. A focused two-device server regression proved that if device B advances the resource afterward, the successor receives a version conflict and does not overwrite device B's state.
- Review corrections change tests and documentation only; the committed 1A runtime implementation and additive migrations remain unchanged.
- Local `draft` integrated the reviewed task branch with non-destructive merge commit `1c5ef3603c4467de628b8d1bf151e40bd0de101c` (`merge: integrate sync operation integrity`). Task history was preserved; nothing was pushed, deployed, or merged to `develop`.
- Task 1B subsequently began from local `draft`; its completed result is recorded below.

## TZ-V1-01B store-owned operational data

Branch `fix/v1-store-data-ownership`, based on local `draft` at `090fcd1`, completes the ownership and catalog-provisioning slice in implementation commit `898ff23aef13dd79b7ef5076874d594e23f29440`:

- Operational rows, sync history, cursors, and catalog assignments are now authorized and queried by the server-resolved active store membership. A user remains the actor; legacy `user_id`/`data_owner_id` fields are compatibility metadata rather than the authorization boundary.
- Store context fails closed with `STORE_CONTEXT_AMBIGUOUS` when an account has multiple active memberships. Inactive or revoked memberships do not provide operational access, and client-supplied store, actor, role, or permission claims are not trusted.
- Catalog reconciliation provisions each eligible store once from `Store.industry_id`, preserves store overrides, and hides versioned assignments that no longer match the store domain instead of deleting them.
- Sync pull, cursors, change history, replay deduplication, and inventory movement reversals are store-scoped while retaining server-derived actor attribution. The immutable-operation guarantees from TZ-V1-01A remain intact.
- The existing client database already partitions projections, cursors, and outbox state by authenticated person and store. No Dexie, backup-format, UI, styling, commercial-policy, restore-workflow, or operating-mode change was included in this slice.

Alembic `20261101_0009` adds authoritative store ownership and store-domain data, backfills only unambiguous legacy rows, validates duplicates and cross-store references, then installs non-null, uniqueness, foreign-key, index, and PostgreSQL trigger protections. It preserves identifiers, quantities, prices, transaction history, sync fingerprints, and actor history. It deliberately refuses ambiguous data with `STORE_OWNERSHIP_PREFLIGHT:<table>:<reason>` rather than merging, summing, deleting, or guessing. Before production upgrade, an operator must run the migration against a current database copy, investigate every reported preflight row, correct the source data explicitly, and rerun the migration. No non-test database was touched during this task.

Verification for TZ-V1-01B:

| Command / scope | Result |
|---|---|
| `npm.cmd run test:backend` | Passed: 47 tests, including shared owner/personnel data, unrelated-store isolation, cross-store reference rejection, revoked and ambiguous memberships, catalog override preservation, and admin-deletion safety. |
| `npm.cmd run test:backend:postgres:local` | Passed: 9 tests, including clean migration to head, legacy `0008` to `0009` preflight/remediation, identifier and history preservation, replay without duplicate application, concurrent catalog reconciliation, and cross-store database constraints. |
| `npm.cmd test` | Passed: 69 files, 278 unit/component tests. |
| `npm.cmd run test:typecheck` and `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed with the existing stale Browserslist data and large-chunk warnings; the largest reported `bwip-js` chunk remains about 930 kB. |
| Focused production-preview E2E | Passed: 28 cases across `pwa.spec.ts`, `product-layout.spec.ts`, and `authentication.spec.ts`; 2 live-credential authentication cases were skipped because credentials were not supplied. Offline, profile-isolation, and inventory layout coverage passed in both configured viewports. |

No frontend or styling source changed, so the existing screenshots remain a visual baseline only. TZ-V1-01B was completed and reviewed on its task branch; its local `draft` integration is recorded below. Nothing was pushed, deployed, or applied to `develop`.

## TZ-V1-01B final review

- The reported implementation and documentation commits were confirmed as `898ff23aef13dd79b7ef5076874d594e23f29440` and `e68328f`; both descend directly from local `draft` at `090fcd1`.
- Review found one migration-operability defect: preflight named only the table and reason, not the affected records. The focused correction reports the total plus up to 20 record/group identifiers. A PostgreSQL regression first reproduced the insufficient diagnostic, then proved the corrected diagnostic and full transactional rollback to `0008` with both conflicting rows intact.
- Store-scoped filtering was rechecked across list/detail/mutation/bulk, transaction history, export/backup, protected files, sync batch/snapshots/pull, catalog relationships, and database foreign-key/trigger boundaries. Related objects are validated in the authenticated store. Revoked membership remains server-denied.
- Multiple active memberships now have API-level coverage: `/api/auth/me`, products, and sync pull all return controlled `409 STORE_CONTEXT_AMBIGUOUS`; no alternate membership is selected and no sync handler runs. Platform-administrator coverage confirms the administrator's isolated workspace cannot list a customer's inventory.
- Replay review confirmed that `0009` does not alter operation IDs, semantic payloads, stored fingerprints, results, or actor IDs. A committed `0008` result is found by the migrated store/actor key and returned without applying the domain mutation again. TZ-V1-01A acknowledgement and successor ordering code was unchanged.
- Concurrent catalog reconciliation is serialized by the catalog row lock and protected by store/catalog uniqueness. Both concurrent sessions remain usable, one assignment per store is retained, and customer quantity, label, note, and visibility overrides survive. Personnel membership does not provision a separate inventory.
- Focused review corrections were committed as `e47e89b`; local `draft` then integrated the complete task history with non-destructive merge commit `61960ccf9b2a823c5ebf33262e935465d2813db2` (`merge: integrate store data ownership`). The post-merge PostgreSQL smoke passed all 9 tests. Nothing was pushed, deployed, or merged to `develop`.

Final-review verification:

| Command / scope | Result |
|---|---|
| `npm.cmd run test:backend:postgres:local` | Passed: 9 tests. This includes `0008` preflight failure/diagnostics/rollback, explicit synthetic remediation, upgrade to `0009`, preserved IDs/values/relationships/fingerprint/actor, replay without a second effect, same-store/cross-store constraints, and concurrent catalog reconciliation with override preservation. |
| `npm.cmd run test:backend` | Passed: 47 tests. This includes controlled ambiguous-context API failures, server-side revocation, shared owner/personnel inventory, unrelated-store and related-object isolation, administrator workspace isolation, sync regressions, and admin deletion safety. |

Deployment compatibility is intentionally limited: pre-1B backend processes must not coexist with schema `0009`. The current repository documents manual Alembic/start commands and has no rolling-deployment automation. Production therefore requires a controlled replacement: stop old workers, verify a backup and preflight on a current copy, apply `0009`, confirm the Alembic head, and start only 1B-or-newer workers. A preflight failure leaves the database at `0008`; operators must remediate the reported source records explicitly and retry. No customer or production database was used in this review.

## UI baseline artifacts

Current supplemental screenshots are local-only under ignored `test-results/v1-baseline/`:

- `dashboard-desktop-light-compact.png` — 1440×900, `/dashboard`, light, compact.
- `products-mobile-dark-large.png` — 390×844, `/inventory/list`, dark, large, one synthetic product.
- `product-filter-modal-mobile-dark-large.png` — 390×844, filter dialog, dark, large.
- `product-form-mobile-dark-large.png` — 390×844, `/inventory/add`, dark, large.

The tracked gallery at `artifacts/ui-layout-gallery-2026-10-20/` remains a visual baseline for settings, tools, and administrator management on desktop/mobile because TZ-V1-01A intentionally made no UI or styling changes. Runtime synchronization and persistence implementation has changed since the screenshots were captured, so they are visual evidence only, not evidence that runtime behavior is unchanged or that every theme/size combination is correct.

Observed UI issues are recorded separately:

- Dashboard scroll restoration consistently returns the app shell to the top after browser back in desktop and mobile.
- Desktop display-scaling failed once and passed the focused rerun; it remains timing-sensitive/unclassified.
- The mobile product screenshot shows the connection/status notice overlapping the top search/header region. Existing automated overflow tests passed, so this is a visual overlap finding rather than a horizontal-overflow failure.
- Physical camera/scanner/printer behavior, Safari/Firefox, File System Access persistence, and every theme/size/route combination were not verified.

## Outstanding release risks

1. Restore/reconciliation deletes quarantined restored operations instead of providing a safe apply/discard/export workflow.
2. No explicit server operating mode; team owners and personnel still follow local-first shared mutation behavior.
3. Metadata and image-byte completion are conflated; clean-device OPFS recovery is absent.
4. Commercial plan/grant/payment/admin policy is incomplete and contains an extra observed Starter tier not present in confirmed target policy.
5. Server restore, deploy/rollback, monitoring, alerting, and backup drills are not evidenced end to end.
6. Persistent dashboard scroll regression and the mobile status overlap remain.
7. Schema `0009` is not rolling-compatible with pre-1B backend workers and requires a controlled backend replacement after preflight and backup verification.

## Task 1C readiness

TZ-V1-01A and TZ-V1-01B now provide immutable transmitted operations and store-native ownership/catalog provisioning. Task 1C is ready to start as the restore/reconciliation slice, but it was not started automatically. Its prerequisites and acceptance boundaries are:

- Inventory existing local projections and every pending, attempted, retryable, terminal, restored, and unknown-outcome operation before replacing or reconciling restore state.
- Restore review provides explicit apply/discard/export actions and never silently deletes local-only or pre-restore work.
- Applying restored work creates a new operation identity and preserves the immutable transmitted identity/payload guarantees from 1A.
- Restore remains bound to the authenticated owner and store and cannot import authority, credentials, memberships, roles, subscription state, or another store's data.
- Recovery and review actions preserve actor/history attribution and have focused restart, duplicate, failure, and store-boundary coverage.

Explicit server operating mode, team activation, online-only shared mutation acceptance, offline-draft policy, stale-device behavior, revocation transitions, and subscription-expiry-without-solo-fallback tests belong to task 1D. Task 1C must preserve these future constraints but must not implement or guess them.

Open capacities, gifts, retention, conflict UX, and detailed draft policy do not block beginning integrity/model work, but they must not be guessed or encoded as final commercial values.
