# Commercial V1 decisions

This document records target policy. It does not claim that the current implementation already complies. Current behavior and evidence are mapped in [architecture-map.md](architecture-map.md), and executed checks are in [progress.md](progress.md).

## Confirmed target policy

### Operating mode

- The server controls an explicit store operating mode: `solo` or `team`.
- Solo mode uses durable local-first writes. When server synchronization is entitled, those writes enter a persistent outbox.
- Team mode allows cached offline reading, but every shared mutation requires current server authorization and server acceptance, including owner mutations. TZ-V1-01D does not retain ordinary offline shared-mutation drafts: offline input fails before an executable command is persisted.
- A team-capable plan, personnel capacity, and active personnel count are not operating-mode switches. Team activation is explicit: the activating browser uses the common outbox-then-local-writer lock order, pauses local writers, attempts to drain eligible work under its existing operation identities, and blocks while any outbox or recovery work remains unresolved. Its transition identity remains durable until confirmation, so lost responses and simultaneous attempts converge without a second transition. Other devices are warned and stale/missing policy context is rejected by the server; this does not claim inspection or instant control of a disconnected device.
- Subscription expiry must not silently change a team store to solo mode.
- Multiple devices are permitted in V1. The model must retain an extension point for future device policy without enforcing a new restriction now.

### Plans, permissions, and administration

- Commercial tiers are Free, Pro, and VIP; Persian display names remain configurable.
- Real launch restrictions are enforced. Initial users receive an explicit, auditable, time-bounded grant to a real paid tier; entitlement checks are never bypassed.
- Plan entitlements, store-member permissions, operating mode, and device policy are distinct inputs. The backend is authoritative for server access.
- Plan changes preserve existing data. Platform administrators manage centralized capability and capacity definitions with validation and an audit trail, only in their isolated administrator workspace unless an explicit customer-store access workflow is later introduced.
- Capability and capacity identifiers, types, dependencies, supported unlimited semantics, implementation status, and enforcement locations come from one server registry. Unknown or unset keys deny; planned capabilities cannot be enabled merely by configuration.
- The effective commercial plan is one whole plan, never a union. One active, non-revoked, time-bounded administrator grant takes precedence over the underlying subscription until its server-time end; expiry or revocation reveals the unchanged base subscription. Overlapping grants are rejected in V1.
- Grant windows are start-inclusive and end-exclusive. One server acceptance instant governs all entitlement and capacity checks for a command, so expiry during processing cannot mix two policies inside one accepted effect.
- Plan-wide edits require the current policy revision and an audit reason. A stale revision fails instead of overwriting another administrator. Existing allocations remain explicitly legacy/unapproved until Task 2B confirms the launch catalog.
- `Starter` remains readable for existing historical assignments but is not offered publicly or assignable to a new subscriber. It is not silently remapped to Free, Pro, or VIP.
- Device capacity remains an extension point only: all V1 tiers are unrestricted and attempts to activate a device limit are rejected.

### Durability, synchronization, media, and backup

- UI success follows the required durable write. Local durability, server acceptance, media transfer, and independent backup are separate states.
- Once transmitted, an operation identity and payload are immutable. A later mutation gets a new identity. Terminal or unknown outcomes remain recoverable and do not retry forever.
- Product metadata and image bytes have coordinated but independent transfer states. Entitled recovery restores actual bytes to local storage; OPFS alone is not an independent backup.
- Catalog media is administrator-managed and referenced by customer data. Plan changes and catalog hiding never delete shared catalog files. Backend storage exposes stable object references rather than temporary delivery URLs so a CDN can be added later.
- Backup/restore cannot restore identity, authority, credentials, memberships, roles, or subscriptions; it cannot cross owner/store boundaries. Restored work is reviewed and reconciled, never silently discarded or replayed under a different actor.
- An attempted or uncertain restored operation keeps its original operation identity and semantic payload for idempotent status/replay. Only an explicitly approved new recovery change receives a new identity, current actor attribution, and the current conflict/version checks. A missing result for an additive operation remains unresolved rather than being guessed.
- A browser-local pre-restore checkpoint protects the restore transaction and unfinished review; it is not an independent external backup and does not protect against device loss.
- The current SHA-256 digest detects file changes only against the digest carried in that same file; it is an integrity check, not cryptographic authentication or proof of actor/owner authority.

### Store-owned operational data

- A store's business domain selection and catalog assignments belong to the store, not to each user profile. Owner and personnel memberships authorize actors into the same inventory; they never create parallel customer inventories.
- Legacy owner-oriented columns may remain only as compatibility mirrors or historical attribution. They are not an authorization, query, uniqueness, synchronization, or provisioning boundary.
- If an authenticated person has more than one active membership and no server-validated active-store selection exists, V1 fails closed with a controlled ambiguity error. This task does not introduce a multi-store selector.
- Catalog definitions remain global administrator-managed records. Store assignment reconciliation may hide ineligible assignments but preserves customer quantities, prices, labels, visibility choices, identifiers, and history.

### Experience and dates

- Preserve established navigation, responsive layouts, tokens, components, both themes, and compact/normal/large display preferences.
- Public owner signup collects only username, password, and client-only password confirmation. Names and contact fields are completed later in profile; the server stores missing values as null and never fabricates shared placeholders.
- An incomplete owner profile produces one informational, non-blocking reminder with a direct profile action. Viewing is not completion; only a successful profile update resolves it. Personnel and platform-administrator workspaces are not asked to complete the customer owner's profile.
- Persian RTL copy is warm, concise, respectful, and understandable to beginners. Activity describes business actions rather than transport events.
- Human-facing input, display, print, and export use one Jalali convention such as `۱۴۰۳/۱۲/۰۱`, accepting Persian and Latin input digits. Backend-compatible internal timestamps remain allowed.
- Calendar conversion uses a compatible, maintained library; required UI/calendar assets work offline.

## Safety invariants

- Business data is store-owned; a user is an actor. Store ownership does not confer platform authority.
- Store context comes from the authenticated active membership. Client store, actor, role, and permission claims are never authoritative.
- Unknown permissions deny by default. Permission dependencies and subscription capacity remain centralized.
- Personnel and role administration is online-only and owner-only and never enters the operational outbox.
- Every sync operation is authorized at acceptance. Rejected payloads remain non-retrying recovery data and are never marked synchronized.
- Local projections, cursors, and outbox state are partitioned by authenticated person and store. If offline personnel authorization is enabled, it expires according to centralized policy; the current 24-hour lease is observed implementation, not a newly confirmed Commercial V1 duration or requirement.
- Activity uses stable server-derived actor and membership identifiers. Passwords and tokens are never stored in activity or backup artifacts.

## Unresolved business decisions

- Exact tier capacities, capability allocations, paid prices, gift duration, renewal/grace rules, and retention periods.
- Future private, non-executable team drafts, their retention, and who may submit them. They are not implemented by TZ-V1-01D.
- Conflict policy for concurrent absolute quantity changes and operator handling of unknown outcomes.
- Media completion criteria, download-to-OPFS policy, quotas, retention, and original-versus-derivative recovery promise.
- Backup encryption/key ownership, frequency, retention, RPO/RTO, and restore-drill ownership.
- Purchase and sale invoices are planned Commercial V1 scope. The accounting definition, source events, and presentation of realized profit remain unresolved.
- Production SLOs, monitoring/incident ownership, deployment approval, and rollback procedure.

Illustrative values already present in code are observed defaults, not confirmation of these open decisions.

## Scope exclusions for this baseline

- No feature, UI, schema, dependency, entitlement, customer data, deployment, or production configuration is changed.
- No payment provider, CDN, device restriction, multi-store selector, or speculative post-V1 feature is selected here.
- This baseline does not merge into `draft`/`develop` and does not begin implementation task 1.

## Remaining task order

The proposed order is valid with one scope clarification: task 1 must include the store-ownership/catalog and restore-reconciliation integrity defects because operating mode cannot be safe on top of ambiguous ownership or discardable work.

1. Synchronization integrity, store-native ownership paths, safe restore reconciliation, and explicit solo/team modes.
2. Central plan entitlements, administrator controls, and explicit early-user grants.
3. Simplified registration and actionable notifications.
4. Media durability, backend object storage, transfer state, and byte recovery.
5. Safe PWA updates, local/server migrations, and subscription/mode lifecycle transitions.
6. Atomic purchase/sale invoices, then PDF/print/sharing.
7. Dashboard completion from verified domain sources.
8. Application-wide language, contextual help, activity presentation, and Jalali consistency.
9. Hardening, observability, recovery drills, and release validation.

Language/date conventions and diagnostic instrumentation apply within every relevant task, not only tasks 8–9.
