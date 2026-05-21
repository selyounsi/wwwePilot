# Page Detector

`usePageDetector()` — a shared composable that classifies the page in the
active (or a given) tab. Any service or module can import it; the result
state is shared and reactive, so multiple consumers see the same answer.

```js
import { usePageDetector } from '@/composables/usePageDetector.js'

const { state, detect, cmsLabel } = usePageDetector()

await detect()                       // active tab, DOM-first
await detect({ tabId, url })         // explicit tab
await detect({ probe: true })        // force the network confirmation pass
await detect({ force: true })        // bypass the 60s cache
```

## What it answers

```js
state = {
  loading,            // bool
  url,                // detected URL
  isOurSite,          // bool | null — a wwwe / securewebsystems hosted site
  cms,                // 'cms3' | 'cms4' | 'everpress' | 'wordpress' | 'unknown' | null
  version,            // framework version string | null
  generator,          // <meta name=generator> content | null
  signals,            // raw detection signals (markers, versionAttrs, probe)
  error,              // string | null
}
```

`cmsLabel(state.cms)` → a display string (`CMS3`, `CMS4`,
`EverPress (WordPress)`, `WordPress`, `Unbekannt`).

## How detection works

Two layers. DOM-first because every marker we rely on surfaces as a
`<script src>` tag or an `<html>` attribute, so the common case needs no
network at all. A path-probe pass runs only when the DOM is inconclusive
(or when `probe: true` is passed).

### Layer 1 — DOM scan (`chrome.scripting.executeScript`)

Reads, in the page context:

- **`<html>` version attributes** — anything matching `fw`, `ep`, or
  `version` (`data-fw`, `data-fw-version`, `data-ep-version`, …).
- **Script `src` markers**:

  | Marker | Means |
  |---|---|
  | `/usecurez.js` or `/usecurezc.js` | our house counter → **our site** |
  | `/evercdn/assets/…` (and `/securewebapps/evercdn/…`) | our CDN → **our site** |
  | `/ewcms3/js/ewcms_js.js` | **CMS3** |
  | `/_rassets/csite_modules.js` | **CMS4** |
  | `/themes/everpress/` or `/plugins/everpress/` | **EverPress** (our WordPress) |
  | `/wp-content/` or `/wp-includes/` | WordPress |

- **`<meta name=generator>`** — catches plain WordPress that isn't ours.

### Layer 2 — path probe (`fetch` from the sidebar)

The sidebar runs in the extension's privileged context with
`host_permissions: ["<all_urls>"]`, so cross-origin `fetch` is allowed
and CORS-free. The probe fetches the known global paths and checks for a
`200`:

| Bucket | Paths |
|---|---|
| our site | `/usecurez.js`, `/securewebapps/evercdn/…/main.min.js`, `/evercdn/…/main.min.js` |
| CMS3 | `/ewcms3/js/ewcms_js.js` |
| CMS4 | `/_rassets/csite_modules.js` |

Probing confirms our-site status and resolves the framework when no DOM
marker was found (e.g. scripts injected in a way the scan missed).

## Classification precedence

```
ewcms3 script  OR  data-fw           → cms3   (version = data-fw, often null on old sites)
csite_modules  OR  data-fw-version   → cms4   (version = data-fw-version)
data-ep-version OR everpress theme   → everpress (version = data-ep-version)
wp-content/includes OR generator=WP  → wordpress
else                                 → unknown

isOurSite = usecurez || evercdn || everpress-theme
```

## Verified against real sites (2026-05-21)

| Site | isOurSite | cms | version |
|---|---|---|---|
| dr-schoppe.de | ✓ | cms3 | `null` (old site, no attr) |
| durdov.de | ✓ | cms4 | `1.9.2` (`data-fw-version`) |
| shop-lypo-bau-de.wd4.securewebdemo.net | ✓ | everpress | `4.3.1` (`data-ep-version`) |
| ipsi.securewebsystems.net (the admin tool) | ✗ | unknown | `null` |

Path-probe spot check: `durdov.de/usecurez.js` 200, `/_rassets/csite_modules.js`
200, `/ewcms3/…` 404; `dr-schoppe.de/ewcms3/…` 200, `/_rassets/…` 404;
`example.com/usecurez.js` 404.

## Notes / limits

- **Very old CMS3 sites** expose no version attribute → `cms: 'cms3',
  version: null`. The CMS type is still reliable via the `ewcms3` script.
- Detection caches per URL for 60s; pass `force: true` to bypass.
- The scan reads the **live** DOM (post-JS), so dynamically injected
  framework scripts are still caught.
- Reuses the same `chrome.scripting.executeScript` pattern as the
  Quick-Info extractor — no extra permissions needed (`scripting`, `tabs`,
  `<all_urls>` are already in the manifest).
