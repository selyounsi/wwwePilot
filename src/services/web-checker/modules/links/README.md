# Links module

Link quality, accessibility name detection and reachability check.

## What it checks

For every `<a href>` on the page (after `IGNORE_SELECTORS` filter):

- **Broken (404)** — service worker `HEAD` then `GET` request, error if
  status ≥ 400 (and not 999, which Twitter/LinkedIn return for bots)
- **Empty link** — error when there's no visible content (no text, no
  `<img alt>`, no `aria-label`, AND no CSS icon detected via
  `hasVisualContent`)
- **Icon-Link without label** — error when the link has visual content
  (e.g. CSS icon) but no `title` and no `aria-label` — screen readers
  can't name it
- **Missing `title`** — error for normal links without a `title` attr
  (skipped for anchor links and icon links, which don't need title)
- **Title === Linktext** — warning when `title` exactly matches visible
  text — title should provide additional info, not duplicate
- **External without `_blank`** — warning when an external link doesn't
  open in new tab
- **Mailto / Tel without title** — warning

## URL filtering

The `IGNORE_SELECTORS` array at the top of `index.js` lists CSS
selectors. Each link is matched via `closest()` — so the selector
applies to the link itself OR any ancestor:

```js
const IGNORE_SELECTORS = [
  '[href="#content"]',          // skip "skip nav" anchors
  '[href="#back-to-top"]',
  '[href="/sitemap"]',
  '.cms-logo',                  // ignore the logo link
  '.WidgetSealContainer',       // ignore all links inside this widget
]
```

Ignored links don't get fetched and don't appear in the results.

## URL scheme filtering

Only HTTP(S) URLs are sent to the broken-link checker. `javascript:`,
`mailto:`, `tel:`, `data:`, `blob:` and friends are not fetchable and
would cause "URL scheme not supported" errors — they're skipped.

## Service worker (`background.js`)

Handles `CHECK_LINKS` — receives an array of URLs, does a parallel
`HEAD` first (fast), falls back to `GET` for ambiguous statuses, returns
a `{ url, broken }` for each.

## Visible-content detection

Uses the shared `hasVisualContent(el)` window helper. An "icon link" is
detected by:
- no inner text / img alt / aria-label, AND
- one of: `::before`/`::after` content, `::before`/`::after`
  background-image, or own `background-image`

This catches both icon-font links (`<a class="icon-instagram">` with
`::before { content: '\f16d' }`) and bg-image-only icon links.

## Limitations

- The IGNORE_SELECTORS list is static in `index.js`. No UI for
  configuration yet.
- 404 detection is HTTP-status-based; soft-404s (200 status with "page
  not found" body) are not detected.
- Fetch is HEAD-then-GET with timeouts (5s / 8s). Slow servers may cause
  false positives.
