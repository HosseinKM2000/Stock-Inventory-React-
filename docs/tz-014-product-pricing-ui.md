# TZ-014 product UI and pricing

## Reference mapping

- Reference 3 maps to the image-first `grid` card.
- Reference 4 maps to the detailed `comfortable` card with actions and quick stock controls.
- Reference 5 maps to the dense horizontal `compact` row.
- References 1 and 2 map to the same filter controls: stacked on narrow screens and a search row plus four inline controls on desktop.
- Reference 6 informs the shared pastel dashboard card family; product detail rows continue to use the inventory product card/link patterns.

The references are visual direction only. Tanzim keeps its existing pale lavender surface, blue/purple hairlines, green commercial values, amber stock warnings, RTL flow, and established typography.

## Price semantics

- `sale_price` is the canonical optional sale price.
- Legacy `price` is a compatibility alias for sale price. Existing values migrate to `sale_price`.
- `purchase_price` is optional and is never inferred from a sale price.
- Empty and zero are distinct: empty means unknown; zero is a valid explicit value.
- Financial totals use integer toman and `bigint` arithmetic in the client.
- Potential profit includes only products with both prices. It is not realized profit or revenue and excludes discounts, tax, and operating costs.

Existing local records, schema-1/2/3 backups, and queued legacy `price` updates are upgraded by treating `price` as sale price and leaving purchase price null. Data schema 3 sync responses include the canonical fields; schema-2 clients continue receiving the legacy sale-price alias. Omitted update fields remain unchanged while an explicit null clears a canonical price.

## Authorization

- `products.sale_price.view` and `products.sale_price.change` govern sale values; legacy product viewers/editors retain their established sale-price behavior.
- `products.purchase_price.view` and `products.purchase_price.change` are new sensitive permissions.
- `finance.view` depends on purchase-price view, sale-price view, dashboard view, and product view.
- Owners receive the complete permission set. Personnel receive purchase/finance access only through explicit role grants.
- Sync and server exports project restricted fields out; local exports and UI features re-check current permissions. Backups remain owner-only.

## Financial formulas and future actual sales

- Purchase valuation: `Σ(actual-unit quantity × known purchase price)`.
- Sale valuation: `Σ(actual-unit quantity × known sale price)`.
- Potential gross profit: `Σ(quantity × (sale − purchase))` over products with both prices.
- Potential margin: the eligible potential profit divided by sale valuation for that same eligible set; a zero denominator is unavailable.
- Negative values are preserved as review signals.

Realized-profit reporting is intentionally excluded. It requires explicit sale and return events, actual transaction prices, a documented cost-basis policy, discounts and other relevant costs, reversals, and auditable event history. A stock decrease is not treated as a sale.

## Shared UI conventions

Inventory cards own the three saved view modes. Dashboard detail pages use `DashboardProductCard` variants so geometry and interactions stay consistent while each section supplies only relevant facts. New task-specific icons use named Lucide imports; existing Radix icons remain where replacement would broaden this task beyond the referenced product/dashboard surfaces.

## Responsive verification matrix

The automated Playwright comparison was run with Desktop Chrome and Pixel 7 projects. The product-specific regression also changes the viewport explicitly to `1440 × 900` and `390 × 700` so both reference layouts and horizontal-overflow behavior are covered.

| Viewport | Verified layout |
| --- | --- |
| Pixel 7 project / 390 × 700 override | One-column filters and cards; no horizontal overflow; all three card modes retain their core information. |
| 768 × 1024 explicit Playwright viewport | Two-column product grid with no horizontal overflow; financial metrics use the same two-column responsive rule. |
| Desktop Chrome / 1440 × 900 override | Search spans the filter row; category, sort, labels, and catalog toggle share four aligned columns. |
| 1440 × 900 responsive rule | Three-column product grid; four-column financial metrics; comfortable-card actions stay inside the card. |

Keyboard checks: all cards, image previews, selectors, action buttons, and financial detail links must expose a visible focus state and an accessible name.
