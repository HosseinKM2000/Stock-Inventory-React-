# UI sizing and navigation inset contract

Tanzim uses three persisted display presets on `html[data-display-size]`:

- `compact`: 92% root typography with modestly tighter spacing.
- `normal`: the 16px baseline.
- `large`: 112% root typography with more comfortable spacing and controls.

New UI should use `rem`, Radix size props, or the semantic `--app-*` tokens in
`src/style/index.css`. Do not use `transform: scale()`, browser zoom, or add
page-specific size overrides. Fixed technical dimensions (barcodes and print
millimetres) remain independent of display preferences.

The fixed navigation publishes its measured border-box height through
`--app-bottom-navigation-measured-height`. Scroll containers reserve
`--app-content-bottom-inset`, which includes the measured navigation, the
raised Add Product action, and clearance. Pages using `app-shell-content`
must not add `pb-*` utilities for the navigation. Floating actions use the
same inset. `ResizeObserver` handles content, preset, and orientation changes.

The navigation surface uses four equal columns, or five when the primary Add
Product action is available. The primary action is centered independently of
the row height and keeps a square aspect ratio at every viewport. Responsive
page rules may change inline and top padding, but must never replace the shared
bottom inset with a blanket `padding` declaration.

When the mobile visual viewport indicates an on-screen keyboard, the shared
navigation hides consistently. Virtualized inventory rows remeasure after a
display-size event or viewport resize.
