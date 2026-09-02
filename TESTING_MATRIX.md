# Tanzim risk-based testing matrix

This matrix records the repository audit performed before introducing the test
foundation. Priorities reflect release risk, not a coverage target.

| Area | Risk | Types | Primary risk and main scenarios | Edge cases / fixtures | Environment |
| --- | --- | --- | --- | --- | --- |
| Authentication and sessions | Critical | Unit, API, E2E | Signup/login, token/session binding, current user, password change, logout, invalid/expired credentials | Wrong password, malformed body, weak/overlong password, inactive session; regular user/device fixtures | Fast API tests; PostgreSQL for session persistence; browser for routing |
| Permanent administrator | Critical | Service, API, PostgreSQL | Idempotent bootstrap; exactly one protected admin; authenticate; reject delete/demote/disable with 409 | Existing seed, repeated seed, conflicting username; dedicated test secret only | Isolated PostgreSQL; never production credentials |
| Users and RBAC | Critical | Unit, API | Admin operations and listing, regular-user denial, disabled-user denial, no payload privilege escalation | Admin, regular, disabled users; legacy `is_admin` compatibility | Fast tests plus PostgreSQL API |
| Plans and subscriptions | Critical | Unit, API, browser | Free/paid/expired entitlement, upgrade/downgrade capability changes, preserved local data, reconnect verification | Exact expiry boundary, clock rollback, user-bound cache, missing snapshot | Controlled clock/localStorage; PostgreSQL authority; no payment service |
| Products and inventory | Critical | Unit, API, IndexedDB, E2E | CRUD, ownership, validation, status derivation, local persistence, image replacement, quantity adjustment | Empty inventory, zero/null fields, negatives, large safe values, hidden/no image/no price | Fake IndexedDB for repository; PostgreSQL for constraints; browser journey |
| Package/unit quantities | High | Unit, component, E2E | Unit source of truth, package multiplier, unit/package increment/decrement, form metadata | 10 × 10 = 100, remainders, zero/decimal/unsafe pack size, negative result | Pure unit tests; API constraint; browser journey remains targeted |
| Catalog lifecycle | Critical | API, PostgreSQL, E2E | Admin CRUD, archive/restore, provisioning, transactional permanent delete, tombstones | 0/1/100 dependents, repeated/nonexistent delete, archived delete, unauthorized user | Existing API suite plus isolated PostgreSQL; browser journey deferred |
| Industries/workspaces | High | API | Admin CRUD and delete restriction with catalog dependencies | Empty vs dependent industry, duplicate/blank name | Existing API suite; PostgreSQL FK behavior |
| Categories | High | Unit, IndexedDB, API, sync | Local CRUD, durable queue, server refresh, user isolation, removing product references | Stable client IDs, duplicates, pending local mutation, cross-user rows | Fake IndexedDB and API; offline/online sync |
| Outbox and sync | Critical | Unit, IndexedDB, API, E2E | Consolidation, ordering, idempotency, conflicts, partial failure, retries, reconnect pull, tombstones | Create→delete cancellation, in-flight mutation, omitted result, 429/5xx, dead letter | Deterministic unit/API tests; real browser offline journey remains |
| IndexedDB | High | Repository | Schema open/migrate, CRUD, replace, reopen persistence, user isolation | Empty DB, legacy rows, cross-user delete/clear | `fake-indexeddb`; true browser covered by E2E target |
| OPFS/images | High | Repository, hook, component, browser | Save/read/replace/delete, object URL creation and revocation, picker/remove/disabled behavior | Missing file, failed write cleanup, remote URL, orphan cleanup | In-memory OPFS fake; Chromium browser compatibility target |
| Dashboard | High | Unit, component, E2E | Product-type count, inventory value, all risk cards and filtered lists | Empty/mixed inventory, exact threshold, catalog image, hidden/catalog visibility | Mock only inventory boundary; calculations are real |
| Export | High | Unit, browser | Local/server source, scopes, non-empty output, tenant isolation, online guard | No category, empty selection, escaping, offline server export | Local service tests are next priority; API suite covers ownership |
| Forms and dialogs | High | Unit, component | Validation, conditional package fields, submit/disabled modes, native confirmation avoidance | Missing/invalid input, password confirmation, replacement file | jsdom/Testing Library; sensitive dialogs need broader coverage |
| Theme/settings | Medium | Unit, component | Light/dark/system persistence and broadcast; readable theme tokens | Invalid stored value, reload, system media change | jsdom plus mobile/desktop browser |
| Notifications/navigation | Medium | Unit, component | Derived stock alerts and correct routes/IDs | Missing products, stale IDs, status transitions | jsdom; E2E dashboard routing target |
| PWA/responsive | High | Browser | Manifest/SW availability, offline shell, mobile navigation/forms/dialogs | Cache update, installed mode, mobile viewport, WebKit OPFS limitation | Chromium desktop/mobile configured; WebKit not claimed |
| Alembic/schema | Critical | PostgreSQL integration | Empty database upgrades to head; 12 tables; FK/unique/check/null constraints | Current head `20260902_0001`, rollback on failed dependency delete | Explicit disposable PostgreSQL URL only |
| Backup/export server | Medium | API | Permission guard, correct tenant snapshot, safe error | Offline and expired subscription | Existing backend endpoints; file-content expansion remains |

## Existing-test assessment

- `backend/tests/test_sync.py` is a healthy, assertion-rich 14-test API regression
  suite. It covers sync idempotency/conflicts, image upload, password change,
  category IDs, industry deletion, catalog lifecycle and rollback, RBAC,
  subscriptions, ownership, and disabled users. It is preserved unchanged.
- Its SQLite database is explicitly test-only and remains useful as a fast API
  compatibility suite, but it does not validate PostgreSQL semantics or Alembic.
- No obsolete tests or known flaky sleeps/retries were found.
- No frontend, component, browser, coverage, or PostgreSQL migration test runner
  existed before this phase.

## Audit notes

- IndexedDB is the operational, user-scoped local source of truth. PostgreSQL is
  authoritative for accounts, entitlements, administration, catalog data, and
  synchronized inventory state.
- OPFS paths are references, not image URLs. The React image hook reads a file,
  creates an object URL, and revokes it during cleanup.
- Inventory quantities are individual units. Packaging metadata is catalog data;
  package actions convert to unit deltas.
- The outbox consolidates per entity, uses stable operation IDs for pending
  retries, protects newer mutations while older requests are in flight, and has
  bounded exponential backoff.
- PWA configuration provides a shell cache and page-context background-sync
  notification. Browser support is not inferred from mocks.
