# Subscription lifecycle safety

TZ-V1-05B verifies lifecycle mechanics only. It does not approve prices, terms, grace periods, retention durations, capacities, gift audiences, payment behavior, or a Starter transition.

## Current behavior matrix

| Transition or state | Authoritative behavior | Preserved evidence and customer path |
|---|---|---|
| Subscription reaches its expiry instant | The end instant is exclusive. The effective subscription is expired at `expires_at`; only the established expired read surface remains. | Store data, operating mode, memberships, local files, invoices, queues, and recovery evidence remain. The subscription page links to synchronization and recovery review. |
| Gift ends or is revoked | The grant stops replacing the base plan and the unchanged underlying subscription becomes effective. Plans are never unioned. | Grant history and audit attribution remain; no data, membership, role, or mode is rewritten. |
| Administrator changes capability or capacity | The next server acceptance uses the current complete policy and one acceptance instant. A lower capacity blocks new admission, not existing records or unrelated permitted edits. | Existing products and personnel records remain. Policy changes do not manufacture a successful result for rejected work. |
| Previously committed operation is retried after a transition | The server resolves the same store, actor, operation ID, and canonical fingerprint before applying current-policy rejection. | The recorded result is returned with one domain effect. Mismatched reuse remains terminal. |
| Never-committed durable work meets expired or reduced access | On reconnect the client submits the original durable identity for authoritative classification. The server records a terminal rejection when current access denies it. | The payload remains inspectable and is not acknowledged or deleted. Renewal does not make the terminal item automatically eligible again. |
| Attempted or unknown work | The original operation ID and semantic payload remain immutable until the server can resolve the outcome. | Recovery/reconciliation remains explicit. A new ID is reserved for a newly approved action after uncertainty is resolved. |
| Renewal or entitlement restoration | A refreshed authoritative snapshot enables future permitted actions. | Terminal failures are not reset automatically. An explicit new action receives a new ID; explicit media retry keeps the original transfer ID and content hash. |
| Product media around a transition | Upload and product association remain separate. Upload requires current write access; protected reads still require current membership, store scope, association, and read access. | Entitlement rejection leaves OPFS bytes and the transfer journal intact. Missing bytes are never marked uploaded and no automatic garbage collection runs. |
| Membership revocation | Active membership remains an independent requirement and fails before customer-store access. A first-attempt `403` is a definite rejection. A `403` after a possible dispatch stops retry but cannot prove the earlier attempt had no effect. | The latter remains terminal, immutable evidence marked outcome-unresolved because access is denied. A revoked actor cannot inspect the server result. A `401` remains pending for reauthentication without pretending acceptance. |
| Solo and Team | Expiry, downgrade, grants, and renewal never switch operating mode. Solo keeps its cached local-first contract; Team still requires server acceptance for shared mutations. | Team commands with uncertain outcomes remain available for same-ID resolution. Personnel are not silently reactivated. |

## Work-state disposition

- `pending`/never attempted: submitted under the original identity when online so current server policy can accept or terminally reject it.
- `in_flight`/attempted/uncertain: identity and payload stay frozen; retries are same-ID resolution attempts.
- `fatal_error` or policy rejection: retained as recovery evidence and excluded from automatic retry, including after renewal. Definite first-attempt rejection remains distinct from an access-denied unresolved prior attempt.
- `conflict`: retained for explicit reconciliation; a newer local edit is not overwritten by rollback.
- `dead_letter`: retained and shown as stopped work; generic manual retry applies only to retryable/dead-letter transport failures, not terminal policy failures.
- restored work: follows the existing recovery review and current authorization rules; backup content cannot restore subscription or authority.

## Compatibility and limits

This task changes no PostgreSQL schema, Dexie schema, backup format, commercial allocation, operating-mode protocol, or payment boundary. Pre-05B clients can leave locally durable work pending across expiry and later submit it automatically after renewal; deploy the compatible frontend as a normal controlled application replacement. Server replay and terminal-result semantics remain backward compatible.

The browser cannot revoke bytes already present on a disconnected device. Membership and entitlement are rechecked on reconnect. No automatic deletion, media garbage collection, grace period, checkout, or entitlement issuance is introduced.

An authorized actor may explicitly resolve an access-denied uncertain operation through `GET /api/sync/operations/{operation_id}` after current membership/read access is restored. The lookup is scoped by the server-resolved store and original actor, returns only a recorded result projected through current read permissions, and returns not-recorded separately. It never dispatches the command, creates a new identity, or applies a domain effect. Renewal and reauthentication do not invoke this path silently.
