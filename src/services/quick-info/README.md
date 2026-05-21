# Quick Info Service

Page-specific sidebar view with **two automatic modes**, chosen by the
service itself based on the active tab's URL:

- **Quick Info** — when the URL matches an admin-defined profile,
  the sidebar shows the extracted fields grouped into sections.
- **Quick Page Info** — otherwise, the sidebar shows what kind of
  page this is (CMS detection, version, our-site flag, URL parts,
  detection signals). Powered by the shared `usePageDetector`
  composable so the same detection state is reused across services.

The user never picks a mode — switching happens automatically when
the tab URL changes.

## Pieces

| File | What it does |
|---|---|
| `service.json` | Service descriptor — name, icon, dashboard order. Gated by feature-flag `service.quick-info`. |
| `views/HomeView.vue` | Smart router: loads profiles, decides which mode to render, owns the shared refresh button. |
| `views/ProfileInfoView.vue` | Profile mode — sections + rules with copy / open / chat actions. |
| `views/PageInfoView.vue` | Page-info mode — detection cards (CMS badge + version, URL parts, SEO meta, tech indicators, structure stats, collapsible detection signals + network-probe trigger). |
| `composables/useQuickInfoProfiles.js` | Loads visible profiles from `/api/quick-info/profiles` and caches them for 5 min. Provides `matchProfile(url)` (first regex match wins). |
| `composables/useExtraction.js` | One `chrome.scripting.executeScript` call evaluates every rule's selector against the live DOM. Handles `kind=text` (textContent) and `kind=link` (textContent + href). Optional `pattern` regex post-filter, optional `multiple` list mode. |

The page detector itself lives at `@/composables/usePageDetector.js`
and the SEO/tech/stats extractor at `@/composables/usePageMeta.js`
(both shared across services on purpose — the web-checker and future
tools can read the same reactive state).

## Feature flags

Three flags govern this service (`admin → Feature flags`):

- `service.quick-info` — master tile switch
- `module.quick-info.profile` — toggles the profile-extractor mode
- `module.quick-info.detector` — toggles the page-detection mode

When both mode flags are off the sidebar shows a notice pointing back
to the admin page.

## Mode switching

The sidebar reads the active tab via the global `useActiveTab` composable.
On every tab-URL change `HomeView.vue` re-runs `matchProfile(url)` against
the cached profiles:

- **Match** → renders `ProfileInfoView`, runs DOM extraction for the
  profile's rules.
- **No match** → renders `PageInfoView`, runs `usePageDetector` against
  the current tab. No "empty state" anymore — every URL gets *something*
  useful in the sidebar.

The header title swaps between **"Quick Info"** and **"Quick Page Info"**
to make the active mode obvious. The single refresh button in the header
re-runs whichever flow is active.

## Rule kinds

- **text** — reads `textContent` of the first matched node (or all nodes
  when `multiple: true`). Optional `pattern` runs as a regex post-filter;
  if it has a capture group, the group is returned.
- **link** — captures both the rendered text and the `href` attribute.
  The UI renders an anchor that opens in a new tab (or follows `mailto:` /
  `tel:` in the current tab).

## Actions

`actions` is a small whitelist per rule:

- `copy` — clipboard button (always available unless field is empty).
- `open` — only meaningful for `kind=link` with a non-empty href.
- `chat` — placeholder right now (toasts). Once the chatbot exposes a
  programmatic ingest, `sendToChat` in HomeView gets wired up.

## Configuration

All CRUD lives in the admin UI under `/admin/quick-info`. The sidebar is
read-only — users cannot change profiles, sections or rules from here.
Visibility per profile follows the same three-dimensional gate as
check-types (roles / users / groups, OR-unioned).

See [docs/quick-info.md](../../../docs/quick-info.md) for the full setup
guide including the backend schema and example profile configuration.
