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

## TZ-V1-01C safe restore and reconciliation

Branch `fix/v1-safe-restore-reconciliation`, based on accepted local `draft` at `e0c98d9a8c697d2d19b65843546160f67c77b1ca`, closes the destructive local-restore path without changing backend schema, commercial policy, operating mode, or server disaster recovery:

- Backup data is validated as untrusted input for integrity, supported/legacy shape, owner/store binding, relationships, executable entity/action types, authority fields, numeric business invariants, and included media before live mutation. Imported authority, cursors, completion claims, and absence-as-delete are not trusted.
- Dexie schema 12 persists a recovery session, its complete imported evidence, a browser-local pre-restore checkpoint, media journal, review items, and the atomic review-item-to-operation mapping. The checkpoint includes current scoped projections, all outbox states, reconciliation metadata, preferences, and available image bytes. It protects this restore on this browser; it is not an independent external backup.
- Restore coordinates with the existing sync and local-mutation Web Locks. Browsers without Web Locks now fail closed before mutation. Media is staged and verified before the scoped IndexedDB transaction. The commit merges imported records with the pre-restore checkpoint and gives current records precedence, so newer edits and backup-absent local-only records remain visible; snapshot absence never means deletion. A restart before the database commit aborts the staging safely; a restart after commit resumes verified per-file copies from the journal. Current outbox entries are never deleted.
- Review persists across reload and exposes explicit apply, discard, and evidence export. Attempted/uncertain operations retain their exact original operation id and semantic payload for idempotent replay. Explicitly approved new snapshot/never-attempted recovery changes receive a new id, recovery provenance, current permission checks, and existing server version/conflict handling. Unknown additive snapshots and terminal results remain unresolved rather than being guessed.
- Resume refuses incomplete decisions and never deletes unresolved evidence. Discard can retract only a recovery operation that is still pending and definitely never attempted; it does not claim to cancel a possible server effect. Local restore can complete offline but remains visibly pending server reconciliation.
- The recovery review UI uses existing components and Persian RTL copy. Visual review found and corrected mobile/large-size wrapping for per-item and final actions; accessible modal/review scrolling is retained.

Verification for TZ-V1-01C:

| Command / scope | Result |
|---|---|
| Focused restore/format/queue regressions | Passed: 28 tests covering checkpoint/projection/outbox preservation, a newer edit plus backup-absent local product across reload/reconciliation, checkpoint-byte precedence on an OPFS path collision, exact uncertain replay identity/payload, duplicate apply, unresolved additive work, version preservation, owner/store/authority/relationship/media validation, quota/checkpoint failure, account change, local mutation exclusion, fail-closed unsupported locking, partial-stage abort, and post-commit journal resume. |
| `npm.cmd test` | Passed: 69 files, 295 unit/component tests. |
| `npm.cmd run test:typecheck` and `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed with the existing stale Browserslist data and large-chunk warnings; the largest reported `bwip-js` chunk remains about 930 kB. |
| Production-preview `local-backup.spec.ts` | Passed: 6 cases across desktop/mobile. Real Chromium restored an integrity-checked backup, reloaded persistent review, applied once, exported evidence, confirmed discard, retained explicit resume gating, and closed/reopened the restoring tab at a controlled pre-commit media-stage boundary. |
| Recovery UI matrix | Passed in desktop/mobile Chromium at initial normal sizing, light/compact, and dark/large. Actions remained reachable and keyboard-focusable, Persian text wrapped, and no horizontal page overflow was observed. |

## TZ-V1-01C final review

- The reported implementation commit `dc750348835ef21a8b175591be46cd50ea9478a0` was confirmed directly on accepted local `draft` `e0c98d9a8c697d2d19b65843546160f67c77b1ca`; the complete task diff contains no backend migration, deployment, commercial-policy, or operating-mode change.
- Review found a critical preservation gap: the durable checkpoint and outbox survived, but the live projections were replaced by the older imported snapshot. The commit boundary now performs a non-destructive union with the current checkpoint winning an ID collision. A focused reload/reconciliation regression preserves both a newer same-product edit and a local-only product absent from the backup.
- Review also found that restore could fall back to an expiring local-storage writer lease when Web Locks were absent. Restore now fails before checkpoint/mutation without Web Locks; supported browsers hold the backup, sync, and local-mutation locks for the complete boundary, so expiry of the user-facing maintenance marker cannot admit a second writer.
- Imported attempted/uncertain work remains owner/store-bound and retains exact operation ID, semantic payload, attempt state, and original evidence. Execution still requires current local permission checks and server acceptance. New recovery intent uses a new ID; terminal and unknown additive outcomes stay non-retrying and exportable. Apply/discard is keyed to the recovery item and cannot retract unrelated current work.
- Media staging now persists its complete planned journal before the first write and gives checkpoint bytes precedence when imported and current data reuse one OPFS path. Cleanup removes only verified copied staging bytes or an aborted pre-commit session. The complete checkpoint/imported envelope and review decisions remain persisted, including embedded available media evidence; completion does not delete the recovery session. The UI copy now describes merge rather than replacement.
- Focused final-review corrections were committed as `f78169d7ce052293f251cb84240c8ed736ad16f4`. Local `draft` then integrated both 1C commits with non-destructive merge `c1b84985b06007095282f7c1e2ec70eb1373a3af` (`merge: integrate safe restore reconciliation`). Task history is preserved; nothing was pushed, deployed, or merged to `develop`.

Compatibility limits are explicit: valid backup schemas 1–4 remain readable; older operations without reliable attempt provenance are uncertain. The SHA-256 digest checks file integrity but is not a keyed signature and never makes imported authority trustworthy. Recovery sessions are local to the browser/device. A real Chromium tab close was covered only before the database commit; operating-system/browser-process kill timing, real post-commit termination, cross-browser File System Access behavior, device loss, server restore, and clean-device media hydration are not established by this task. No PostgreSQL check was added because 1C changes no backend or server transaction path; the unchanged 1A server replay regressions remain the acceptance boundary for an exact original operation id/payload.

## TZ-V1-01D explicit operating modes

Branch `feat/v1-store-operating-modes`, based on accepted local `draft` `99a30bc11be9cd7b01251d313fd49dcae422e341`, implements the explicit server-controlled `solo`/`team` boundary in implementation commit `02df167e40b71bcdbe6e0a7cc254a18798838dca`:

- `Store.operating_mode`, monotonic `policy_version`, server timestamp/actor, and an idempotent transition journal are authoritative. Plan eligibility only permits activation; plan changes, personnel count, and subscription expiry never switch mode. No routine team-to-solo path exists.
- Activation is owner-only and one-way. The browser requires Web Locks, pauses local mutation transactions, rejects unfinished recovery review, attempts sync, and refuses activation while any scoped pending, attempted, retryable, conflict, terminal, restored, or unknown-outcome work remains. The server transition is a short row-locked transaction using expected policy version plus a stable transition ID.
- Solo remains owner local-first. Creating or reactivating personnel requires team mode. In team mode both owner and personnel commands are durably recorded before dispatch, require online server acceptance, and update projections only from accepted server records. Ordinary offline shared-mutation drafts are not created.
- Every new sync operation captures mode/version and is checked with current membership, entitlement, permissions, and resource scope at acceptance. Missing or stale context is rejected as terminal recovery evidence. Exact committed replay is resolved first only for the same server-derived store, actor, operation ID, and canonical fingerprint, preserving pre-transition replay without duplicate effects or actor reassignment.
- Recovery replays retain their original policy context as part of their immutable semantic request. A newly approved recovery action receives current context. Existing 1A operation identity/payload and successor-ordering guarantees remain unchanged.

Alembic `20261102_0010` deterministically maps legacy stores with active non-owner personnel to `team` and owner-only stores to `solo`. Missing or multiple active-owner membership blocks transactionally with sampled store IDs. The migration adds policy columns and transition history without rewriting domain identifiers, quantities, prices, relationships, actor attribution, operation IDs, stored results, or fingerprints.

Deployment compatibility is intentionally limited: pre-1D backend workers must not coexist with schema `0010`, because they can bypass the new mode acceptance boundary. Production requires a controlled replacement: stop old workers, verify a backup and preflight on a current database copy, upgrade `0009 -> 0010`, confirm Alembic head, then start only 1D-or-newer workers. No customer or production database was used.

Final verification:

| Command / scope | Result |
|---|---|
| Focused backend mode/personnel/replay regressions | Passed: explicit/idempotent activation, solo personnel block, owner and personnel team acceptance, revoked-member rejection, missing/stale policy rejection, historical replay, direct-route block, and subscription expiry without mode fallback. |
| `npm.cmd run test:backend:postgres:local` | Final review passed: 11 tests, including `0010` preflight diagnostics/rollback/remediation, deterministic solo/team backfill (including inactive personnel), value/history/fingerprint preservation, simultaneous activation convergence, and activation-versus-mutation serialization. |
| Focused frontend unit/component tests | Passed: durable-before-dispatch team commands, unknown outcome retention, no offline command, immutable captured policy context, no optimistic inventory projection, and explicit activation UI. |
| `npm.cmd test` | Final review passed: 72 files, 309 unit/component tests. |
| `npm.cmd run test:backend` | Passed: 48 tests. |
| `npm.cmd run test:typecheck` and `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed with the existing stale Browserslist data and large-chunk warnings; the largest reported `bwip-js` chunk remains about 930 kB. |
| Focused production-preview E2E | Passed: 32 cases across `pwa.spec.ts`, `product-layout.spec.ts`, and `personnel.spec.ts` in both configured viewports. Personnel activation also covered light/compact and dark/large layouts. |
| Post-merge smoke on local `draft` | Passed: 24 focused frontend synchronization/activation tests and 28 backend personnel/sync tests. |

## TZ-V1-01D final review

- The reported implementation commit `02df167e40b71bcdbe6e0a7cc254a18798838dca` and documentation commit `c2e08852144db861211f317b1b50701b7258a7ad` were confirmed directly on accepted local `draft` `99a30bc11be9cd7b01251d313fd49dcae422e341`. The complete task diff was reviewed; no unrelated customer data, dependency, commercial allocation, or deployment change was included.
- Review closed an account-switch partition defect: every awaited synchronization handler now captures and revalidates person/store context before local persistence or acknowledgement. A late response for account A cannot write into or acknowledge account B's partition.
- Activation now persists and reuses one transition identity across a lost response. A simultaneous second owner request converges on the authoritative Team state without creating another transition. PostgreSQL review exposed and fixed stale SQLAlchemy identity-map state after the store row lock by forcing the locked row to refresh.
- Activation and restore now share the `outbox -> local mutation` lock order. The final queue/recovery inventory and transition occur under that boundary, avoiding the previous lock inversion while preventing a mutation from slipping between the final drain and activation. Team commands also serialize per actor/store/resource before predecessor inspection, durable enqueue, dispatch, and projection reconciliation.
- Real backend evidence covers a committed Team mutation followed by a recreated client and exact replay with one `SyncOperation` and one domain effect. Frontend persistence-failure, account-switch, lock-order, durable-before-dispatch, and lost-response cases use controlled test doubles; production-preview Chromium uses mocked APIs and therefore is UI/storage evidence, not a live end-to-end server proof.
- The operational mutation map in `architecture-map.md` now covers product CRUD and image associations, quantity/bulk updates, category/label writes, catalog overrides, Excel import, barcode and movement writes, recovery apply/replay, and the independent image-byte path. Active UI write paths use the mode-aware services; legacy direct backend product/inventory/category writes fail closed in Team mode.
- The Solo activation UI and shared-mutation loading paths passed production-preview coverage in both configured viewports. Activation was additionally inspected at desktop/mobile light/compact and dark/large: actions remained reachable and focusable, Persian text wrapped, and no horizontal overflow was observed.
- Focused corrections were committed as `afde67a922ec86f27d1337d7880f1c7f2974bba7`. Local `draft` integrated the complete branch with non-destructive merge `4e2969e6961fef0ddec25d8638e4e563b196d62a` (`merge: integrate explicit store operating modes`). Task history was preserved; nothing was pushed, deployed, or merged to `develop`.

Migration and deployment limits remain explicit: `0010` preflight reports sampled store IDs for both missing and multiple active owners and fails transactionally at `0009`; remediation must be deliberate and rehearsed on a current database copy. Pre-1D workers must not coexist with schema `0010`. Production requires a controlled replacement with verified backup, stopped old workers, preflight/remediation, upgrade/head confirmation, and only then 1D-or-newer workers. No customer or production database was used.

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

1. Metadata and image-byte completion are conflated; clean-device OPFS recovery is absent.
2. Final Free/Pro/VIP allocations, prices, gift/grace rules, and the existing Starter transition remain unapproved; payment integration is absent. The 2A registry/admin/grant infrastructure is implemented, and Starter is historical-only.
3. Server restore, deploy/rollback, monitoring, alerting, and backup drills are not evidenced end to end.
4. Persistent dashboard scroll regression and the mobile status overlap remain.
5. Schema `0012` and minimal accounts require controlled replacement; pre-03 workers are not safe once nullable profile names are in use.
6. The 1C checkpoint/review journal is browser-local; browser-process kill, real post-commit termination, device-loss, and cross-browser File System Access recovery remain unverified.
7. Activation warns about other devices and the server rejects their stale commands, but instant control of a disconnected device is not possible and no private team draft workflow exists.

## Task 2 readiness

TZ-V1-01D is reviewed and integrated into local `draft`. Task 2 may begin from this state as the commercial entitlement/allocation slice, but it was not started automatically. It must preserve the explicit server-owned mode/version boundary, server-accepted Team projection rule, account/store partition guards, immutable rejected evidence, unresolved-recovery activation block, and the rule that plan or subscription changes never switch operating mode.

The infrastructure boundary is ready; final allocations are not. Capacities, gifts, retention, detailed draft policy, and the observed extra Starter tier remain unconfirmed commercial inputs. Task 2 must not treat illustrative or existing placeholder values as approved V1 policy, and must keep permission dependencies and subscription capacity in centralized configuration.

## TZ-V1-02A centralized entitlements and grants

Branch `feat/v1-plan-entitlement-management`, based directly on accepted local `draft` `f68b2faf78c99144825d45417c206b54b4e24e56`, implements the policy infrastructure without publishing final allocations:

- A single typed backend registry defines implemented/planned capabilities, dependencies, member permissions, enforcement locations, typed capacities, ranges, and explicit zero/finite/unlimited/unset semantics. Unknown, missing, malformed, dependency-breaking, or planned-enabled policy fails explicitly.
- Effective access resolves the complete current plan on the server and keeps plan, grant validity/provenance, store permission, operating mode/version, domain policy, and device policy separate. Safe historical replay remains ahead of current-policy rejection; new expired writes, capability denial, permission denial, and capacity exhaustion have distinct codes.
- Administrator plan changes take a row lock, require the current revision and an audit reason, validate the complete policy, increment revision, and atomically record before/change metadata. The UI consumes the server registry, disables planned features, explains dependencies, and labels preserved allocations as unapproved.
- Explicit administrator-only Pro/VIP grants are store-bound, time-bounded, auditable, revocable, retry-idempotent, and non-overlapping. One active grant replaces the base plan as a whole until server-time expiry/revocation; the unchanged base subscription then resumes. A grant never changes operating mode or bypasses membership/permission/capacity checks.
- Inventory create and personnel admission remain atomic under the store-row lock. Hidden products still consume capacity. The device-policy extension point remains unrestricted for every tier and rejects attempts to enable a V1 limit.
- Frontend entitlement snapshots are partitioned by authenticated person and store, carry policy revision/provenance, and reject late responses for a different account/store. The customer page shows the effective grant, Jalali expiry, and preserved base plan.

Alembic `20261102_0011` adds plan revision/commercial status and `store_plan_grants`, then makes every legacy policy value explicit. It preserves current effective allocations but marks Free/Pro/VIP `legacy_unapproved` and Starter `legacy_only`; existing Starter remains readable while public listing and new assignment exclude it. No subscription is remapped, no gift is seeded, and no customer operational data, mode, operation identity/payload, fingerprint, result, or actor history is rewritten.

Deployment is not rolling-compatible with pre-2A workers: old processes do not understand grant precedence, revision conflicts, or the full registry. Production requires a controlled replacement with stopped old workers, verified backup/current-copy rehearsal, `0010 -> 0011`, Alembic-head confirmation, and only then 2A-or-newer workers. No customer or production database was used.

Verification recorded for delivery:

| Command / scope | Result |
|---|---|
| `npm.cmd run test:backend` | Final review passed: 61 tests, including registry validation, member/cross-store/admin denial, grant retry/mismatch/start/end/expiry/revocation, one-instant sync acceptance, capacity reduction, Starter compatibility, mode preservation, replay and device-policy compatibility. |
| `npm.cmd run test:backend:postgres:local` | Final review passed: 15 tests, including `0010 -> 0011` Starter/subscription/data/sync preservation, concurrent policy revision/audit, inventory and personnel capacity, grant retry/overlap, and lazy admin-workspace serialization. |
| `npm.cmd test` | Final review passed: 73 files, 312 unit/component tests, including account/store cache partitioning and rejection of cross-partition or older same-partition responses. |
| `npm.cmd run test:typecheck` and `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed with the existing stale Browserslist-data and large-chunk warnings; the largest `bwip-js` chunk remains about 930 kB. |
| Focused production-preview E2E | Passed: 16 mocked-API Chromium cases across desktop/mobile for policy/grant UI, customer grant provenance, personnel/mode layouts, PWA offline cold routes, persistence, and profile isolation. This is UI/storage evidence, not live backend evidence. |

### Task 2B decision table

| Decision still required | Approval needed |
|---|---|
| Price and billing term | Free/Pro/VIP price, currency, and duration. |
| Capability allocation | Exact implemented capabilities enabled per tier. |
| Capacity allocation | Exact inventory/personnel values or supported unlimited choice; devices remain unrestricted in V1. |
| Gift policy | Eligible source/audience and explicit duration rule; this task assumes none. |
| Expiry/grace | Renewal expiry and any grace behavior while preserving defined read/recovery rights. |
| Starter transition | Explicit treatment of existing Starter subscribers; silent remapping is forbidden. |

## TZ-V1-02A final review

- The reported implementation commit `60b00b6980177fe24d7d2fd57a69ae27fb005e96` was confirmed directly on accepted local `draft` `f68b2faf78c99144825d45417c206b54b4e24e56`; the complete task diff was reviewed without finding unrelated data, dependency, operating-mode, or final-allocation changes.
- Review found that a sync command could resolve grant time separately during authorization and store-locked capacity admission. Correction `c738733573780e82c589c0e07d99d16585a0db8a` captures one server acceptance instant and reuses it throughout the command. Controlled start/end tests establish an inclusive start and exclusive end; a red/green regression proves that expiry during processing cannot combine granted authorization with base-plan capacity.
- Review found that a delayed response in the same person/store partition could overwrite a newer grant expiry or revocation because grant changes do not increment the plan definition revision. The client now rejects older `server_time` snapshots before changing local entitlement or query data. The existing account/store partition guard remains intact.
- Exact grant request retries converge, changed payload reuse fails, overlap remains serialized, and expiry/revocation reveals the unchanged base plan without cleanup. A reduced inventory cap blocks only new admission; an existing record remains editable. PostgreSQL now proves that concurrent inventory and personnel admission each retain one winner at capacity.
- Migration rehearsal now carries an assigned Starter user/store, operating mode, operational identifiers/values, actor attribution, sync fingerprint/result, and zero grants from `0010` through `0011`. Starter remains enforceable/readable for that existing assignment while API coverage confirms public/new assignment exclusion; empty-database seeding now marks it `legacy_only` explicitly too.
- Schema `0011` remains incompatible with pre-2A workers. Production requires stopped old workers, verified backup and current-copy rehearsal, migration/head confirmation, then only 2A-or-newer workers. No production/customer database or real grant was touched.
- Local `draft` integrated implementation and review history with non-destructive merge `92506ad2bd46f0085bd995ebab84c4910ca722f4` (`merge: integrate entitlement management`). Nothing was pushed, deployed, applied to `develop`, or granted to a real user.

Task 2A is reviewed and integrated into local `draft`. Task 2B is ready only for the explicit commercial decisions in the table above; it was not started automatically.

## TZ-V1-03 simplified signup and profile reminder

Branch `feat/v1-simple-signup-profile-reminder`, based directly on accepted local `draft` `60a94ac517ad318050ff8a3b801c607f46abf49d`, simplifies public signup without changing commercial policy, store ownership, operating mode, or Task 2B decisions. Implementation commit `9468d7d124e33076f95e311caa8d48d99ec79f92` contains the reviewed runtime and regression changes:

- Signup now asks only for username, password, and client-only password confirmation. It preserves the existing password rules, password-manager autocomplete, paste behavior, Persian validation, recoverable in-memory input after a failed request, and a one-request guard against repeated submission. The server receives neither confirmation nor fabricated profile/contact values.
- `first_name` and `last_name` are nullable until profile completion; email and phone remain nullable. Account, owner store, owner membership, starter roles, and session still commit in one transaction. A PostgreSQL uniqueness race returns a controlled duplicate-username response, and an injected provisioning failure proves that no partial identity remains.
- A successfully created minimal owner receives the existing Free base plan, Solo mode, unrestricted V1 device behavior, and no grant. Existing clients that still send names/contact values remain accepted. A lost/failed response does not set a browser token; retry cannot create a second workspace.
- An incomplete owner sees one informational, non-blocking notification linked directly to `/setting/profile`. Opening it does not dismiss it; a successful profile update removes it from the current account/store query state. Personnel and the isolated platform-administrator workspace are not asked to edit owner profile data.
- Alembic `20261103_0012` changes only the nullability of `users.first_name` and `users.last_name`. Upgrade preserves existing values. Downgrade refuses with `PROFILE_NAME_PREFLIGHT:user_ids=...` while any minimal account still has an incomplete name, so operators must complete/remediate those profiles before reverting.

Verification:

| Command / scope | Result |
|---|---|
| Focused signup/profile tests | Passed: 12 frontend validation/notification tests and 4 backend provisioning/profile tests. |
| `npm.cmd test` | Passed: 74 files, 317 unit/component tests. |
| `npm.cmd run test:backend` | Passed: 65 tests. |
| `npm.cmd run test:backend:postgres:local` | Passed: 16 tests, including migration head/nullability and concurrent minimal signup with exactly one complete workspace. |
| `npm.cmd run test:typecheck` and `npm.cmd run lint` | Passed. |
| `npm.cmd run build` | Passed with the existing stale Browserslist-data and large-chunk warnings; `bwip-js` remains about 930 kB. |
| Production-preview `signup-profile-reminder.spec.ts` | Passed: 4 Chromium cases across desktop/mobile. The minimal form, double-submit guard, retained failed input, informational reminder, direct profile action, persistence after viewing, successful resolution, and horizontal overflow were covered with mocked APIs. This is browser UI/storage evidence, not a live backend journey. |

Deployment is not safely mixed with pre-03 workers after minimal accounts can exist: older response/schema and display assumptions require non-null names. Use a controlled backend/frontend replacement, verify a backup and rehearse `0011 -> 0012` on a current copy, confirm Alembic head, then enable the new signup UI only with 03-or-newer workers. No production/customer database was migrated, no real account was created, and no grant was issued.

Task 2B remains pending exactly the previously listed commercial decisions. TZ-V1-03 does not approve prices, allocations, gifts, grace, or Starter transition and does not start the next task automatically.
