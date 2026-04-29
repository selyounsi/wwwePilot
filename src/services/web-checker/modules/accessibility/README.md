# Accessibility module (axe-core)

WCAG audit via [axe-core](https://github.com/dequelabs/axe-core), the
industry-standard accessibility testing library used by Lighthouse and
many CI tools.

## What it checks

Runs `axe.run()` against the page and reports:

- **Violations** — confirmed WCAG failures (mapped to error or warning
  based on impact)
- **Incomplete** — issues axe can't decide automatically; user should
  manually verify (mapped to warning, prefixed with `[Manuelle Prüfung]`)

axe covers ~90 WCAG rules including ARIA usage, form labels, landmark
regions, language attributes, role/state/value validity, etc.

## Severity mapping

| axe impact | Our type | German label |
|---|---|---|
| `critical` | error | Kritisch |
| `serious` | error | Schwerwiegend |
| `moderate` | warning | Mittel |
| `minor` | warning | Gering |
| (incomplete, no impact) | warning | Manuelle Prüfung |

## Disabled rules (avoid duplicates)

The following rules are disabled because we have specialised modules for
them:

- `color-contrast` — our `contrast` module uses pixel sampling
- `image-alt` — `images` module
- `link-name` — `links` module
- `heading-order`, `empty-heading` — `headings` module
- `html-has-lang`, `meta-viewport`, `document-title` — `overview` module

## German locale

`axe-core/locales/de.json` is bundled into the extension. The service
worker loads it via `chrome.runtime.getURL('axe-locale-de.json')` and
passes it to `axe.configure({ locale })` before each run, so help texts
and failure summaries appear in German. Rule IDs and impact enums stay
English (they're identifiers, not UI).

## How axe is loaded

axe.min.js is **not bundled** into the extension's main JS — it's a
500KB file that we inject into the page on demand:

1. Vite plugin (`copy-axe-core` in `vite.config.js`) copies
   `node_modules/axe-core/axe.min.js` → `public/axe.min.js` at build
   time. Vite/CRXJS then bundles `public/` into `dist/` root.
2. The same plugin copies `axe-core/locales/de.json` →
   `public/axe-locale-de.json`.
3. On `AXE_RUN`, the service worker injects `axe.min.js` via
   `chrome.scripting.executeScript({ files: ['axe.min.js'] })` then
   runs a second `executeScript` with a func that calls `axe.run()`.

Both auto-copied files are gitignored.

## Item display

Each axe finding becomes one item:
- **Title** = CSS selector of the failing element
- **Issue** = rule help text (in German)
- **Details** = rule ID
- Expand → Regel, Impact, Selector, HTML snippet, Doku link

## Limitations

- axe-core needs to load before each check — adds ~100ms vs. native
  modules.
- Some rules require manual review and surface as `[Manuelle Prüfung]`
  warnings rather than concrete failures.
- axe runs against the same DOM snapshot — dynamic content loaded after
  the check started won't be evaluated until you re-run.
- The disabled rules list is hard-coded in `background.js` — adding
  custom disables requires code changes.
