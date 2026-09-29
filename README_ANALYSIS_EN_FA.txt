TANZIM — COMPLETE PROJECT ANALYSIS
English and Persian / انگلیسی و فارسی
Audit date: 2026-08-27

===============================================================================
ENGLISH VERSION
===============================================================================

1. EXECUTIVE SUMMARY
--------------------

Tanzim is a Persian-first, offline-first inventory management Progressive Web
App for small businesses. Its current product thesis is stronger than a normal
inventory CRUD application: a platform administrator creates industry-specific
shared catalog products, users choose an industry, matching products are
provisioned into their personal inventory, and each user manages quantity,
price, visibility, categories, images, and low-stock behavior locally and
online.

The application already has the foundations of a freemium SaaS:

- User signup/login, device sessions, profile and password management.
- Industry selection and automatic shared-catalog provisioning.
- Offline product/category CRUD with IndexedDB and queued synchronization.
- Fast quantity adjustment with click/hold interaction and confirmation.
- Dashboard metrics, low-stock alerts, search, sorting and virtualized lists.
- Local/server export, PWA shell caching, responsive RTL UI and themes.
- Admin RBAC, users, subscriptions, plans, industries and catalog management.
- Catalog archive, restore and permanent global deletion with audit records.
- Subscription capabilities, item/device limits and expired-account read-only mode.

Current maturity: strong technical MVP / early private beta, not production-ready
SaaS. The core behavior is credible and the difficult offline-sync domain has
received meaningful engineering effort. Production readiness is limited by the
single-user ownership model, SQLite/local file storage, startup migrations,
missing payment and team/workspace concepts, limited test coverage, duplicate
legacy APIs, and security/observability gaps.

Recommended product position:

  “Fast Persian inventory control that keeps working without internet, starts
   from a ready-made industry catalog, and prevents stock surprises.”

The best initial market is Iranian micro and small businesses that currently use
paper, spreadsheets, Telegram notes or generic accounting tools and need fast
stock visibility more than full ERP/accounting complexity.


2. AUDIT SCOPE AND VERIFIED STATE
---------------------------------

This analysis is based on the repository itself, not only the existing README.
The audit covered frontend routes, components, storage and sync code; backend
models, schemas, routers and services; PWA files; configuration; dependencies;
and automated tests.

Repository snapshot:

- Frontend: 208 TypeScript/TSX files, approximately 13,587 lines.
- Backend and tests: 42 Python files, approximately 6,475 lines.
- Frontend route files: 31.
- Backend router modules: 15.
- Backend integration tests: 14.
- Frontend automated tests: none found.
- CI/CD, Docker and Alembic configuration: none found.

Verification performed on 2026-08-27:

- Production frontend build: passed.
- ESLint: passed with 0 errors and 3 warnings.
- Backend unittest integration suite: 14/14 passed in approximately 8 seconds.
- One dependency deprecation warning appeared around FastAPI/Starlette TestClient.

This was a code and automated-test audit. It is not a penetration test, load
test, real-device browser matrix, accessibility certification or production data
recovery exercise.


3. BUSINESS SCENARIO AND DOMAIN MODEL
-------------------------------------

Primary actors:

1) Platform administrator
   - Manages industries and shared catalog products.
   - Archives, restores or permanently deletes global catalog products.
   - Manages users, roles, account status, plans and subscriptions.
   - Reviews administrative audit events.

2) Inventory user/business owner
   - Registers, selects an industry and receives the industry catalog.
   - Adds private products and organizes products into personal categories.
   - Manages stock, price, images, notes, thresholds and visibility.
   - Uses the app offline and synchronizes when connectivity returns.
   - Sees dashboard alerts and exports data.

3) System administrator account
   - Immutable bootstrap administrator protected from deletion, disabling and
     demotion.

Core domain entities:

- User and UserSession.
- Industry.
- CatalogProduct: shared/global or private/legacy; active or archived.
- InventoryItem: user-owned stock state linked to a catalog product.
- Category: user-owned classification.
- InventoryTransaction: stock movement record.
- SyncOperation and SyncChange: idempotency records and change feed/tombstones.
- SubscriptionPlan.
- AdminAuditLog.
- CustomProduct: a separate legacy/parallel model that appears unused by the
  current frontend.

Important current business rule:

Inventory belongs to an individual user, not to a company, shop, workspace or
warehouse. Two employees cannot currently collaborate on one shared inventory.
The ADMIN role is a platform-level administrator, not a tenant/store manager.
This is the single most important architectural and product limitation for B2B
growth.

Catalog lifecycle behavior:

- Creating an active shared catalog product provisions it to applicable users.
- Archiving prevents active use but preserves dependent inventory.
- Restoring reconciles/provisions appropriate user assignments without duplicates.
- Permanent deletion removes dependent inventory and transactions globally in a
  transaction and emits sync deletion tombstones.
- Permanent deletion is therefore a high-impact platform operation and should
  remain rare, strongly confirmed and operationally monitored.


4. USER JOURNEYS AND CURRENT FUNCTIONALITY
------------------------------------------

Onboarding journey:

1) User registers.
2) A JWT and device session are created.
3) User selects a business industry.
4) Shared products for that industry are provisioned into the user inventory.
5) User enters the dashboard/inventory experience.

Daily inventory journey:

- Browse products newest-first.
- Search and sort by date, price or quantity.
- Hide/show catalog-backed products in the operational list.
- Add a private product with quantity, price, image, category, note and threshold.
- Edit stock metadata and visibility.
- Adjust quantity using large +/- controls; click changes once, hold repeats,
  then a delayed confirmation toast asks to confirm or cancel.
- Delete private products with confirmation; shared catalog-backed items cannot
  be individually deleted and should be hidden instead.
- See derived states: in stock, low stock and out of stock.

Dashboard and alerts:

- Total products.
- Added today.
- Inventory value.
- Low-stock and out-of-stock counts.
- Hidden, no-image and no-price counts.
- Urgent-purchase count.
- Click-through lists for actionable groups.
- Notification panel derives low/out-of-stock alerts from local inventory.

Settings and administration:

- Personal profile and local profile media.
- Light, dark and system appearance.
- Offline-capable personal categories.
- Local and server export.
- Industry management/selection.
- Catalog CRUD, search, filter, archive, restore and permanent deletion.
- Full local inventory refresh from the server.
- Current subscription display.
- Admin user details, activation, role, subscription and deletion.
- Admin plan CRUD and subscriber view.

Incomplete or misleading functionality:

- Payment/checkout is explicitly not implemented; subscriptions are assigned by
  administrators.
- Backup restore returns a success message but does not restore data.
- “XLSX” export is actually an HTML table downloaded as .xls.
- “PDF” export opens browser print from HTML; it is not server-generated PDF.
- The product “unit” input/API parameter is not represented in the active data
  model and the UI option is commented out.
- Product status is computed from quantity/threshold, but the form still shows a
  status selector. Editing that selector does not represent an independent
  persisted domain field.
- Registration UI collects email, but the signup request schema/backend signup
  does not persist it; Pydantic currently ignores the extra field.
- Backend transaction endpoints exist, but the primary offline quantity-update
  flow updates quantity through sync and does not create InventoryTransaction
  records. Stock movement history is therefore incomplete.


5. FRONTEND ARCHITECTURE
------------------------

Primary stack:

- React 19 and TypeScript 6 in strict mode.
- Vite 8 with route code splitting.
- TanStack Router using file-based routes.
- TanStack Query for server/cache orchestration.
- TanStack Virtual for long inventory lists.
- Radix Themes and Radix Icons.
- Tailwind CSS 4 plus project CSS/tokens.
- Zod and a custom form state hook.
- Dexie over IndexedDB for structured offline data.
- Origin Private File System (OPFS) for local images.
- Sonner for notifications/toasts.
- React Compiler enabled.
- Recharts is present for a chart component, but that component is not part of
  the main dashboard flow.

Feature structure is generally good:

  src/features/<domain>/components
  src/features/<domain>/mutations
  src/features/<domain>/services
  src/features/<domain>/api
  src/shared/lib/infrastructure
  src/shared/ui
  src/routes

The current active data path is intentionally local-first:

  UI
    -> feature hook/mutation
    -> InventoryService or CategoryService
    -> IndexedDB/OPFS immediately
    -> SyncQueue
    -> /api/sync or category API when online
    -> server change feed
    -> IndexedDB reconciliation
    -> TanStack Query invalidation

Frontend strengths:

- Immediate offline UX instead of blocking on the network.
- Local records are sanitized before use.
- Local data, sync queues and cursors are scoped by user.
- Queue consolidation avoids unnecessary operations.
- Optimized image processing and orphan cleanup reduce storage waste.
- UI guards explain online/admin/subscription restrictions.
- Route code splitting and virtualized inventory reduce runtime work.
- RTL, Persian numbers, Toman display, themes and responsive breakpoints fit the
  target audience.

Frontend weaknesses and debt:

- No frontend unit, component, integration or end-to-end tests.
- Multiple parallel/legacy API layers exist (`src/services/*`, `src/shared/api`,
  REST product APIs and the active sync path), increasing mental overhead.
- Unused dependencies appear to include Keycloak, Embla, Lucide,
  @hookform/resolvers and react-hook-form. Recharts has little/no active value.
- Template assets/files remain, including Vite/React assets and template README
  content.
- Generated CSS is approximately 735 KB uncompressed; design-system and
  Tailwind/Radix usage should be reviewed for production weight.
- Main JavaScript is approximately 383 KB uncompressed (about 122 KB gzip), plus
  a large sync chunk. Acceptable for an MVP, but worth performance budgeting.
- React Compiler skips TanStack Virtual usage and reports a lint warning.
- Two hooks report missing effect dependencies.
- Some Persian text appeared mojibake in PowerShell output; repository files are
  UTF-8, but encoding should be enforced in editors, APIs, CSV and deployment.
- Authentication tokens are stored in localStorage, increasing impact of any XSS.
- User-scoped IndexedDB/OPFS data remains on the device after logout and is not
  encrypted at rest; this matters on shared or compromised devices.
- There is no shared generated API contract; TypeScript and Pydantic schemas can
  drift, as demonstrated by the signup email mismatch.


6. OFFLINE AND SYNCHRONIZATION DESIGN
-------------------------------------

This is one of Tanzim’s strongest engineering areas.

Implemented mechanisms:

- Dexie database with five schema versions.
- Per-user local inventory, category, queue and cursor isolation.
- Queue actions: CREATE, UPDATE and DELETE.
- Queue states: pending, in-flight, retryable, fatal and dead-letter.
- Consolidation of repeated mutations for the same entity.
- Exponential retry backoff up to five minutes and maximum retries.
- Server-side operation idempotency using user + operation_id uniqueness.
- Optimistic concurrency using base version numbers.
- Explicit conflict results.
- Incremental server change cursor and deletion tombstones.
- Server-authoritative permanent deletion resolution.
- Startup, online, focus and visibility sync triggers.
- Full refresh workflow that first protects pending local mutations.

Important scale and correctness risks:

- Initial sync returns the complete user inventory in one response; it is not
  paginated. Large accounts will increase memory, response size and startup time.
- Incremental pull is limited to 500 changes, but the client does not visibly
  loop until all pages are drained in one sync run.
- SyncOperation and SyncChange tables have no visible retention/compaction job and
  can grow indefinitely.
- Each batch operation commits separately, improving isolation but reducing bulk
  throughput.
- Client background-sync registration exists, but the service worker has no
  `sync` event handler. Reliable background sync is therefore not actually
  completed; foreground triggers do the real work.
- Category sync uses direct CRUD rather than the same idempotent batch/versioned
  protocol as products.
- Conflict policy is effectively server-wins for version conflicts; users do not
  receive a conflict-resolution UI.
- OPFS is not universally available in all embedded/older browsers; graceful
  behavior exists in places, but a formal compatibility matrix is absent.


7. BACKEND ARCHITECTURE
-----------------------

Primary stack:

- Python 3.10+.
- FastAPI 0.141.
- SQLAlchemy 2 ORM.
- Pydantic schemas through FastAPI.
- SQLite by default.
- Uvicorn.
- bcrypt password hashing.
- python-jose JWT signing.
- Local filesystem uploads served by FastAPI.

Layering:

  FastAPI application/configuration
    -> dependency-based authentication/authorization
    -> routers
    -> domain services
    -> SQLAlchemy models/session
    -> SQLite and local uploads

Backend strengths:

- Resource ownership checks prevent cross-user access.
- Central permission service for ADMIN capabilities.
- Server-side subscription capability and limit enforcement.
- Disabled accounts are globally rejected.
- Expired subscriptions allow reads and block writes.
- Device/session limits are enforced by plan.
- Password changes require the current password and invalidate other sessions.
- Immutable system administrator protections are tested.
- Catalog archive/restore/delete logic is service-based and transactional.
- Permanent catalog deletion emits user-specific tombstones and keeps audit data.
- Plan deletion is blocked for built-in or subscribed plans.
- Input validation uses Pydantic and explicit domain errors.
- Images have type and size limits and randomized filenames.
- CORS origins and major secrets are configurable.

Backend weaknesses and production risks:

Critical/high priority:

- Default SECRET_KEY is `dev-secret-change-me`; production startup does not fail
  when this unsafe value is used.
- SQLite and local upload storage are single-node choices with limited concurrent
  write throughput, backup guarantees and horizontal scaling.
- Tables are created and altered at application startup. There is no Alembic
  migration history, downgrade path or deployment-safe schema process.
- No organization/workspace/warehouse tenancy exists.
- No rate limiting, login throttling, lockout, CAPTCHA, email verification,
  password reset or MFA is implemented.
- Access tokens are long-lived (seven days), stored in browser localStorage and
  stored as plaintext in `user_sessions`. Prefer short-lived access tokens,
  rotating refresh tokens and hashed/token-family server storage.
- There is no visible structured logging, error tracking, metrics, tracing or
  alerting. The global exception handler hides details but does not log them.

Medium priority:

- SQLite foreign-key enforcement is not visibly enabled with PRAGMA; application
  code handles important dependencies, but database-level integrity should not
  depend only on services.
- Uploaded files are MIME-checked, not content-signature scanned, and served from
  the application host.
- `last_seen` is updated during auth dependency execution, but read-only requests
  may close without commit, so admin last-activity data can be stale.
- Password hashing truncates input to bcrypt’s 72-byte limit. Validation allows
  longer character strings, so different long Unicode passwords could share the
  same effective prefix.
- No unique constraint prevents duplicate category names per user or duplicate
  shared catalog names per industry.
- Some list endpoints load data and sort/filter in Python rather than SQL.
- Catalog/admin list endpoints are not consistently paginated.
- The old `seed.py` uses a catalog shape inconsistent with the current Industry
  foreign-key model and should not be considered reliable.
- Backend README/API overview is outdated and documents only a subset of routes.
- requirements include `httpx2`, while dev requirements use `httpx`; the test run
  emits a TestClient deprecation warning. Dependency policy needs cleanup.


8. FRONTEND–BACKEND COMPATIBILITY
---------------------------------

What is aligned:

- JWT Bearer authentication and device fingerprint headers.
- User/role/subscription fields.
- Catalog and industry identifiers.
- Inventory non-negative quantity/price semantics.
- Catalog-backed deletion restrictions.
- Product version field and sync conflict responses.
- Change cursors and deletion tombstones.
- Subscription capability names and limits.
- Persian domain errors are surfaced through a shared API error path.

What needs alignment:

- Signup email is collected/sent but not accepted or persisted by SignupRequest.
- Frontend and backend maintain manually duplicated schemas and enums.
- Frontend product sort names differ from the legacy `/products` route sort
  names; the active local service hides this, but reuse can fail unexpectedly.
- Dashboard has both server and local implementations with different response
  shapes and definitions; the frontend currently uses local stats.
- Three overlapping backend product concepts/routes exist: `/products`,
  `/inventory`, and `/custom-products`, plus `/sync`. The frontend’s primary path
  is local service + `/sync`.
- Product `unit` is accepted in one request surface but is not persisted.
- Transaction history is not integrated with offline quantity sync.
- Currency semantics are inconsistent: inventory UI stores/displays Toman while
  plan currency defaults to IRR and uses a `price_minor` name.
- Server image upload limit differs between normal product and sync paths
  (5 MB versus 10 MB), while the client also processes images locally.

Recommended contract strategy:

1) Declare `/sync`, `/auth`, `/plans`, `/admin`, `/industries`, `/catalog-products`
   and `/categories` as the canonical API surface.
2) Deprecate or remove unused `/products`, `/inventory/sync`, `/custom-products`
   paths after usage verification.
3) Export OpenAPI and generate TypeScript request/response types in CI.
4) Add contract tests for every canonical endpoint and error code.


9. CODE QUALITY AND MAINTAINABILITY
-----------------------------------

Positive observations:

- Strict TypeScript and no current lint errors.
- Domain-oriented feature folders.
- Service/repository separation in the active offline flow.
- Comments explain difficult sync and lifecycle decisions.
- Defensive local-data sanitation.
- Explicit destructive-action confirmation in important UI flows.
- Newest-first sorting is consistently intended.
- Integration tests target difficult cases: idempotency, conflicts, ownership,
  catalog lifecycle with 100 dependencies, rollback, RBAC and subscriptions.

Technical-debt observations:

- One backend test file contains all 14 integration tests; fixture and scenario
  separation would improve diagnosis.
- No frontend tests and no API contract tests.
- Duplicated product models/services/routes make it unclear which path is canonical.
- Some components are large and mix formatting, validation, storage and UI logic.
- Custom form state duplicates capabilities available in an installed but unused
  react-hook-form dependency.
- Error strings are inconsistent: Persian user messages, English domain codes and
  legacy mojibake can all occur.
- No formal formatter/pre-commit configuration is visible.
- No architecture decision records (ADRs), domain glossary or release process.
- README still contains starter-template guidance and does not describe the actual
  product sufficiently.


10. UI/UX ANALYSIS
------------------

Current advantages:

- Persian-first RTL interface and Persian number formatting.
- Toman shown where inventory users expect it.
- Dark/light/system themes.
- Mobile bottom navigation and desktop settings sidebar.
- Responsive treatment down to ultra-narrow screens.
- Shared icon language and theme-aware components.
- Large quick-stock targets with click and hold behavior.
- Confirmation for stock changes and destructive actions.
- Offline/sync status, pending state and retry affordance.
- Actionable dashboard cards and derived notifications.
- Catalog-backed products explain why global data cannot be edited/deleted locally.

UX risks:

- The information architecture mixes operational settings and platform-admin
  functions in one long menu. Admin pages should be a distinct “Platform Admin”
  area.
- “Products” appears in both main navigation and settings with different meanings.
  Rename settings entry to “Data sync” or “Product recovery”.
- Hide-catalog action is prominent and wordy; it should be a compact filter/toggle
  with a clear active-state summary.
- Quick-stock confirmation via persistent toast is efficient but can be missed or
  conflict with other toasts. Consider an anchored undo/confirm bar with keyboard
  and screen-reader validation.
- Product cards expose many controls; progressive disclosure and consistent action
  priority would reduce cognitive load.
- Dashboard totals/value currently include hidden products, while actionable
  lists usually exclude them; metric definitions should be explicit and consistent.
- “No image” checks only the inventory override and can classify a catalog-backed
  product as missing an image even when its catalog image is displayed on the card.
- Status should not be editable if it is derived.
- Empty states should lead to a next action (add product, select industry, clear
  filter), not only describe absence.
- No barcode scanning, SKU search or camera-first flow exists—these are high-value
  mobile inventory interactions.
- Accessibility has useful labels in many places, but there is no automated axe
  testing, keyboard audit, focus-order audit or contrast certification.
- PWA manifest has only an SVG icon and no 192/512 PNG or maskable icons; install
  quality across devices may be inconsistent.
- No first-run tutorial explains offline sync, shared catalog behavior or why
  some products cannot be deleted.


11. ADVANTAGES AND DIFFERENTIATION
----------------------------------

Product advantages:

- Works during unreliable connectivity—a real operational benefit, not cosmetic.
- Ready-made industry catalog reduces setup time.
- Very fast stock adjustment supports repeated daily behavior.
- Persian/RTL/Toman localization is native rather than translated afterward.
- Freemium capability and device limits are already modeled.
- Local and server exports increase trust and portability.
- Admin lifecycle and audit controls support managed catalog operations.

Technical advantages:

- Idempotent, version-aware synchronization is unusually mature for an MVP.
- Server tombstones prevent deleted global data from reappearing offline.
- OPFS image handling, optimization and cleanup are thoughtful.
- Catalog delete rollback and 100-dependent-row scenarios are tested.
- Capability enforcement exists on both client UX and server authority.

Potential moat:

The defensible advantage is not generic inventory CRUD. It is the combination of:

  Persian operational UX
  + offline reliability
  + vertical/industry catalog data
  + rapid stock actions
  + accumulated benchmark/catalog intelligence.

Over time, high-quality vertical catalog data, barcode mappings, supplier links
and reorder intelligence can become more defensible than the application code.


12. DISADVANTAGES AND BUSINESS RISKS
------------------------------------

- No shared business workspace means the current product is effectively
  single-user SaaS, limiting multi-employee adoption and account expansion.
- No billing/payment means plans do not yet produce automated revenue.
- No purchase orders, suppliers, sales/orders, cost price, margin, locations,
  lots/expiry or barcode/SKU capabilities.
- Global catalog mistakes can affect every user in an industry.
- Automatic catalog provisioning can create clutter at scale.
- Offline conflicts have no user-facing resolution workflow.
- Data durability depends on one SQLite file, local uploads and browser storage.
- Local browser data can be cleared by the OS/user; server sync reduces risk only
  after successful synchronization.
- A platform administrator has broad access and destructive power; operational
  separation and approvals are limited.
- No analytics instrumentation exists to validate retention or feature value.
- No onboarding funnel, referral system, CRM hooks or lifecycle messaging exists.
- Regulatory/privacy terms, consent, data retention and account export/deletion
  policies are not represented.


13. GROWTH POTENTIAL AND BUSINESS MODEL
---------------------------------------

Best initial customer profile:

- One-owner or one-operator shops/warehouses.
- 50–5,000 active SKUs.
- Mobile-first stock checks.
- Unreliable or expensive connectivity.
- Existing process is paper, spreadsheet or messaging notes.
- Strong need for low-stock visibility but low appetite for ERP complexity.

Promising initial verticals:

- Auto parts and repair-shop stock.
- Small retail and convenience stores.
- Cosmetics/beauty supplies.
- Tools and building supplies.
- Small distributors.

Avoid heavily regulated verticals (pharmacy/medical, food traceability) until
expiry, lot, compliance and audit requirements are implemented.

Suggested packaging:

- Free: one user/device, small item limit, local export, basic alerts.
- Starter: larger inventory, two devices, backup, richer export.
- Pro: workspace/team, roles, barcode, supplier/reorder, multiple locations.
- VIP/Enterprise: unlimited scale, SLA, onboarding, custom catalog/import and API.

Monetization gaps to close:

- Payment gateway and subscription lifecycle webhook processing.
- Invoices/receipts and renewal reminders.
- Trial and grace-period policy.
- Upgrade prompts tied to real limits/value moments.
- Tenant billing owner and seat/device management.
- Plan analytics: conversion, churn, expansion and failed renewal.

Marketing message hierarchy:

1) Never stop because the internet stopped.
2) Start with a ready catalog for your profession.
3) Change stock in seconds.
4) Know what is low or unavailable before the customer asks.
5) Keep ownership of your data with export and sync visibility.

Acquisition experiments:

- Vertical landing pages with the exact catalog and terminology of each trade.
- 60-second demo videos showing offline mode and rapid +/- adjustment.
- Partnerships with wholesalers/accountants/POS installers.
- Import service from Excel as a lead magnet.
- Referral credit for shop owners in the same trade.
- “Inventory health report” generated from imported data.

Metrics the founder should track:

- Visitor -> signup -> industry selected -> first stock change.
- Time to first value and catalog-provision completion.
- D1/D7/D30 active businesses.
- Weekly stock adjustments per active business.
- Percentage of users with successful recent sync.
- Pending/dead-letter operations per 1,000 mutations.
- Products with price/image/threshold completeness.
- Alert viewed -> stock replenished conversion.
- Free-to-paid conversion, MRR, ARPU, churn and expansion revenue.
- Support requests per 100 active businesses.


14. PRIORITIZED IMPROVEMENT ROADMAP
-----------------------------------

P0 — Before public production launch

1) Security and deployment
   - Fail startup when production uses the default SECRET_KEY.
   - Move to HTTPS-only deployment and secure headers/CSP.
   - Add login rate limiting and security event logging.
   - Define token rotation/refresh strategy; stop storing raw long-lived tokens.
   - Add PostgreSQL and object storage.
   - Introduce Alembic migrations.
   - Add automated encrypted database/media backups and test restoration.

2) Data correctness
   - Fix signup email persistence.
   - Remove/implement product unit and remove derived status selector.
   - Standardize Toman/IRR storage and display conventions.
   - Integrate stock changes with transaction history.
   - Enable/enforce foreign keys and important uniqueness constraints.
   - Replace the fake backup restore and clarify export format labels.

3) Quality gates
   - Add CI for lint, build, backend tests and migration checks.
   - Add frontend unit/component tests and Playwright critical journeys.
   - Generate TypeScript API contracts from OpenAPI.
   - Add structured logging, error monitoring and health/metrics dashboards.

P1 — Product-market-fit release

1) Introduce Organization/Workspace, membership and tenant roles.
2) Model warehouse/location and stock per location.
3) Add barcode/SKU scanning and fast product lookup.
4) Add supplier and reorder list/purchase-order basics.
5) Add real payment, trial, renewal and invoice lifecycle.
6) Add Excel/CSV import with preview, validation and duplicate handling.
7) Add user-visible sync center and conflict resolution.
8) Improve onboarding, demo data and contextual education.
9) Separate platform admin navigation from business settings.

P2 — Scale and differentiation

1) Paginate/chunk initial sync and drain all change pages.
2) Add change-log retention/compaction and sync observability.
3) Add cost versus selling price, margin and valuation methods.
4) Add multi-location transfer and approval flows.
5) Add reorder recommendations based on velocity and lead time.
6) Add catalog barcode mappings, variants and supplier data.
7) Add public API/webhooks and accounting/POS integrations.
8) Add product analytics and cohort/retention dashboards.

P3 — Advanced/enterprise

- Lot/serial/expiry tracking.
- Fine-grained permissions and approval workflows.
- SSO/MFA and enterprise audit export.
- Offline-capable team conflict strategy.
- Regional deployment, SLA and disaster recovery targets.
- Demand forecasting after sufficient clean historical data exists.


15. RECOMMENDED TARGET ARCHITECTURE
-----------------------------------

Near-term modular monolith (recommended; do not rush to microservices):

  React PWA
    - generated API client
    - IndexedDB + OPFS cache
    - versioned sync engine
    - observability client

  FastAPI modular monolith
    - identity/session module
    - tenant/workspace module
    - catalog module
    - inventory/transaction module
    - subscription/billing module
    - sync module
    - admin/audit module

  Infrastructure
    - PostgreSQL
    - S3-compatible object storage
    - Redis only when needed for rate limits/jobs/cache
    - background worker for imports, exports, image jobs and notifications
    - centralized logs, error tracking and metrics

Suggested tenancy model:

  Organization
    -> Membership(user, role)
    -> Warehouse/Location
    -> Product definition
    -> Stock balance per location
    -> Stock movement ledger

Do not make current User.id the permanent business boundary. Introduce
organization_id in domain tables and migrate personal accounts into a default
one-member organization.


16. FOUNDER/DEVELOPER OPERATING GUIDE
-------------------------------------

The mental model to remember:

- IndexedDB is the active frontend read model.
- The sync queue is the bridge from local intent to server authority.
- `/api/sync` is the canonical product mutation/reconciliation path.
- The server owns identity, permissions, subscriptions, global catalog and final
  conflict/deletion authority.
- A shared catalog product is platform data; an inventory item is user stock.
- Archive preserves; permanent delete destroys globally.
- Subscription checks in the UI are guidance; backend checks are authority.

Safe change checklist:

1) Does the change work offline?
2) Is it queued idempotently?
3) Can another device change the same record?
4) What happens after server deletion?
5) Is the operation tenant/user scoped?
6) Does an expired/disabled account remain protected?
7) Do local images and server images clean up safely?
8) Does the dashboard/query cache invalidate?
9) Is there a migration and rollback plan?
10) Is there a test for ownership, retry, conflict and destructive behavior?

Release checklist:

- Frontend build and lint pass.
- Backend tests pass.
- Database migration tested on a copy of production data.
- Backup and restore tested.
- Sync tested online -> offline -> multiple edits -> reconnect.
- Two-device conflict tested.
- Expired and disabled accounts tested.
- Mobile RTL, 280px width, tablet and desktop tested.
- Light/dark/system themes and keyboard focus tested.
- Monitoring, rollback and support messaging prepared.


17. FINAL ASSESSMENT
--------------------

Tanzim has a meaningful foundation and a credible differentiated direction. The
offline synchronization and shared industry catalog are the strongest assets.
The code is beyond prototype quality in several difficult areas, particularly
catalog lifecycle and sync integrity.

The project should not yet be marketed as a complete inventory/ERP platform. It
should be marketed as fast, reliable personal inventory control for small
businesses, while the next architecture phase introduces shared workspaces,
warehouse stock and a real movement ledger.

Founder priority order:

  1) Reliability/security/data recovery.
  2) Workspace/team ownership model.
  3) Barcode + import + reorder workflows.
  4) Payments and measurable activation/retention.
  5) Scale infrastructure only as usage demands it.

If those priorities are executed in that order, Tanzim can grow from a strong
offline-first MVP into a valuable vertical inventory SaaS rather than becoming a
broad but shallow ERP clone.


===============================================================================
نسخه فارسی
===============================================================================

۱. خلاصه مدیریتی
-----------------

تنظیم یک اپلیکیشن پیش‌رونده وب (PWA)، فارسی‌محور و آفلاین‌محور برای مدیریت
موجودی کسب‌وکارهای کوچک است. ایده محصول از یک CRUD ساده انبار قوی‌تر است:
مدیر پلتفرم برای هر حوزه کاری یک کاتالوگ مشترک می‌سازد، کاربر حوزه کاری خود را
انتخاب می‌کند، محصولات مرتبط به موجودی شخصی او اضافه می‌شوند و سپس کاربر تعداد،
قیمت، تصویر، دسته‌بندی، یادداشت، نمایش و هشدار کمبود را به‌صورت آنلاین یا آفلاین
مدیریت می‌کند.

زیرساخت‌های فعلی یک SaaS فریمیوم تا حد قابل‌توجهی شکل گرفته‌اند:

- ثبت‌نام، ورود، نشست دستگاه، پروفایل و تغییر رمز عبور.
- انتخاب حوزه کاری و ایجاد خودکار موجودی از کاتالوگ مشترک.
- CRUD آفلاین محصول و دسته‌بندی با IndexedDB و صف همگام‌سازی.
- تغییر سریع موجودی با کلیک/نگه‌داشتن و تأیید نهایی.
- داشبورد، هشدار کمبود، جست‌وجو، مرتب‌سازی و فهرست مجازی‌شده.
- خروجی محلی/سرور، PWA، رابط RTL واکنش‌گرا و تم روشن/تیره/سیستم.
- RBAC مدیر، مدیریت کاربران، طرح‌ها، اشتراک‌ها، حوزه‌ها و کاتالوگ.
- بایگانی، بازیابی و حذف دائمی کاتالوگ با ثبت رویداد مدیریتی.
- قابلیت‌ها و محدودیت‌های اشتراک، محدودیت دستگاه و حالت فقط‌خواندنی پس از انقضا.

سطح بلوغ فعلی: MVP فنی قوی / بتای خصوصی اولیه؛ هنوز SaaS آماده تولید عمومی
نیست. بخش دشوار همگام‌سازی آفلاین مهندسی قابل‌توجهی دارد، اما مدل مالکیت تک‌کاربره،
SQLite، فایل محلی، مهاجرت‌های زمان شروع برنامه، نبود پرداخت و فضای کاری تیمی،
پوشش تست محدود، APIهای موازی قدیمی و کمبودهای امنیت و مانیتورینگ مانع تولید هستند.

جایگاه پیشنهادی محصول:

  «کنترل سریع موجودی به زبان فارسی؛ حتی بدون اینترنت کار می‌کند، با کاتالوگ آماده
   شغل شما شروع می‌شود و اجازه نمی‌دهد کمبود کالا غافلگیرتان کند.»

بازار اولیه مناسب، کسب‌وکارهای خرد و کوچک ایرانی است که امروز از کاغذ، اکسل،
یادداشت تلگرام یا ابزار حسابداری عمومی استفاده می‌کنند و بیشتر از ERP پیچیده،
به دید سریع و مطمئن روی موجودی نیاز دارند.


۲. محدوده بررسی و وضعیت تأییدشده
--------------------------------

این تحلیل بر اساس خود مخزن کد انجام شده است، نه فقط README فعلی. مسیرها،
کامپوننت‌ها، ذخیره‌سازی و Sync فرانت‌اند؛ مدل‌ها، Schemaها، Routerها و Serviceهای
بک‌اند؛ فایل‌های PWA، تنظیمات، وابستگی‌ها و تست‌ها بررسی شده‌اند.

تصویر فعلی مخزن:

- فرانت‌اند: ۲۰۸ فایل TypeScript/TSX و حدود ۱۳٬۵۸۷ خط.
- بک‌اند و تست‌ها: ۴۲ فایل Python و حدود ۶٬۴۷۵ خط.
- فایل‌های Route فرانت‌اند: ۳۱.
- ماژول‌های Router بک‌اند: ۱۵.
- تست‌های یکپارچه بک‌اند: ۱۴.
- تست خودکار فرانت‌اند: یافت نشد.
- CI/CD، Docker و Alembic: یافت نشد.

اعتبارسنجی انجام‌شده در ۲۰۲۶-۰۸-۲۷:

- Build تولید فرانت‌اند: موفق.
- ESLint: صفر خطا و سه هشدار.
- تست یکپارچه بک‌اند: ۱۴ از ۱۴ موفق، حدود ۸ ثانیه.
- یک هشدار deprecation مربوط به FastAPI/Starlette TestClient دیده شد.

این بررسی، Audit کد و تست خودکار است؛ تست نفوذ، Load Test، تست کامل دستگاه‌های
واقعی، گواهی Accessibility یا تمرین بازیابی داده تولید نیست.


۳. سناریوی کسب‌وکار و مدل دامنه
-------------------------------

بازیگران اصلی:

۱) مدیر پلتفرم
   - مدیریت حوزه‌های کاری و محصولات کاتالوگ مشترک.
   - بایگانی، بازیابی یا حذف دائمی جهانی محصول کاتالوگ.
   - مدیریت کاربران، نقش، وضعیت حساب، طرح و اشتراک.
   - مشاهده رویدادهای مدیریتی.

۲) کاربر موجودی / مالک کسب‌وکار
   - ثبت‌نام، انتخاب حوزه و دریافت کاتالوگ همان حوزه.
   - افزودن محصول خصوصی و دسته‌بندی شخصی.
   - مدیریت موجودی، قیمت، تصویر، یادداشت، حد هشدار و نمایش.
   - کار آفلاین و همگام‌سازی بعد از اتصال.
   - استفاده از داشبورد، هشدار و خروجی.

۳) مدیر دائمی سیستم
   - حساب Bootstrap تغییرناپذیر که قابل حذف، غیرفعال‌سازی یا تنزل نقش نیست.

موجودیت‌های اصلی:

- User و UserSession.
- Industry.
- CatalogProduct: مشترک/جهانی یا خصوصی/قدیمی؛ فعال یا بایگانی.
- InventoryItem: وضعیت موجودی متعلق به کاربر و متصل به محصول کاتالوگ.
- Category: دسته‌بندی شخصی کاربر.
- InventoryTransaction: رویداد ورود/خروج موجودی.
- SyncOperation و SyncChange: idempotency، change feed و tombstone.
- SubscriptionPlan.
- AdminAuditLog.
- CustomProduct: مدل موازی/قدیمی که ظاهراً فرانت‌اند فعلی از آن استفاده نمی‌کند.

مهم‌ترین قانون فعلی کسب‌وکار:

موجودی متعلق به «کاربر» است، نه شرکت، فروشگاه، فضای کاری یا انبار. دو کارمند
فعلاً نمی‌توانند روی یک موجودی مشترک کار کنند. نقش ADMIN مدیر کل پلتفرم است، نه
مدیر یک فروشگاه. این بزرگ‌ترین محدودیت معماری و محصول برای رشد B2B است.

چرخه عمر کاتالوگ:

- ساخت محصول مشترک فعال، آن را برای کاربران مرتبط ایجاد می‌کند.
- بایگانی، استفاده فعال را متوقف ولی موجودی‌های وابسته را حفظ می‌کند.
- بازیابی، تخصیص کاربران را بدون ساخت رکورد تکراری اصلاح می‌کند.
- حذف دائمی، موجودی و تراکنش‌های وابسته را به‌صورت جهانی و Transactional حذف و
  tombstoneهای Sync ایجاد می‌کند.
- بنابراین حذف دائمی عملیاتی بسیار حساس است و باید نادر، چندمرحله‌ای و مانیتورشده
  باقی بماند.


۴. سفر کاربر و قابلیت‌های فعلی
-----------------------------

سفر شروع کار:

۱) ثبت‌نام کاربر.
۲) ساخت JWT و نشست دستگاه.
۳) انتخاب حوزه کاری.
۴) اضافه‌شدن محصولات مشترک حوزه به موجودی کاربر.
۵) ورود به داشبورد و موجودی.

کار روزانه با موجودی:

- مشاهده محصولات با ترتیب پیش‌فرض جدیدترین.
- جست‌وجو و مرتب‌سازی بر اساس تاریخ، قیمت یا تعداد.
- مخفی/نمایان کردن محصولات کاتالوگی در فهرست عملیاتی.
- افزودن محصول خصوصی با تعداد، قیمت، تصویر، دسته، یادداشت و حد هشدار.
- ویرایش اطلاعات و وضعیت نمایش.
- تغییر سریع تعداد با +/-؛ کلیک یک واحد و نگه‌داشتن تغییر پیوسته، سپس تأیید/لغو.
- حذف محصول خصوصی با تأیید؛ محصول کاتالوگی به‌جای حذف باید مخفی شود.
- وضعیت‌های محاسبه‌شده موجود، کم‌موجود و ناموجود.

داشبورد و هشدار:

- تعداد کل و محصولات افزوده‌شده امروز.
- ارزش موجودی.
- کمبود و عدم موجودی.
- محصولات مخفی، بدون تصویر و بدون قیمت.
- نیاز به خرید فوری.
- فهرست قابل کلیک برای هر گروه قابل اقدام.
- اعلان‌های محلی مشتق‌شده از موجودی.

تنظیمات و مدیریت:

- پروفایل و تصویر/آواتار محلی.
- تم روشن، تیره و سیستم.
- دسته‌بندی شخصی آفلاین.
- خروجی محلی و سرور.
- انتخاب/مدیریت حوزه کاری.
- CRUD، جست‌وجو، فیلتر، بایگانی، بازیابی و حذف کاتالوگ.
- بازیابی کامل نسخه محلی محصولات از سرور.
- نمایش اشتراک جاری.
- جزئیات، فعال‌سازی، نقش، اشتراک و حذف کاربر توسط مدیر.
- CRUD طرح و مشاهده مشترکان.

قابلیت‌های ناقص یا گمراه‌کننده:

- پرداخت و Checkout وجود ندارد؛ اشتراک توسط مدیر تخصیص داده می‌شود.
- Backup Restore فقط پیام موفقیت برمی‌گرداند و داده‌ای بازیابی نمی‌کند.
- خروجی «XLSX» در واقع HTML با پسوند .xls است.
- خروجی «PDF» چاپ مرورگر از HTML است، نه PDF واقعی سرور.
- واحد محصول در مدل فعال ذخیره نمی‌شود و بخش UI آن کامنت شده است.
- Status از تعداد و حد هشدار محاسبه می‌شود، ولی فرم هنوز Select وضعیت دارد.
- فرم ثبت‌نام ایمیل می‌گیرد اما Backend Signup آن را ذخیره نمی‌کند.
- API تراکنش وجود دارد، ولی تغییر موجودی اصلی در Sync رکورد Transaction نمی‌سازد؛
  تاریخچه گردش کالا کامل نیست.


۵. معماری فرانت‌اند
-------------------

فناوری‌ها:

- React 19 و TypeScript 6 با Strict Mode.
- Vite 8 و Code Splitting مسیرها.
- TanStack Router فایل‌محور.
- TanStack Query.
- TanStack Virtual.
- Radix Themes و Radix Icons.
- Tailwind CSS 4 و CSS/Tokenهای پروژه.
- Zod و Hook فرم اختصاصی.
- Dexie و IndexedDB.
- OPFS برای تصاویر محلی.
- Sonner برای اعلان‌ها.
- React Compiler.
- Recharts در یک کامپوننت نمودار که در جریان اصلی داشبورد استفاده نمی‌شود.

ساختار Feature-based در کل مناسب است و مسیر فعال داده چنین است:

  UI
    -> Hook/Mutation فیچر
    -> InventoryService یا CategoryService
    -> ذخیره فوری در IndexedDB/OPFS
    -> SyncQueue
    -> API هنگام آنلاین شدن
    -> Change Feed سرور
    -> تطبیق IndexedDB
    -> Invalidate شدن Queryها

نقاط قوت فرانت‌اند:

- تجربه فوری آفلاین و عدم وابستگی هر کلیک به شبکه.
- پاک‌سازی و اعتبارسنجی دفاعی داده محلی.
- جداسازی داده، صف و Cursor بر اساس کاربر.
- ادغام عملیات تکراری صف.
- پردازش تصویر و حذف فایل‌های بدون مرجع.
- Guardهای آنلاین، مدیر و اشتراک با پیام قابل‌فهم.
- Code Splitting و Virtual List.
- RTL، اعداد فارسی، تومان، تم و Responsive مناسب بازار هدف.

ضعف‌ها و بدهی‌ها:

- نبود هر نوع تست واحد، کامپوننت، یکپارچه یا E2E فرانت‌اند.
- وجود لایه‌های API و سرویس موازی/قدیمی و افزایش پیچیدگی ذهنی.
- وابستگی‌های ظاهراً بدون استفاده: Keycloak، Embla، Lucide،
  @hookform/resolvers و react-hook-form؛ ارزش فعال Recharts نیز کم است.
- باقی‌ماندن Asset و متن‌های Template اولیه.
- CSS خروجی حدود ۷۳۵KB بدون فشرده‌سازی است.
- JS اصلی حدود ۳۸۳KB (حدود ۱۲۲KB gzip) به‌علاوه Chunk بزرگ Sync است.
- React Compiler برای TanStack Virtual هشدار Skip می‌دهد.
- دو Hook هشدار dependency دارند.
- باید UTF-8 در Editor، API، CSV و Deployment به‌صورت رسمی enforce شود.
- نگهداری Token در localStorage اثر XSS احتمالی را شدیدتر می‌کند.
- داده IndexedDB/OPFS هر کاربر بعد از Logout روی دستگاه باقی می‌ماند و رمزگذاری
  نشده است؛ این موضوع در دستگاه مشترک یا آلوده مهم است.
- Contract تولیدشده مشترک وجود ندارد و Schemaهای TS/Pydantic ممکن است Drift کنند.


۶. طراحی آفلاین و همگام‌سازی
---------------------------

این بخش یکی از قوی‌ترین قسمت‌های تنظیم است:

- پنج نسخه Schema در Dexie.
- جداسازی داده، صف و Cursor برای هر کاربر.
- CREATE/UPDATE/DELETE و وضعیت‌های کامل صف.
- ادغام Mutationهای تکراری.
- Backoff نمایی و Dead Letter.
- Idempotency سمت سرور با user + operation_id.
- کنترل Version و Conflict صریح.
- Cursor افزایشی و Tombstone حذف.
- جلوگیری از بازگشت محصولی که مدیر جهانی حذف کرده است.
- Trigger در Startup، Online، Focus و Visibility.
- Full Refresh امن نسبت به تغییرات محلی در انتظار.

ریسک‌های Scale و صحت:

- Sync اولیه کل موجودی کاربر را یکجا می‌فرستد و Pagination ندارد.
- Pull افزایشی ۵۰۰ تغییر می‌گیرد، اما Loop آشکار برای تخلیه همه صفحات ندارد.
- پاک‌سازی دوره‌ای SyncOperation و SyncChange وجود ندارد.
- Commit هر Operation توان عملیاتی Batch را کم می‌کند.
- Background Sync ثبت می‌شود ولی Service Worker هندلر `sync` ندارد؛ Sync واقعی بر
  Triggerهای Foreground تکیه دارد.
- Sync دسته‌بندی به اندازه محصول Idempotent/Versioned نیست.
- Conflict عملاً Server-wins است و UI حل تعارض وجود ندارد.
- ماتریس رسمی سازگاری OPFS/مرورگر وجود ندارد.


۷. معماری بک‌اند
----------------

فناوری‌ها:

- Python 3.10+، FastAPI، SQLAlchemy 2 و Pydantic.
- SQLite به‌صورت پیش‌فرض و Uvicorn.
- bcrypt و python-jose/JWT.
- فایل Upload محلی و سرو مستقیم توسط FastAPI.

نقاط قوت:

- کنترل مالکیت و جلوگیری از دسترسی بین کاربران.
- Permission مرکزی برای ADMIN.
- اعمال قابلیت و Limit اشتراک در سرور.
- رد سراسری حساب غیرفعال و حالت فقط‌خواندنی پس از انقضا.
- محدودیت تعداد دستگاه.
- تغییر رمز با رمز فعلی و خروج سایر نشست‌ها.
- حفاظت و تست مدیر دائمی سیستم.
- چرخه عمر Transactional کاتالوگ و Tombstoneهای Sync.
- جلوگیری از حذف طرح Built-in یا دارای مشترک.
- Pydantic و خطاهای دامنه صریح.
- محدودیت نوع/حجم و نام تصادفی تصویر.
- CORS و Secretهای قابل تنظیم.

ضعف‌ها و ریسک‌های تولید:

بحرانی/بالا:

- SECRET_KEY پیش‌فرض ناامن است و Startup تولید را متوقف نمی‌کند.
- SQLite و فایل محلی برای Scale افقی، Write همزمان و بازیابی کافی نیستند.
- Migration در Startup با ALTER TABLE انجام می‌شود؛ Alembic وجود ندارد.
- Tenant/Organization/Workspace/Warehouse وجود ندارد.
- Rate Limit، Lockout، CAPTCHA، تأیید ایمیل، Reset Password و MFA وجود ندارد.
- Access Token هفت‌روزه در localStorage و به‌صورت متن خام در Session DB ذخیره می‌شود.
- Logging ساختاریافته، Error Tracking، Metric، Trace و Alerting دیده نمی‌شود.

متوسط:

- فعال‌سازی SQLite Foreign Keys با PRAGMA دیده نمی‌شود.
- بررسی فایل بر اساس MIME است، نه Signature یا Scan محتوا.
- `last_seen` در درخواست‌های فقط‌خواندنی ممکن است Commit نشود.
- bcrypt ورودی را در ۷۲ بایت قطع می‌کند ولی Validation طول بیشتری می‌پذیرد.
- Unique Constraint برای نام دسته هر کاربر یا نام کاتالوگ هر حوزه وجود ندارد.
- بعضی Filter/Sortها در Python و پس از Load داده اجرا می‌شوند.
- Pagination در Listهای مدیریتی یکدست نیست.
- `seed.py` با مدل فعلی Industry سازگار نیست.
- README بک‌اند قدیمی و ناقص است.
- سیاست dependency مربوط به httpx/httpx2 نیاز به اصلاح دارد.


۸. سازگاری فرانت‌اند و بک‌اند
----------------------------

موارد هماهنگ:

- JWT و Device Fingerprint.
- User/Role/Subscription.
- شناسه Industry و Catalog.
- Quantity/Price غیرمنفی.
- ممنوعیت حذف محصول کاتالوگی.
- Version و Conflict.
- Cursor و Tombstone.
- Capability و Limit طرح‌ها.

موارد نیازمند اصلاح:

- ایمیل Signup ارسال ولی ذخیره نمی‌شود.
- Schemaها و Enumها دستی و تکراری هستند.
- نام Sort فرانت با `/products` قدیمی متفاوت است.
- داشبورد محلی و سرور Shape و تعریف متفاوت دارند؛ فرانت از نسخه محلی استفاده می‌کند.
- `/products`، `/inventory`، `/custom-products` و `/sync` هم‌پوشانی دارند.
- Unit ذخیره نمی‌شود.
- Transaction با Sync اصلی یکپارچه نیست.
- تومان موجودی با IRR/price_minor طرح‌ها یکدست نیست.
- Limit تصویر مسیر عادی ۵MB و Sync برابر ۱۰MB است.

راهکار Contract:

۱) APIهای Canonical را رسماً مشخص کنید.
۲) مسیرهای قدیمی را پس از بررسی مصرف Deprecate/حذف کنید.
۳) از OpenAPI نوع‌های TypeScript تولید کنید.
۴) Contract Test برای Endpoint و Error Codeها اضافه کنید.


۹. کیفیت کد و نگهداشت
---------------------

مزایا:

- TypeScript Strict و صفر خطای Lint.
- ساختار Feature-based.
- جداسازی Service/Repository در مسیر فعال آفلاین.
- کامنت‌های مفید برای تصمیم‌های سخت Sync.
- Sanitize دفاعی داده.
- تأیید عملیات مخرب.
- قصد روشن برای مرتب‌سازی جدیدترین.
- تست سناریوهای سخت Idempotency، Conflict، Ownership، ۱۰۰ وابستگی، Rollback،
  RBAC و Subscription.

بدهی‌ها:

- همه ۱۴ تست بک‌اند در یک فایل بزرگ هستند.
- تست فرانت و Contract Test وجود ندارد.
- مدل/Route/Serviceهای تکراری محصول.
- برخی کامپوننت‌ها بزرگ و دارای مسئولیت‌های متعدد هستند.
- Hook فرم اختصاصی در کنار react-hook-form نصب‌شده ولی بدون استفاده.
- خطاها مخلوطی از فارسی، کد انگلیسی و متن Legacy هستند.
- Formatter/Pre-commit رسمی دیده نمی‌شود.
- ADR، واژه‌نامه دامنه و فرآیند Release وجود ندارد.
- README اصلی هنوز متن Template دارد و محصول واقعی را کامل توضیح نمی‌دهد.


۱۰. تحلیل UI/UX
---------------

مزایا:

- فارسی و RTL واقعی، اعداد فارسی و تومان.
- تم روشن/تیره/سیستم.
- Bottom Navigation موبایل و Sidebar دسکتاپ.
- Responsive حتی برای عرض کمتر از ۳۰۰px.
- زبان بصری آیکون مشترک و هماهنگ با تم.
- دکمه‌های مناسب تغییر سریع موجودی.
- تأیید تغییر و حذف.
- نمایش وضعیت Sync و امکان Retry.
- داشبورد و اعلان‌های قابل اقدام.
- توضیح محدودیت محصول کاتالوگی.

ریسک‌ها:

- تنظیمات عملیاتی و مدیریت کل پلتفرم در یک منوی طولانی مخلوط‌اند.
- «محصولات» هم در منوی اصلی و هم تنظیمات با دو مفهوم دیده می‌شود؛ مورد تنظیمات
  بهتر است «همگام‌سازی/بازیابی داده» نام بگیرد.
- دکمه مخفی‌کردن کاتالوگ طولانی و بسیار برجسته است؛ Filter/Toggle مناسب‌تر است.
- Toast دائمی تأیید موجودی ممکن است بین Toastهای دیگر گم شود.
- کارت محصول کنترل‌های زیادی دارد؛ Progressive Disclosure مفید است.
- مجموع و ارزش داشبورد محصولات مخفی را هم حساب می‌کند، ولی Listهای عملیاتی معمولاً
  آن‌ها را حذف می‌کنند؛ تعریف Metricها باید صریح و یکدست باشد.
- معیار «بدون تصویر» فقط تصویر اختصاصی InventoryItem را می‌بیند و ممکن است محصول
  کاتالوگی دارای تصویر قابل‌نمایش را اشتباهاً بدون تصویر حساب کند.
- Status محاسبه‌شده نباید قابل ویرایش نشان داده شود.
- Empty State باید CTA مشخص داشته باشد.
- Barcode، SKU و جریان Camera-first وجود ندارد.
- تست خودکار Accessibility، Keyboard، Focus و Contrast وجود ندارد.
- Manifest فقط SVG دارد و آیکون PNG 192/512 و Maskable ندارد.
- آموزش شروع کار برای Offline، Sync و کاتالوگ وجود ندارد.


۱۱. مزیت رقابتی
---------------

مزیت محصول:

- ادامه کار در اینترنت ضعیف یا قطع.
- راه‌اندازی سریع با کاتالوگ آماده هر شغل.
- تغییر بسیار سریع تعداد موجودی.
- فارسی/RTL/تومان به‌صورت Native.
- مدل فریمیوم و Limitها از قبل طراحی شده‌اند.
- خروجی محلی و سرور برای اعتماد و مالکیت داده.
- Audit و چرخه عمر کاتالوگ برای عملیات مدیریت‌شده.

مزیت فنی:

- Sync آگاه از Version و Idempotent برای یک MVP قوی است.
- Tombstone مانع بازگشت داده حذف‌شده می‌شود.
- مدیریت OPFS و بهینه‌سازی تصویر خوب طراحی شده است.
- Rollback حذف کاتالوگ و ۱۰۰ رکورد وابسته تست شده است.
- Capability هم در UX و هم در Backend enforce می‌شود.

Moat بالقوه:

  تجربه عملیاتی فارسی
  + قابلیت آفلاین
  + داده کاتالوگ تخصصی هر صنف
  + عملیات سریع موجودی
  + داده تجمعی بازار و کالا.

در بلندمدت کیفیت داده کاتالوگ، Barcode، ارتباط Supplier و هوشمندی سفارش مجدد،
از خود کد اپلیکیشن دفاع‌پذیرتر خواهند بود.


۱۲. معایب و ریسک کسب‌وکار
-------------------------

- نبود Workspace مشترک، محصول را فعلاً SaaS تک‌کاربره می‌کند.
- نبود پرداخت یعنی طرح‌ها هنوز درآمد خودکار تولید نمی‌کنند.
- نبود Purchase Order، Supplier، Sale/Order، قیمت خرید، Margin، Location،
  Lot/Expiry و Barcode/SKU.
- خطای کاتالوگ جهانی می‌تواند همه کاربران یک حوزه را تحت تأثیر قرار دهد.
- Provision خودکار در Scale می‌تواند فهرست را شلوغ کند.
- حل تعارض کاربرمحور وجود ندارد.
- دوام داده به SQLite، فایل محلی و Browser Storage وابسته است.
- داده مرورگر ممکن است پاک شود و فقط Sync موفق ریسک را کاهش می‌دهد.
- مدیر پلتفرم قدرت تخریبی زیادی دارد و Approval چندمرحله‌ای محدود است.
- Analytics محصول برای سنجش Retention وجود ندارد.
- Funnel ورود، Referral، CRM و پیام Lifecycle وجود ندارد.
- Privacy، Consent، Retention و سیاست حذف/خروجی حساب مدل نشده‌اند.


۱۳. ظرفیت رشد و مدل درآمد
------------------------

ICP مناسب:

- فروشگاه/انبار با یک مالک یا اپراتور.
- حدود ۵۰ تا ۵۰۰۰ SKU فعال.
- بررسی موجودی با موبایل.
- اینترنت ضعیف یا گران.
- فرآیند فعلی کاغذ، اکسل یا پیام‌رسان.
- نیاز جدی به هشدار کمبود و عدم تمایل به ERP پیچیده.

Verticalهای مناسب شروع:

- قطعات خودرو و تعمیرگاه.
- خرده‌فروشی و سوپرمارکت کوچک.
- آرایشی و زیبایی.
- ابزار و مصالح.
- توزیع‌کنندگان کوچک.

تا قبل از افزودن Expiry/Lot/Compliance، وارد حوزه‌های بسیار قانون‌مند مانند دارو
و ردیابی غذایی نشوید.

پکیج پیشنهادی:

- Free: یک کاربر/دستگاه، Limit پایین، خروجی محلی و هشدار پایه.
- Starter: موجودی بیشتر، دو دستگاه، Backup و Export بهتر.
- Pro: Workspace/Team، نقش، Barcode، Supplier/Reorder و چند Location.
- VIP/Enterprise: Scale نامحدود، SLA، Onboarding، کاتالوگ/Import سفارشی و API.

کمبودهای درآمدی:

- درگاه پرداخت و Webhook چرخه اشتراک.
- فاکتور/رسید و یادآوری تمدید.
- Trial و Grace Period.
- Upgrade Prompt در لحظه دریافت ارزش یا رسیدن به Limit.
- Billing Owner و مدیریت Seat/Device.
- Analytics تبدیل، Churn، Expansion و تمدید ناموفق.

پیام‌های اصلی بازاریابی:

۱) با قطع اینترنت کار شما متوقف نمی‌شود.
۲) با کاتالوگ آماده شغل خود شروع کنید.
۳) موجودی را در چند ثانیه تغییر دهید.
۴) قبل از مشتری بدانید چه چیزی کم یا تمام شده است.
۵) با Export و وضعیت Sync مالک داده خود بمانید.

آزمایش‌های جذب:

- Landing Page اختصاصی هر صنف با کاتالوگ و واژگان همان صنف.
- ویدیوی ۶۰ ثانیه‌ای از حالت آفلاین و دکمه سریع +/-.
- همکاری با عمده‌فروش، حسابدار و نصب‌کننده POS.
- سرویس Import اکسل به‌عنوان Lead Magnet.
- اعتبار Referral برای هم‌صنفی‌ها.
- گزارش رایگان «سلامت موجودی» پس از Import.

متریک‌های ضروری Founder:

- بازدید -> ثبت‌نام -> انتخاب حوزه -> اولین تغییر موجودی.
- Time to First Value.
- کسب‌وکار فعال D1/D7/D30.
- تعداد تغییر موجودی هفتگی هر کسب‌وکار.
- درصد کاربران با Sync موفق اخیر.
- Pending/Dead Letter در هر ۱۰۰۰ Mutation.
- کامل‌بودن قیمت/تصویر/Threshold.
- مشاهده هشدار -> تأمین موجودی.
- Conversion، MRR، ARPU، Churn و Expansion.
- درخواست پشتیبانی در هر ۱۰۰ کسب‌وکار فعال.


۱۴. Roadmap اولویت‌بندی‌شده
--------------------------

P0 — قبل از تولید عمومی

۱) امنیت و Deployment
   - توقف Startup تولید با SECRET_KEY پیش‌فرض.
   - HTTPS، Security Header و CSP.
   - Rate Limit ورود و ثبت رویداد امنیتی.
   - Token کوتاه‌عمر/Refresh چرخشی و عدم ذخیره Token خام.
   - PostgreSQL و Object Storage.
   - Alembic.
   - Backup رمزگذاری‌شده و تست Restore.

۲) صحت داده
   - اصلاح ذخیره ایمیل Signup.
   - پیاده‌سازی/حذف Unit و حذف Select وضعیت محاسبه‌شده.
   - استاندارد تومان/ریال.
   - اتصال همه تغییرات موجودی به Ledger تراکنش.
   - Foreign Key و Unique Constraint.
   - پیاده‌سازی واقعی Restore و اصلاح نام فرمت Export.

۳) Quality Gate
   - CI برای Lint، Build، Test و Migration.
   - تست Frontend و Playwright برای سفرهای اصلی.
   - تولید TypeScript Contract از OpenAPI.
   - Logging، Error Monitoring و Metric.

P1 — نسخه Product-Market Fit

۱) Organization/Workspace، Membership و Tenant Role.
۲) Warehouse/Location و موجودی هر Location.
۳) Barcode/SKU و جست‌وجوی سریع.
۴) Supplier و Reorder/Purchase Order پایه.
۵) پرداخت، Trial، Renewal و Invoice واقعی.
۶) Import اکسل/CSV با Preview، Validation و Duplicate Handling.
۷) Sync Center و حل تعارض برای کاربر.
۸) Onboarding و آموزش Contextual.
۹) جداسازی منوی Platform Admin از تنظیمات کسب‌وکار.

P2 — Scale و تمایز

۱) Pagination/Chunk برای Sync اولیه و تخلیه کامل Change Pageها.
۲) Retention/Compaction لاگ Sync و Observability.
۳) قیمت خرید/فروش، Margin و روش ارزش‌گذاری.
۴) انتقال بین انبارها و Approval.
۵) پیشنهاد سفارش بر اساس سرعت مصرف و Lead Time.
۶) Barcode، Variant و Supplier Data در کاتالوگ.
۷) API/Webhook و اتصال POS/حسابداری.
۸) Product Analytics و Cohort/Retention.

P3 — Enterprise

- Lot/Serial/Expiry.
- Permission ریزدانه و Approval Workflow.
- SSO/MFA و خروجی Audit سازمانی.
- Conflict Strategy تیمی در حالت آفلاین.
- SLA، Disaster Recovery و استقرار منطقه‌ای.
- Forecasting پس از ایجاد داده تاریخی تمیز و کافی.


۱۵. معماری هدف پیشنهادی
-----------------------

فعلاً Modular Monolith مناسب است؛ به Microservice عجله نکنید:

  React PWA
    - API Client تولیدشده
    - Cache آفلاین IndexedDB + OPFS
    - Sync Engine نسخه‌دار
    - Client Observability

  FastAPI Modular Monolith
    - Identity/Session
    - Tenant/Workspace
    - Catalog
    - Inventory/Transaction
    - Subscription/Billing
    - Sync
    - Admin/Audit

  Infrastructure
    - PostgreSQL
    - S3-compatible Object Storage
    - Redis فقط هنگام نیاز برای Rate Limit/Job/Cache
    - Worker برای Import/Export/Image/Notification
    - Log، Error Tracking و Metric مرکزی

مدل Tenancy پیشنهادی:

  Organization
    -> Membership(user, role)
    -> Warehouse/Location
    -> Product Definition
    -> Stock Balance per Location
    -> Stock Movement Ledger

User.id را مرز دائمی کسب‌وکار قرار ندهید. organization_id را به مدل‌های دامنه
اضافه و حساب فعلی هر کاربر را به Organization تک‌عضوی پیش‌فرض مهاجرت دهید.


۱۶. راهنمای عملی Founder/Developer
----------------------------------

مدل ذهنی اصلی:

- IndexedDB مدل خواندن فعال فرانت‌اند است.
- SyncQueue پل بین قصد محلی و مرجع نهایی سرور است.
- `/api/sync` مسیر اصلی Mutation/Reconciliation محصول است.
- سرور مرجع هویت، Permission، Subscription، Catalog جهانی و Conflict/Delete است.
- CatalogProduct داده پلتفرم و InventoryItem موجودی کاربر است.
- Archive حفظ می‌کند؛ Permanent Delete به‌صورت جهانی تخریب می‌کند.
- Guard فرانت راهنمای UX است؛ Backend مرجع امنیت است.

چک‌لیست تغییر امن:

۱) آفلاین کار می‌کند؟
۲) Idempotent وارد صف می‌شود؟
۳) اگر دستگاه دیگر همان رکورد را تغییر دهد چه می‌شود؟
۴) پس از حذف سرور چه می‌شود؟
۵) Scope کاربر/Tenant رعایت شده؟
۶) حساب منقضی/غیرفعال محافظت می‌شود؟
۷) پاک‌سازی تصویر محلی و سرور امن است؟
۸) Cache داشبورد و Query Invalidate می‌شود؟
۹) Migration و Rollback چیست؟
۱۰) تست Ownership، Retry، Conflict و عملیات مخرب وجود دارد؟

چک‌لیست Release:

- Build و Lint فرانت موفق.
- تست بک‌اند موفق.
- Migration روی کپی داده تولید تست شده.
- Backup/Restore واقعاً تست شده.
- Online -> Offline -> چند Edit -> Reconnect تست شده.
- تعارض دو دستگاه تست شده.
- حساب Expired و Disabled تست شده.
- RTL موبایل، عرض ۲۸۰px، تبلت و دسکتاپ تست شده.
- تم‌ها، Keyboard و Focus تست شده.
- Monitoring، Rollback و پیام پشتیبانی آماده است.


۱۷. جمع‌بندی نهایی
------------------

تنظیم پایه‌ای معنادار و مسیر متمایز قابل‌باوری دارد. Sync آفلاین و کاتالوگ تخصصی
صنفی مهم‌ترین دارایی‌ها هستند. کد در چند بخش دشوار، به‌خصوص یکپارچگی Sync و چرخه
عمر کاتالوگ، از سطح Prototype بالاتر است.

فعلاً محصول را «ERP کامل» معرفی نکنید. آن را «کنترل سریع و مطمئن موجودی شخصی برای
کسب‌وکار کوچک» بفروشید و در فاز بعد Workspace مشترک، انبار و Ledger واقعی را
اضافه کنید.

ترتیب اولویت Founder:

  ۱) Reliability، Security و Recovery داده.
  ۲) مدل Workspace/Team.
  ۳) Barcode، Import و Reorder.
  ۴) پرداخت و سنجش Activation/Retention.
  ۵) Scale زیرساخت فقط همزمان با رشد مصرف.

اگر این ترتیب رعایت شود، تنظیم می‌تواند از یک MVP آفلاین‌محور قوی به SaaS عمودی
ارزشمند تبدیل شود، بدون آنکه به یک ERP گسترده ولی سطحی تبدیل شود.
