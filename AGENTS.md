# Mandatory Tanzim invariants

- Customer business data belongs to a store; a user is an actor, not the ownership boundary.
- Platform administrators bypass commercial and store-role restrictions inside their isolated administrator workspace; this never grants implicit access to another customer's store. Store ownership never implies platform authority.
- Resolve store context from the authenticated active membership. Never trust client `store_id`, actor, role, or permission claims.
- Unknown permissions deny by default. Keep permission dependencies and subscription capacity in centralized configuration.
- Personnel and role administration is online-only and owner-only. Never place identity/authorization changes in the operational outbox.
- Authorize every sync operation at acceptance time. Preserve rejected payloads as non-retrying recovery data; never mark them synchronized.
- Partition local projections, cursors, and outbox state by authenticated person and store. Personnel authorization expires after the configured lease.
- Backups cannot restore authority, credentials, memberships, roles, or subscriptions, and cannot cross owner/store boundaries.
- Activity attribution uses stable server-derived actor and membership IDs; never persist passwords or tokens.

Detailed architecture and extension rules: [docs/store-personnel-architecture.md](docs/store-personnel-architecture.md).
