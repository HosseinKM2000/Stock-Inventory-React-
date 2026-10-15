# Store workspaces, personnel, and authorization

TZ-012 changes the commercial ownership boundary from a user account to a store workspace. A `User` is still one independently authenticated identity. A `StoreMembership` connects that identity to one store, and a `StoreRole` supplies permissions for non-owner members. Platform administration (`User.is_system_admin`/`ADMIN`) remains separate from customer ownership. Administrators receive a lazily created, isolated owner workspace for supervision and end-to-end testing; this does not grant access to any customer workspace.

## Migration and compatibility

Alembic revision `20261015_0005` creates stores, roles, memberships, and store activity, then creates exactly one owner store for each non-system user. It backfills `store_id` on inventory, categories, labels, custom products, transactions, sync operations, and sync changes without changing resource IDs. Legacy `user_id` remains a compatibility/data-creator column during the transition and points to the original store owner; server access resolves this value only from an authenticated active membership.

Existing subscription columns on the owner are mirrored to the store during the compatibility window. System/service identities are excluded. Starter roles are editable rows, not authorization branches. Sync clients must send `X-Client-Data-Schema: 2`; older clients receive HTTP 426 before a batch or cursor is changed, leaving their local outbox available for export/update recovery.

The IndexedDB v8 migration keeps pending operations and cursors and partitions projections with `actor user + store + entity id`. It never lets a personnel session reuse an owner's unrestricted projection. A legacy projection is retained under a legacy key until an authenticated refresh replaces it.

## Permission catalog and dependencies

| Group | Permission |
|---|---|
| Products | `products.view`, `products.create`, `products.edit`, `products.quantity.change`, `products.price.change`, `products.delete` |
| Organization | `categories.manage`, `labels.manage`, `products.bulk` |
| Dashboard | `dashboard.view` |
| Tools | `tools.import`, `tools.export`, `tools.catalog`, `tools.backup`, `tools.restore` |
| Audit | `activity.view` (owner-only in V1) |

Mutation permissions depend on `products.view`. Import depends on viewing and creating products; export/backup depend on viewing; restore depends on backup. The role API rejects unknown identifiers and expands dependencies before persistence. New roles start empty. Assigned roles cannot be deleted. Personnel/role/subscription/ownership administration and activity history are owner-only.

Effective customer access is the intersection of: a valid session; active membership; the store subscription; industry/tool policy; owner authority or role permission; and resource membership in the resolved store. Owner authority does not bypass subscription or domain policy. Platform administrators bypass commercial, domain-tool, and store-role restrictions only in their isolated administrator workspace, while customer-store access still requires an explicit future selection/impersonation workflow.

## Commercial policy

Plan data contains the `personnel` capability and `active_personnel` limit. Free, Starter, and Pro disable personnel with zero seats. VIP enables ten active personnel in addition to the owner. `Store.personnel_limit_override` is the supported store exception. Admission and reactivation lock the store row and count active non-owner memberships inside the transaction. Inactive people and role definitions consume no seats.

Expiration or downgrade preserves users, memberships, roles, data, and history. Personnel operational access is suspended when `personnel` is unavailable. If a still-enabled limit is reduced below usage, existing memberships are preserved while admission/reactivation is blocked.

## Credentials

Public signup creates a user, owner store, owner membership, and editable starter roles. Owner-created personnel use the same global, case-sensitive username namespace. A missing username gets a cryptographically random suffix. Temporary passwords use `secrets`, are bcrypt-hashed immediately, returned once, never logged, and invalidate prior sessions when reset.

The first personnel login is online. `temporary_password_required` blocks operational dependencies until password change succeeds. Visiting Security separately records `credentials_notice_viewed_at`; it does not clear the password gate. Username changes preserve user and membership IDs, so attribution remains stable.

## Offline revocation and rejected work

Personnel authorization snapshots are valid for 24 hours after the last successful server-authenticated check. After that lease, operational access pauses until online verification; pending work is not deleted. Owners retain the existing offline subscription behavior.

Every sync operation is re-authorized against the current role, membership, entitlement, and sensitive fields. A mixed batch is evaluated operation by operation. Rejected payloads become terminal/conflict queue entries and are not marked synchronized. Pull refreshes accepted shared state. Revocation cannot erase information already present on a disconnected device, but reconnect prevents revoked operations from modifying the server.

An owner may inspect rejected work through protected recovery tooling and apply it as a new owner-attributed operation. It is never silently replayed as the original actor.

## Activity

`store_activity` records store, stable user and membership IDs, display name and role snapshot, operation ID, target/action, sanitized before/after values, server acceptance time, optional client occurrence time, and applied/rejected/conflict outcome. `(store_id, operation_id)` prevents duplicate retry history. Passwords, hashes, and tokens are removed. The owner API is paginated and filters by actor, action, and acceptance date; UI dates use the shared Jalali formatter.

## Backup rules

Full local backup and restore are owner-only in V1. Schema v2 binds a new backup to both stable owner user ID and store ID. Schema v1 remains importable only for the same legacy owner; it cannot create stores, memberships, roles, subscriptions, credentials, or permission snapshots. Restored outbox entries are quarantined for review and receive new operation IDs. Actor IDs already present in business history are preserved; identities are never fabricated.

