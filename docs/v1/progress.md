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
- Task 1B is ready to begin from local `draft`, subject to the remaining ownership, restore, and operating-mode acceptance boundaries below. It was not started automatically.

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

1. Legacy owner-user ownership remains in tables, sync identity, and catalog provisioning; catalog assignment is user-oriented.
2. Restore/reconciliation deletes quarantined restored operations instead of providing a safe apply/discard workflow.
3. No explicit server operating mode; team owners and personnel still follow local-first shared mutation behavior.
4. Metadata and image-byte completion are conflated; clean-device OPFS recovery is absent.
5. Commercial plan/grant/payment/admin policy is incomplete and contains an extra observed Starter tier not present in confirmed target policy.
6. Server restore, deploy/rollback, monitoring, alerting, and backup drills are not evidenced end to end.
7. Persistent dashboard scroll regression and the mobile status overlap remain.

## Task 1 continuation

TZ-V1-01A addresses only immutable sync-operation integrity. The next Task 1 slice must retain these acceptance boundaries:

- Operating mode is a server-controlled store property; purchasing a plan or adding personnel does not switch it.
- Team activation inventories and resolves pending, in-flight, retryable, terminal, restored, and unknown-outcome operations before activation.
- Transmitted operation identity/payload remains immutable; later edits use a new operation id.
- Store-native ownership and catalog provisioning are included, with migration and PostgreSQL regression coverage.
- Restore review has explicit apply/discard/export actions and never silently drops local-only work.
- Team mutation tests cover owner and personnel, online authorization/acceptance, offline drafts, revocation, stale devices, and subscription expiry without a solo fallback.

Open capacities, gifts, retention, conflict UX, and detailed draft policy do not block beginning integrity/model work, but they must not be guessed or encoded as final commercial values.
