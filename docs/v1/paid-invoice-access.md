# TZ-V1-02B1 paid invoice access and pricing boundary

## Approved policy

- Free and historical Starter do not grant purchase or sale invoice actions.
- Pro and VIP grant both invoice capabilities. Store-member permissions, authenticated store context, operating mode, and acceptance-time authorization still apply.
- Invoice draft barcode selection, reports, PDF, print, share, posting, and cancellation require the relevant current invoice capability plus their existing permissions. This allocation does not grant the general barcode tool.
- An authorized store member may still read immutable historical invoice records after a downgrade. That exception does not permit a new effect, cancellation, report, or output. Exact committed operation replay remains ahead of current-policy rejection and does not apply a second effect.

## Price and offer states

Pricing is administered as an exact integer Toman amount. The database retains IRR minor-unit storage for compatibility, with a required `Toman × 10` conversion and a database constraint that rejects non-Toman-aligned values. The accepted range is 0 through 10,000,000,000 Toman; an available paid offer must be strictly positive.

The states are intentionally distinct:

1. Free: zero price and never purchasable.
2. Paid plan not configured: price and/or term is absent and offer availability is false.
3. Paid plan configured: positive price, explicit positive term and unit, and administrator-controlled availability.

Only Pro and VIP can be marked available. Starter stays historical-only. No price, duration, gift, grace rule, capacity allocation, Starter transition, or payment provider is approved by this task. The earlier illustrative Pro/VIP 30-day term is cleared only when it is still the untouched legacy value.

## Future payment boundary

`GET /api/plans/{plan_id}/offer` captures a server-authoritative immutable value containing offer identity, plan identity and revision, Toman amount, currency, term, and capture time. The client supplies no amount. Checkout is explicitly returned as unavailable with `PAYMENT_PROVIDER_NOT_CONFIGURED`.

A future payment implementation must persist this offer snapshot under a separate purchase identity. Provider identity/reference and the resulting entitlement identity must remain separate. Provider currency conversion belongs in an explicit server adapter. Entitlement may be created only after a verified provider confirmation, and confirmation/retry handling must be idempotent. This task adds no checkout, simulated purchase, callback, grant, or gateway integration.

## Deployment

Alembic `20261106_0016` adds offer availability and database checks, applies only the approved invoice capability delta to built-in plans, and does not rewrite subscriptions, grants, stores, invoices, sync operation IDs/payloads/fingerprints/results, or actor history. Pre-02B1 workers do not enforce this offer boundary; use a controlled replacement after backup and current-copy migration rehearsal.
